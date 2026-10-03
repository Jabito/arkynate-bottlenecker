import { describe, expect, it } from 'vitest';
import { LESSONS } from '../data/lessons';
import { run, patch } from '../engine/testkit';
import { applySolution, evaluateCondition, lessonComplete, type LessonSnapshot } from './lessonChecks';
import type { Template } from '../data/templates';

/*
 * Interactive lessons (#100): every lesson's success check is false on its starting diagram
 * and true once its documented fix is applied, and the obvious shortcuts don't pass.
 */

const snapshot = (d: Pick<Template, 'nodes' | 'edges'>): LessonSnapshot => {
  const out = run(d.nodes, d.edges);
  return { nodes: out.updatedNodes, results: out.results, meta: out.meta };
};

describe.each(LESSONS.map(l => [l.title, l] as const))('%s', (_title, lesson) => {
  const start = snapshot(lesson.diagram);
  const fixed = snapshot(applySolution(lesson.diagram, lesson.solution));

  it('has a goal, 2–4 steps and at least one check', () => {
    expect(lesson.goal.length).toBeGreaterThan(20);
    expect(lesson.steps.length).toBeGreaterThanOrEqual(2);
    expect(lesson.steps.length).toBeLessThanOrEqual(4);
    expect(lesson.checks.length).toBeGreaterThan(0);
    expect(lesson.solution.length).toBeGreaterThan(0);
  });

  it('is not complete on the starting diagram', () => {
    expect(lessonComplete(lesson, start)).toBe(false);
    expect(lesson.checks.some(c => !evaluateCondition(c.when, start).ok)).toBe(true);
  });

  it('is complete once the documented fix is applied, with every step ticked', () => {
    for (const c of lesson.checks) expect(evaluateCondition(c.when, fixed), c.label).toMatchObject({ ok: true });
    for (const s of lesson.steps) {
      if (s.check) expect(evaluateCondition(s.check, fixed), s.text).toMatchObject({ ok: true });
    }
    expect(lessonComplete(lesson, fixed)).toBe(true);
  });

  it('cannot be passed by turning the load down', () => {
    const quiet = lesson.diagram.nodes
      .filter(n => n.data.kind === 'loadGenerator')
      .reduce((d, n) => patch(d, n.id, { outputQPS: 1 }), lesson.diagram);
    expect(lessonComplete(lesson, snapshot(quiet))).toBe(false);
  });

  it('cannot be passed by deleting the bottleneck', () => {
    const critical = start.results.filter(r => r.status === 'critical').map(r => r.nodeId);
    expect(critical.length).toBeGreaterThan(0);
    const nodes = lesson.diagram.nodes.filter(n => !critical.includes(n.id));
    const edges = lesson.diagram.edges.filter(e => !critical.includes(e.source) && !critical.includes(e.target));
    expect(lessonComplete(lesson, snapshot({ nodes, edges }))).toBe(false);
  });

  it('every condition names a node that exists in the diagram', () => {
    const ids = new Set(lesson.diagram.nodes.map(n => n.id));
    for (const c of [...lesson.steps.flatMap(s => (s.check ? [s.check] : [])), ...lesson.checks.map(c => c.when)]) {
      if (c.kind === 'below') expect(ids.has(c.nodeId), c.nodeId).toBe(true);
    }
  });
});

