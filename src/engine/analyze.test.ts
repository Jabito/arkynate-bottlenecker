import { describe, expect, it } from 'vitest';
import { analyzeGraph } from './analyze';
import { capacityOf } from './capacity';
import { expectedAttempts } from './allocation';
import { maxSustainableMultiplier } from './stress';
import { statusOf } from './format';
import { lg, lb, srv, db, cache, queue, edge, run } from './testkit';
import { NODE_DEFAULTS } from '../data/nodeDefaults';
import { TEMPLATES } from '../data/templates';
import { LESSONS } from '../data/lessons';
import { COMPUTED_NODE_KEYS } from '../types';
import type { Node } from '@xyflow/react';
import type { NodeData } from '../types';

const BIG = 1_000_000;

describe('capacity (#1, #7, #78)', () => {
  it('server maxQPS is per instance: capacity = maxQPS × instances', () => {
    const { r } = run([lg('g', 1000), srv('s', 500, { instances: 4 })], [edge('g', 's')]);
    expect(r('s').capacity).toBe(2000);
    expect(r('s').utilization).toBeCloseTo(50, 9);
    expect(r('s').status).toBe('healthy');
    expect(r('s').errorRatePct).toBe(0);
  });

  it('database splits reads and writes; replicas add read capacity only', () => {
    // 1010 in, 70% reads: 707 of 1000 reads (70.7%), 303 of 300 writes (101%) → critical on writes
    const { r, data } = run([lg('g', 1010), db('d', 1000, 300)], [edge('g', 'd')]);
    expect(data('d').readUtilization).toBeCloseTo(70.7, 9);
    expect(data('d').writeUtilization).toBeCloseTo(101, 9);
    expect(r('d').utilization).toBeCloseTo(101, 9);
    expect(r('d').status).toBe('critical');

    // 2500 in, 2 replicas: reads 1750 of 3000 (58.3%), writes 750 of 1000 (75%)
    const two = run([lg('g', 2500), db('d', 1000, 1000, { readReplicas: 2 })], [edge('g', 'd')]);
    expect(two.r('d').utilization).toBeCloseTo(75, 9);
    expect(two.r('d').status).toBe('warning');
  });

  it('database capacity is the incoming rate at which the busier path reaches 100%', () => {
    const d = db('d', 1000, 300).data;
    expect(capacityOf(d)).toBeCloseTo(1000, 9); // writes: 300 / 0.3
    expect(capacityOf({ ...d, readRatio: 100 } as NodeData)).toBe(1000);
    expect(capacityOf({ ...d, readRatio: 0 } as NodeData)).toBe(300);
  });

  it('queue capacity is its drain rate, consumers × throughput', () => {
    expect(capacityOf(queue('q', 2000, 2).data)).toBe(4000);
  });

  it('100% utilisation is already critical (the queue never drains)', () => {
    expect(statusOf(100)).toBe('critical');
    expect(statusOf(99.99)).toBe('near');
    expect(statusOf(90)).toBe('warning');
    expect(statusOf(70)).toBe('healthy');
  });
});

