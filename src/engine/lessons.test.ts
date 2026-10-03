import { describe, expect, it } from 'vitest';
import { LESSONS, type Lesson } from '../data/lessons';
import { TEMPLATES } from '../data/templates';
import { run, patch } from './testkit';
import { expectedAttempts } from './allocation';

/*
 * "Lesson says X → engine says X" (#14). Every number a lesson or template states is
 * checked against the engine, and every mitigation the copy claims is simulated.
 * If you change a diagram, change its copy in the same commit.
 */

const lesson = (id: string): Lesson => {
  const l = LESSONS.find(x => x.id === id);
  if (!l) throw new Error(`no lesson ${id}`);
  return l;
};
const text = (l: Lesson) => [l.problem, l.rootCause, l.diagram.description, ...l.symptoms, ...l.mitigations].join('\n');
const says = (l: Lesson, phrase: string) => expect(text(l)).toContain(phrase);

describe('Server CPU Saturation', () => {
  const l = lesson('server-cpu-saturation');
  const out = run(l.diagram.nodes, l.diagram.edges);

  it('both servers run at 125%, serve 2,000 and shed 500 each', () => {
    for (const id of ['srv1', 'srv2']) {
      expect(out.r(id).actualQPS).toBe(2500);
      expect(out.r(id).utilization).toBeCloseTo(125, 9);
      expect(out.r(id).servedQPS).toBe(2000);
      expect(out.r(id).status).toBe('critical');
    }
    says(l, '125%'); says(l, '2,000'); says(l, 'sheds the other 500');
  });

  it('21.6% of requests fail (20% shed + 2% configured)', () => {
    expect(out.r('srv1').errorRatePct).toBeCloseTo(21.6, 9);
    says(l, '21.6%');
  });

  it('latency is unbounded', () => {
    expect(out.meta.endToEndLatencyMs).toBe(Infinity);
    says(l, '∞');
  });

  it('mitigation: 2 instances per server → 62.5%', () => {
    let d = patch(l.diagram, 'srv1', { instances: 2 });
    d = patch(d, 'srv2', { instances: 2 });
    const fixed = run(d.nodes, d.edges);
    expect(fixed.r('srv1').utilization).toBeCloseTo(62.5, 9);
    expect(fixed.meta.saturated).toBe(false);
    says(l, '62.5%');
  });
});

describe('Database Write Bottleneck', () => {
  const l = lesson('database-write-bottleneck');
  const out = run(l.diagram.nodes, l.diagram.edges);

  it('2,000 QPS reach the database, 1,600 of them writes: write path 400%, read path 50%', () => {
    expect(out.r('db1').actualQPS).toBe(2000);
    expect(out.data('db1').writeUtilization).toBeCloseTo(400, 9);
    expect(out.data('db1').readUtilization).toBeCloseTo(50, 9);
    expect(out.r('db1').utilization).toBeCloseTo(400, 9);
    says(l, '1,600'); says(l, '400%'); says(l, '50% (400 reads/s against 800)'); says(l, '4×');
  });

  it('read replicas do not help a write bottleneck', () => {
    const replicas = patch(l.diagram, 'db1', { readReplicas: 3 });
    expect(run(replicas.nodes, replicas.edges).r('db1').utilization).toBeCloseTo(400, 9);
    says(l, 'Read replicas would not help');
  });

  it('mitigation: right-sizing writes to 2,000 clears the bottleneck', () => {
    const bigger = patch(l.diagram, 'db1', { maxWriteQPS: 2000 });
    expect(run(bigger.nodes, bigger.edges).r('db1').status).not.toBe('critical');
  });
});

describe('Cache Miss Storm', () => {
  const l = lesson('cache-miss-storm');
  const out = run(l.diagram.nodes, l.diagram.edges);

  it('7,600 of 8,000 fall through: reads 481%, writes 127%', () => {
    expect(out.r('cache1').actualQPS).toBe(8000);
    expect(out.r('db1').actualQPS).toBeCloseTo(7600, 9);
    expect(out.data('db1').readUtilization).toBeCloseTo(481.33, 2);
    expect(out.data('db1').writeUtilization).toBeCloseTo(126.67, 2);
    says(l, '7,600'); says(l, '7,220 reads/s'); says(l, '481%'); says(l, '380 writes/s'); says(l, '127%');
  });

  it('at a 95% hit rate the database sits at 25%', () => {
    const warm = patch(l.diagram, 'cache1', { hitRate: 95 });
    const r = run(warm.nodes, warm.edges).r('db1');
    expect(Math.round(r.utilization)).toBe(25);
    expect(r.status).toBe('healthy');
    says(l, 'sits at 25%');
  });

  it('4 read replicas cover the reads, but the writes still overload the primary', () => {
    const replicas = patch(l.diagram, 'db1', { readReplicas: 4 });
    const out4 = run(replicas.nodes, replicas.edges);
    expect(out4.data('db1').readUtilization).toBeLessThan(100);
    expect(out4.data('db1').writeUtilization).toBeGreaterThan(100);
    expect(out4.r('db1').status).toBe('critical');
    says(l, '4 replicas cover the 7,220 reads/s');
  });
});