describe('lesson copy matches the engine', () => {
  const byId = (id: string) => LESSONS.find(l => l.id === id)!;

  it('Server CPU: success goes from 78.4% to 98%', () => {
    const l = byId('server-cpu-saturation');
    expect(snapshot(l.diagram).meta!.successRatePct).toBeCloseTo(78.4, 9);
    expect(snapshot(applySolution(l.diagram, l.solution)).meta!.successRatePct).toBeCloseTo(98, 9);
    expect(l.steps.map(s => s.text).join(' ')).toContain('78.4% to 98%');
  });

  it('Queue: 5 consumers alone push 4,000 msg/s onto each consumer server', () => {
    const l = byId('queue-consumer-lag');
    const five = snapshot(applySolution(l.diagram, l.solution.slice(0, 1)));
    expect(five.results.find(r => r.nodeId === 'c1')!.actualQPS).toBeCloseTo(4000, 9);
    expect(evaluateCondition({ kind: 'noCritical' }, five).ok).toBe(false);
  });

  it('Retry Storm: no retries → DB 92% but success 78.4%; fixing the error rate → ≥ 95%', () => {
    const l = byId('retry-storm');
    const noRetries = snapshot(applySolution(l.diagram, l.solution.slice(0, 2)));
    const db = noRetries.results.find(r => r.nodeId === 'db1')!;
    expect(Math.round(db.utilization)).toBe(92);
    expect(noRetries.meta!.successRatePct).toBeCloseTo(78.4, 9);
    expect(lessonComplete(l, noRetries)).toBe(false);
    // Fixing only the root cause (retries left at 3) also completes the lesson.
    expect(lessonComplete(l, snapshot(applySolution(l.diagram, l.solution.slice(2))))).toBe(true);
    const text = l.steps.map(s => s.text).join(' ');
    expect(text).toContain('92%');
    expect(text).toContain('78.4%');
  });

  it('Cache Miss Storm: 4 replicas tick the read step but not the lesson', () => {
    const l = byId('cache-miss-storm');
    const replicas = snapshot(patch(l.diagram, 'db1', { readReplicas: 4 }));
    expect(evaluateCondition(l.steps[1].check!, replicas).ok).toBe(true);
    expect(lessonComplete(l, replicas)).toBe(false);
  });

  it('Database write: read replicas do not complete it', () => {
    const l = byId('database-write-bottleneck');
    expect(lessonComplete(l, snapshot(patch(l.diagram, 'db1', { readReplicas: 3 })))).toBe(false);
  });

  it('Load Balancer: more server instances do not complete it', () => {
    const l = byId('load-balancer-saturation');
    let d = patch(l.diagram, 'srv1', { instances: 4 });
    d = patch(d, 'srv2', { instances: 4 });
    expect(lessonComplete(l, snapshot(d))).toBe(false);
  });
});

describe('evaluateCondition', () => {
  const empty: LessonSnapshot = { nodes: [], results: [], meta: null };
  it('fails every condition on an empty canvas', () => {
    expect(evaluateCondition({ kind: 'noCritical' }, empty).ok).toBe(false);
    expect(evaluateCondition({ kind: 'below', nodeId: 'x', pct: 100 }, empty)).toEqual({ ok: false, now: 'missing' });
    expect(evaluateCondition({ kind: 'successAtLeast', pct: 1 }, empty).ok).toBe(false);
    expect(evaluateCondition({ kind: 'loadAtLeast', qps: 1 }, empty).ok).toBe(false);
  });

  it('reports the current value', () => {
    const l = LESSONS.find(x => x.id === 'database-write-bottleneck')!;
    const s = snapshot(l.diagram);
    expect(evaluateCondition({ kind: 'below', nodeId: 'db1', metric: 'writeUtilization', pct: 100 }, s).now).toBe('400%');
    expect(evaluateCondition({ kind: 'below', nodeId: 'db1', metric: 'readUtilization', pct: 100 }, s)).toEqual({ ok: true, now: '50%' });
    expect(evaluateCondition({ kind: 'noCritical' }, s).now).toBe('1 critical');
    expect(evaluateCondition({ kind: 'loadAtLeast', qps: 2000 }, s)).toEqual({ ok: true, now: '2.0k/s' });
  });

  it('applySolution refuses a patch for a missing node or edge', () => {
    const l = LESSONS[0];
    expect(() => applySolution(l.diagram, [{ nodeId: 'nope', data: {} }])).toThrow(/nope/);
    expect(() => applySolution(l.diagram, [{ edgeId: 'nope', data: {} }])).toThrow(/nope/);
  });
});