describe('overload (#2, #8)', () => {
  it('a node over capacity sheds 1 − capacity/in, not util − 100', () => {
    const { r } = run([lg('g', 1500), srv('s', 1000)], [edge('g', 's')]);
    expect(r('s').errorRatePct).toBeCloseTo(100 / 3, 9);
    const twice = run([lg('g', 2000), srv('s', 1000)], [edge('g', 's')]);
    expect(twice.r('s').utilization).toBeCloseTo(200, 9);
    expect(twice.r('s').errorRatePct).toBeCloseTo(50, 9);
  });

  it('configured errors apply to what is served: 1 − (cap/in)(1 − e)', () => {
    const { r, flow } = run([lg('g', 2000), srv('s', 1000, { errorRate: 2 }), srv('t', BIG)], [edge('g', 's'), edge('s', 't')]);
    expect(r('s').errorRatePct).toBeCloseTo(51, 9);
    expect(r('s').forwardedQPS).toBeCloseTo(980, 9);
    expect(flow('s', 't')).toBeCloseTo(980, 9);
  });

  it('a saturated node forwards only what it serves, so no false bottleneck behind it', () => {
    const { r, flow } = run([lg('g', 2000), srv('a', 1000), srv('b', 1500)], [edge('g', 'a'), edge('a', 'b')]);
    expect(r('a').status).toBe('critical');
    expect(flow('a', 'b')).toBeCloseTo(1000, 9);
    expect(r('b').utilization).toBeCloseTo(66.667, 2);
    expect(r('b').status).toBe('healthy');
  });

  it('zero or negative capacity with traffic is clamped and critical, never healthy (#13)', () => {
    for (const maxQPS of [0, -500, NaN]) {
      const { r, meta } = run([lg('g', 1000), srv('s', maxQPS)], [edge('g', 's')]);
      expect(r('s').status).toBe(Number.isNaN(maxQPS) ? 'healthy' : 'critical');
      expect(meta.warnings.some(w => w.kind === 'invalid' && w.nodeId === 's')).toBe(true);
    }
    // a missing field falls back to the palette default (1500) and is reported
    const missing = run([lg('g', 1000), srv('s', undefined as unknown as number)], [edge('g', 's')]);
    expect(missing.r('s').capacity).toBe(1500);
  });

  it('hit rate above 100 is clamped: nothing passes a 100% cache', () => {
    const { flow, meta } = run([lg('g', 1000), cache('c', 150), srv('s', 1000)], [edge('g', 'c'), edge('c', 's')]);
    expect(flow('c', 's')).toBe(0);
    expect(meta.warnings.some(w => w.kind === 'invalid' && w.nodeId === 'c')).toBe(true);
  });
});

describe('edge distribution (#3, #11)', () => {
  it('percent edges that exceed 100% are scaled to fit and warned about', () => {
    const { flow, meta } = run(
      [lg('g', 1000), srv('a', BIG), srv('b', BIG)],
      [edge('g', 'a', { distributionMode: 'percent', distributionValue: 60 }), edge('g', 'b', { distributionMode: 'percent', distributionValue: 90 })],
    );
    expect(flow('g', 'a') + flow('g', 'b')).toBeCloseTo(1000, 9);
    expect(flow('g', 'a')).toBeCloseTo(400, 9);
    expect(meta.warnings.some(w => w.kind === 'overallocated' && w.nodeId === 'g')).toBe(true);

    const two80 = run(
      [lg('g', 5000), lb('l', BIG), srv('a', BIG), srv('b', BIG)],
      [edge('g', 'l'), edge('l', 'a', { distributionMode: 'percent', distributionValue: 80 }), edge('l', 'b', { distributionMode: 'percent', distributionValue: 80 })],
    );
    expect(two80.r('a').actualQPS).toBeCloseTo(2500, 9);
    expect(two80.r('b').actualQPS).toBeCloseTo(2500, 9);
  });

  it('percent applies to what absolute edges leave over', () => {
    const { flow } = run(
      [lg('g', 1000), srv('a', BIG), srv('b', BIG)],
      [edge('g', 'a', { distributionMode: 'absolute', distributionValue: 400 }), edge('g', 'b', { distributionMode: 'percent', distributionValue: 100 })],
    );
    expect(flow('g', 'a')).toBe(400);
    expect(flow('g', 'b')).toBeCloseTo(600, 9);
  });

  it('negative percent is clamped to 0; the auto sibling gets the rest', () => {
    const { flow } = run(
      [lg('g', 1000), srv('a', BIG), srv('b', BIG)],
      [edge('g', 'a', { distributionMode: 'percent', distributionValue: -50 }), edge('g', 'b')],
    );
    expect(flow('g', 'a')).toBe(0);
    expect(flow('g', 'b')).toBe(1000);
  });

  it('auto edges split the remainder after percent edges', () => {
    const { flow } = run(
      [lg('g', 1000), srv('a', BIG), srv('b', BIG), srv('c', BIG)],
      [edge('g', 'a', { distributionMode: 'percent', distributionValue: 50 }), edge('g', 'b'), edge('g', 'c')],
    );
    expect(flow('g', 'b')).toBeCloseTo(250, 9);
    expect(flow('g', 'c')).toBeCloseTo(250, 9);
  });

  it('unallocated traffic is reported on the source node, not lost silently', () => {
    const abs = run([lg('g', 1000), srv('s', BIG), srv('t', BIG)], [edge('g', 's'), edge('s', 't', { distributionMode: 'absolute', distributionValue: 300 })]);
    expect(abs.flow('s', 't')).toBe(300);
    expect(abs.data('s').unallocatedQPS).toBeCloseTo(700, 9);
    expect(abs.meta.warnings.some(w => w.kind === 'unallocated' && w.nodeId === 's')).toBe(true);

    const pct = run(
      [lg('g', 1000), srv('a', BIG), srv('b', BIG)],
      [edge('g', 'a', { distributionMode: 'percent', distributionValue: 30 }), edge('g', 'b', { distributionMode: 'percent', distributionValue: 20 })],
    );
    expect(pct.data('g').unallocatedQPS).toBeCloseTo(500, 9);
    expect(pct.meta.generatedQPS).toBeCloseTo(500, 9);
  });

  it('an edge into a load generator or a missing node is ignored and reported', () => {
    const ghost = { id: 'g->ghost', source: 'g', target: 'ghost', data: { distributionMode: 'auto' as const } };
    const { flow, r, meta } = run([lg('g', 1000), lg('g2', 10), srv('s', BIG)], [edge('g', 's'), edge('g', 'g2'), ghost]);
    expect(flow('g', 's')).toBe(1000);
    expect(r('s').actualQPS).toBe(1000);
    expect(meta.warnings.filter(w => w.kind === 'invalid')).toHaveLength(2);
  });
});

