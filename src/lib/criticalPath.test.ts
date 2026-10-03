import { describe, expect, it } from 'vitest';
import { useDiagramStore } from '../store/diagramStore';
import { LESSONS } from '../data/lessons';
import { TEMPLATES } from '../data/templates';
import { criticalPathEdgeIds } from './criticalPath';
import { toPortable } from './portable';

const st = () => useDiagramStore.getState();
const pathEdges = () => criticalPathEdgeIds(st().edges, st().analysisMeta?.criticalPath, st().analysisResults);

describe('critical path on the canvas (#79)', () => {
  it('marks the edges into and out of the bottleneck along the slowest path', () => {
    st().loadLesson(LESSONS.find(l => l.id === 'cache-miss-storm')!);
    expect(st().analysisMeta!.criticalPath).toEqual(['lg1', 'lb1', 'srv1', 'cache1', 'db1']);
    expect([...pathEdges()].sort()).toEqual(['e1', 'e2', 'e4', 'e6']);
  });

  it('marks nothing when the path has no critical node', () => {
    for (const t of TEMPLATES.filter(x => x.name !== 'Retry Storm')) {
      st().loadTemplate(t);
      expect(st().analysisMeta!.criticalPath.length, t.name).toBeGreaterThan(1);
      expect(pathEdges().size, t.name).toBe(0);
    }
  });

  it('clears once the bottleneck is fixed', () => {
    st().loadLesson(LESSONS.find(l => l.id === 'load-balancer-saturation')!);
    expect(pathEdges().size).toBe(2);
    st().updateNodeData('lb1', { maxQPS: 12000 });
    expect(pathEdges().size).toBe(0);
  });

  it('ignores edges that carry no traffic and an empty or one-node path', () => {
    st().loadLesson(LESSONS.find(l => l.id === 'server-cpu-saturation')!);
    const idle = st().edges.map(e => ({ ...e, data: { ...e.data, computedQPS: 0 } }));
    expect(criticalPathEdgeIds(idle, st().analysisMeta!.criticalPath, st().analysisResults).size).toBe(0);
    expect(criticalPathEdgeIds(st().edges, [], st().analysisResults).size).toBe(0);
    expect(criticalPathEdgeIds(st().edges, ['srv1'], st().analysisResults).size).toBe(0);
  });

  it('a highlighted edge saves and shares without its class', () => {
    const marked = st().edges.map(e => ({ ...e, className: 'bn-critical-path' }));
    for (const e of toPortable(st().nodes, marked).edges) expect(e).not.toHaveProperty('className');
  });
});