describe('Load Balancer Saturation', () => {
  const l = lesson('load-balancer-saturation');
  const out = run(l.diagram.nodes, l.diagram.edges);

  it('the LB runs at 167%, sheds 40% and passes on 6,000; servers idle at 37.5%', () => {
    expect(out.r('lb1').utilization).toBeCloseTo(166.67, 2);
    expect(out.r('lb1').errorRatePct).toBeCloseTo(40, 9);
    expect(out.r('lb1').forwardedQPS).toBe(6000);
    expect(out.r('srv1').utilization).toBeCloseTo(37.5, 9);
    expect(out.r('srv1').status).toBe('healthy');
    says(l, '167%'); says(l, '40% errors'); says(l, '37.5%');
  });

  it('adding server instances does not improve anything', () => {
    let d = patch(l.diagram, 'srv1', { instances: 4 });
    d = patch(d, 'srv2', { instances: 4 });
    const more = run(d.nodes, d.edges);
    expect(more.r('lb1').status).toBe('critical');
    expect(more.meta.successRatePct).toBeCloseTo(out.meta.successRatePct, 9);
    says(l, 'Adding more server instances does not improve performance at all');
  });
});

describe('Queue Consumer Lag', () => {
  const l = lesson('queue-consumer-lag');
  const out = run(l.diagram.nodes, l.diagram.edges);

  it('the queue runs at 200% and its backlog grows by 4,000 msg/s — no errors', () => {
    expect(out.r('q1').utilization).toBeCloseTo(200, 9);
    expect(out.r('q1').backlogQPS).toBeCloseTo(4000, 9);
    expect(out.r('q1').errorRatePct).toBe(0);
    says(l, '200%'); says(l, '4,000 messages accumulate'); says(l, 'grows at 4,000 msg/s');
  });

  it('each consumer server sees only the drained 2,000 msg/s', () => {
    expect(out.r('c1').actualQPS).toBeCloseTo(2000, 9);
    expect(out.r('c1').status).toBe('warning');
    says(l, '2,000 msg/s each');
  });

  it('4 consumers only match ingestion (100%); 5 clear the backlog', () => {
    const four = patch(l.diagram, 'q1', { consumers: 4 });
    expect(run(four.nodes, four.edges).r('q1').utilization).toBeCloseTo(100, 9);
    const five = patch(l.diagram, 'q1', { consumers: 5 });
    expect(run(five.nodes, five.edges).r('q1').backlogQPS).toBe(0);
    says(l, '4 consumers only match ingestion (100%)');
  });
});

describe('Retry Storm (lesson)', () => {
  const l = lesson('retry-storm');
  const out = run(l.diagram.nodes, l.diagram.edges);
  const noRetries = (() => {
    const d = { ...l.diagram, edges: l.diagram.edges.map(e => ({ ...e, data: { distributionMode: 'auto' as const } })) };
    return run(d.nodes, d.edges);
  })();

  it('without retries the database runs at 92% with 4,900 QPS against 5,333', () => {
    expect(noRetries.r('db1').actualQPS).toBe(4900);
    expect(noRetries.r('db1').capacity).toBeCloseTo(5333.33, 2);
    expect(Math.round(noRetries.r('db1').utilization)).toBe(92);
    says(l, '92%'); says(l, '4,900'); says(l, '5,333');
  });

  it('at the configured 20% each request costs 1.25 attempts → 115%', () => {
    const attempts = expectedAttempts(0.2, 3);
    expect(attempts).toBeCloseTo(1.25, 2);
    expect(Math.round((4900 * attempts) / (16000 / 3) * 100)).toBe(115);
    says(l, '1.25'); says(l, '115%');
  });

  it('the retry loop settles at ~10,700 QPS: 2.2×, 200%, 60% of attempts failing', () => {
    const d = out.r('db1');
    expect(out.meta.converged).toBe(true);
    expect(Math.round(d.actualQPS / 100) * 100).toBe(10_700);
    expect(d.actualQPS / 4900).toBeCloseTo(2.2, 1);
    expect(Math.round(d.utilization)).toBe(200);
    expect(Math.round(d.errorRatePct)).toBe(60);
    expect(d.estimatedLatencyMs).toBe(Infinity);
    says(l, '10,700'); says(l, '2.2×'); says(l, '200%'); says(l, '60% of attempts'); says(l, 'triple');
  });
});

describe('templates', () => {
  const t = (name: string) => TEMPLATES.find(x => x.name === name)!;

  it('Retry Storm: 1.18× at the configured 15%, settling at ~9,500 QPS (1.94×, 178%)', () => {
    const tpl = t('Retry Storm');
    const out = run(tpl.nodes, tpl.edges);
    expect(expectedAttempts(0.15, 3)).toBeCloseTo(1.18, 2);
    expect(Math.round(out.r('db1').actualQPS / 100) * 100).toBe(9500);
    expect(out.r('db1').actualQPS / 4900).toBeCloseTo(1.94, 2);
    expect(Math.round(out.r('db1').utilization)).toBe(178);
    expect(tpl.description).toContain('1.9×');
    expect(tpl.description).toContain('178%');
    const calm = run(tpl.nodes, tpl.edges.map(e => ({ ...e, data: { distributionMode: 'auto' as const } })));
    expect(Math.round(calm.r('db1').utilization)).toBe(92);
  });

  it('starter templates have no bottleneck (Retry Storm is the deliberate exception)', () => {
    for (const tpl of TEMPLATES.filter(x => x.name !== 'Retry Storm')) {
      const out = run(tpl.nodes, tpl.edges);
      expect(out.results.filter(x => x.status === 'critical'), tpl.name).toEqual([]);
      expect(out.meta.converged).toBe(true);
    }
  });

  it('Simple Web App: 2 instances × 800 give the server 62.5% headroom-wise', () => {
    const out = run(t('Simple Web App').nodes, t('Simple Web App').edges);
    expect(out.r('srv1').utilization).toBeCloseTo(62.5, 9);
  });
});