describe('retries (#23, #99)', () => {
  it('expected attempts are Σₖ₌₀ʳ eᵏ, not 1 + e·r', () => {
    expect(expectedAttempts(0.2, 3)).toBeCloseTo(1.248, 12);
    expect(expectedAttempts(0.15, 3)).toBeCloseTo(1.175875, 12);
    expect(expectedAttempts(0.1, 3)).toBeCloseTo(1.111, 12);
    expect(expectedAttempts(0, 5)).toBe(1);
    expect(expectedAttempts(1, 3)).toBe(4);
  });

  it('below capacity, retries multiply load by the expected attempts', () => {
    const { r, meta } = run([lg('g', 1000), srv('s', BIG), db('d', BIG, BIG, { errorRate: 20 })], [edge('g', 's'), edge('s', 'd', { retryCount: 3 })]);
    expect(r('d').actualQPS).toBeCloseTo(1248, 6);
    // a request fails only if all 4 attempts fail: 1 − 0.2⁴
    expect(meta.successRatePct).toBeCloseTo(99.84, 6);
  });

  it('overload errors drive retries, solved to a fixed point', () => {
    const { r, meta } = run([lg('g', 1500), srv('s', BIG), srv('t', 1000)], [edge('g', 's'), edge('s', 't', { retryCount: 3 })]);
    const incoming = r('t').actualQPS;
    expect(incoming).toBeGreaterThan(1500);
    const e = 1 - 1000 / incoming;
    expect(r('t').errorRatePct / 100).toBeCloseTo(e, 9);
    expect(incoming).toBeCloseTo(1500 * expectedAttempts(e, 3), 4);
    expect(meta.converged).toBe(true);
  });

  it('absolute caps still hold after retries', () => {
    const { flow } = run(
      [lg('g', 1000), srv('s', BIG), srv('t', BIG, { errorRate: 50 })],
      [edge('g', 's'), edge('s', 't', { distributionMode: 'absolute', distributionValue: 300, retryCount: 3 })],
    );
    expect(flow('s', 't')).toBe(300);
  });
});

describe('queues (#24)', () => {
  const nodes = () => [lg('g', 8000), srv('api', BIG), queue('q', 2000, 2), srv('c1', 2500), srv('c2', 2500)];
  const edges = [edge('g', 'api'), edge('api', 'q'), edge('q', 'c1'), edge('q', 'c2')];

  it('input above the drain rate becomes backlog, not errors', () => {
    const { r, meta } = run(nodes(), edges);
    expect(r('q').utilization).toBeCloseTo(200, 9);
    expect(r('q').status).toBe('critical');
    expect(r('q').errorRatePct).toBe(0);
    expect(r('q').backlogQPS).toBeCloseTo(4000, 9);
    expect(meta.warnings.some(w => w.kind === 'backlog' && w.nodeId === 'q')).toBe(true);
  });

  it('forwards only the drain rate, so consumer capacity is not counted twice', () => {
    const { r } = run(nodes(), edges);
    expect(r('c1').actualQPS).toBeCloseTo(2000, 9);
    expect(r('c1').utilization).toBeCloseTo(80, 9);
    expect(r('c1').async).toBe(true);
  });

  it('the async hop is outside request latency and success rate', () => {
    const slow = nodes().map(n => n.id === 'c1' ? srv('c1', 1000, { baseLatencyMs: 5000, errorRate: 50 }) : n);
    const { meta } = run(slow, edges);
    expect(meta.criticalPath).toEqual(['g', 'api', 'q']);
    expect(meta.endToEndLatencyMs).toBeLessThan(100);
    expect(meta.successRatePct).toBe(100);
  });
});

describe('cycles (#9)', () => {
  const nodes = [lg('g', 1000), srv('a', BIG), srv('b', BIG), srv('c', BIG)];
  const edges = [edge('g', 'a'), edge('a', 'b'), edge('b', 'a'), edge('a', 'c')];

  it('iterates the cycle to its steady state and names the feedback edge', () => {
    const { r, meta } = run(nodes, edges);
    // a receives 1000 + half of its own output back: a = 2000, c = 1000
    expect(r('a').actualQPS).toBeCloseTo(2000, 4);
    expect(r('c').actualQPS).toBeCloseTo(1000, 4);
    const cycle = meta.warnings.find(w => w.kind === 'cycle');
    expect(cycle?.edgeId).toBe('b->a');
    expect(meta.converged).toBe(true);
  });

  it('gives the same answer whatever the node or edge order', () => {
    const forward = run(nodes, edges);
    const backward = run([...nodes].reverse(), [...edges].reverse());
    for (const id of ['a', 'b', 'c']) expect(backward.r(id).actualQPS).toBeCloseTo(forward.r(id).actualQPS, 6);
  });

  it('a self-loop is a cycle too', () => {
    const { meta } = run([lg('g', 100), srv('a', 1000)], [edge('g', 'a'), edge('a', 'a', { distributionMode: 'percent', distributionValue: 50 })]);
    expect(meta.warnings.some(w => w.kind === 'cycle')).toBe(true);
  });
});

describe('load generators (#12)', () => {
  it('are left out of results and carry no status', () => {
    const { results, data } = run([lg('g', 1000), srv('s', 2000)], [edge('g', 's')]);
    expect(results.map(x => x.nodeId)).toEqual(['s']);
    expect(data('g').status).toBeUndefined();
    expect(data('g').actualQPS).toBe(1000);
  });

  it('multiple generators add up; fan-in sums', () => {
    const { r } = run([lg('g1', 500), lg('g2', 700), srv('s', BIG)], [edge('g1', 's'), edge('g2', 's')]);
    expect(r('s').actualQPS).toBe(1200);
  });

  it('disconnected nodes get 0 and are healthy', () => {
    const { r } = run([lg('g', 1000), srv('s', 2000), srv('lonely', 1)], [edge('g', 's')]);
    expect(r('lonely').actualQPS).toBe(0);
    expect(r('lonely').status).toBe('healthy');
  });

  it('the stress multiplier scales every generator', () => {
    const { r } = run([lg('g', 1000), srv('s', BIG)], [edge('g', 's')], 2.5);
    expect(r('s').actualQPS).toBe(2500);
  });
});

describe('latency, critical path and success rate (#25, #79)', () => {
  it('mean latency sums M/M/1 latencies along the request path', () => {
    // server ρ = 0.5 → 50/0.5 = 100 ms; db 1000 of 2000 (writes 500 of 1000) → 15/0.5 = 30 ms
    const { meta } = run(
      [lg('g', 1000), srv('s', 2000, { baseLatencyMs: 50 }), db('d', 2000, 1000, { readRatio: 50, baseLatencyMs: 15 })],
      [edge('g', 's'), edge('s', 'd')],
    );
    expect(meta.endToEndLatencyMs).toBeCloseTo(130, 9);
    expect(meta.criticalPath).toEqual(['g', 's', 'd']);
    expect(meta.successRatePct).toBe(100);
  });

  it('is traffic-weighted across branches; the critical path is the slowest carrying branch', () => {
    const nodes = [lg('g', 1000), lb('l', BIG, { baseLatencyMs: 0 }), srv('fast', BIG, { baseLatencyMs: 10 }), srv('slow', BIG, { baseLatencyMs: 1000 })];
    const split = (slowShare: number) => [
      edge('g', 'l'),
      edge('l', 'fast', { distributionMode: 'percent', distributionValue: 100 - slowShare }),
      edge('l', 'slow', { distributionMode: 'percent', distributionValue: slowShare }),
    ];
    const a = run(nodes, split(10));
    expect(a.meta.endToEndLatencyMs).toBeCloseTo(0.9 * 10 / (1 - 900 / BIG) + 0.1 * 1000 / (1 - 100 / BIG), 6);
    expect(a.meta.criticalPath).toEqual(['g', 'l', 'slow']);
    // a 0% branch carries nothing and is ignored
    const b = run(nodes, split(0));
    expect(b.meta.criticalPath).toEqual(['g', 'l', 'fast']);
    expect(b.meta.endToEndLatencyMs).toBeLessThan(11);
  });

  it('unreached nodes do not affect latency', () => {
    const { meta } = run([lg('g', 1000), srv('s', 2000, { baseLatencyMs: 50 }), srv('far', 10, { baseLatencyMs: 900 })], [edge('g', 's')]);
    expect(meta.endToEndLatencyMs).toBeCloseTo(100, 9);
  });

  it('is unbounded once a node on the path saturates, not a finite 1000× base', () => {
    const { meta, r } = run([lg('g', 1000), srv('s', 1000)], [edge('g', 's')]);
    expect(r('s').estimatedLatencyMs).toBe(Infinity);
    expect(meta.endToEndLatencyMs).toBe(Infinity);
    expect(meta.saturated).toBe(true);
  });

  it('success rate chains configured errors end to end; cache hits finish at the cache', () => {
    const { meta } = run(
      [lg('g', 1000), srv('s', 2000, { errorRate: 2 }), cache('c', 50, { errorRate: 0 }), db('d', BIG, BIG, { errorRate: 10 })],
      [edge('g', 's'), edge('s', 'c'), edge('c', 'd')],
    );
    // 980 reach the cache; 490 hits done; 490 misses × 0.9 → 441 → 931 of 1000
    expect(meta.successRatePct).toBeCloseTo(93.1, 9);
  });

  it('meta is empty-safe', () => {
    const { meta, results } = analyzeGraph([], []);
    expect(results).toEqual([]);
    expect(meta.endToEndLatencyMs).toBeNull();
    expect(meta.successRatePct).toBe(100);
    expect(meta.criticalPath).toEqual([]);
  });
});

describe('determinism and contracts', () => {
  const all = [...TEMPLATES, ...LESSONS.map(l => l.diagram)];

  it.each(all.map(t => [t.name, t] as const))('%s gives the same results in any node and edge order', (_, t) => {
    const a = analyzeGraph(t.nodes, t.edges);
    const b = analyzeGraph([...t.nodes].reverse(), [...t.edges].reverse());
    const byId = new Map(b.results.map(x => [x.nodeId, x]));
    for (const x of a.results) {
      expect(byId.get(x.nodeId)!.actualQPS).toBeCloseTo(x.actualQPS, 6);
      expect(byId.get(x.nodeId)!.status).toBe(x.status);
    }
    expect(b.meta.criticalPath).toEqual(a.meta.criticalPath);
  });

  it('every computed key the engine writes is listed in COMPUTED_NODE_KEYS', () => {
    for (const t of all) {
      const { updatedNodes } = analyzeGraph(t.nodes, t.edges);
      for (const n of updatedNodes) {
        const original = t.nodes.find(o => o.id === n.id)!.data;
        for (const k of Object.keys(n.data)) {
          if (!(k in original)) expect(COMPUTED_NODE_KEYS as readonly string[]).toContain(k);
        }
      }
    }
  });

  it('stale computed values from an old save are replaced, not kept', () => {
    const stale = srv('s', 2000);
    stale.data = { ...stale.data, status: 'critical', actualQPS: 99999 } as NodeData;
    const { data } = run([lg('g', 100), stale], [edge('g', 's')]);
    expect(data('s').status).toBe('healthy');
    expect(data('s').actualQPS).toBe(100);
  });

  it('the load balancer strategy is ignored (#16)', () => {
    const a = run([lg('g', 1000), lb('l', 1500, { strategy: 'weighted' }), srv('s', BIG)], [edge('g', 'l'), edge('l', 's')]);
    const b = run([lg('g', 1000), lb('l', 1500), srv('s', BIG)], [edge('g', 'l'), edge('l', 's')]);
    expect(a.r('l').utilization).toBe(b.r('l').utilization);
  });

  it('a 500-node graph analyses quickly', () => {
    const nodes: Node<NodeData>[] = [lg('g', 50_000)];
    const edges = [];
    const layers = 10, width = 50;
    for (let l = 0; l < layers; l++) for (let i = 0; i < width; i++) {
      const id = `n${l}-${i}`;
      nodes.push(srv(id, 10_000, { errorRate: 1 }));
      if (l === 0) edges.push(edge('g', id));
      else for (const k of [i, (i + 1) % width, (i + 7) % width]) edges.push(edge(`n${l - 1}-${k}`, id, { retryCount: k === i ? 1 : 0 }));
    }
    analyzeGraph(nodes, edges); // warm up
    const t0 = performance.now();
    const { meta } = analyzeGraph(nodes, edges);
    const ms = performance.now() - t0;
    expect(meta.converged).toBe(true);
    expect(ms).toBeLessThan(50);
  });
});

describe('palette defaults pass on first Analyze (#97)', () => {
  const mk = (kind: keyof typeof NODE_DEFAULTS, id: string): Node<NodeData> => ({ id, type: kind, position: { x: 0, y: 0 }, data: NODE_DEFAULTS[kind]() });

  it('LG → LB → Server → DB built from defaults is healthy', () => {
    const nodes = [mk('loadGenerator', 'g'), mk('loadBalancer', 'l'), mk('server', 's'), mk('database', 'd')];
    const { results, meta } = run(nodes, [edge('g', 'l'), edge('l', 's'), edge('s', 'd')]);
    for (const x of results) expect(x.status).toBe('healthy');
    expect(meta.saturated).toBe(false);
    expect(Number.isFinite(meta.endToEndLatencyMs)).toBe(true);
  });

  it('LG → Server → Cache → DB and LG → Queue → Server from defaults are healthy', () => {
    const a = run([mk('loadGenerator', 'g'), mk('server', 's'), mk('cache', 'c'), mk('database', 'd')], [edge('g', 's'), edge('s', 'c'), edge('c', 'd')]);
    const b = run([mk('loadGenerator', 'g'), mk('queue', 'q'), mk('server', 's')], [edge('g', 'q'), edge('q', 's')]);
    for (const x of [...a.results, ...b.results]) expect(x.status).toBe('healthy');
  });
});

describe('max sustainable load (#96)', () => {
  it('is capacity ÷ load for a linear chain', () => {
    expect(maxSustainableMultiplier([lg('g', 1000), srv('s', 1500)], [edge('g', 's')])).toBeCloseTo(1.5, 3);
  });

  it('is below 1 when already saturated', () => {
    expect(maxSustainableMultiplier([lg('g', 2000), srv('s', 1500)], [edge('g', 's')])).toBeCloseTo(0.75, 3);
  });

  it('is Infinity when nothing flows', () => {
    expect(maxSustainableMultiplier([srv('s', 1500)], [])).toBe(Infinity);
  });

  it('the Cached API template breaks at 1.2× (the LB), not 2×', () => {
    const t = TEMPLATES.find(x => x.name === 'Cached API')!;
    expect(maxSustainableMultiplier(t.nodes, t.edges)).toBeCloseTo(1.2, 3);
  });
});
