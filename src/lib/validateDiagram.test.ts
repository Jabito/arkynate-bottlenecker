import { describe, it, expect } from 'vitest';
import { validateDiagram } from './validateDiagram';
import { TEMPLATES } from '../data/templates';
import { NODE_DEFAULTS } from '../data/nodeDefaults';

const SERVER_DEFAULTS = NODE_DEFAULTS.server() as Record<string, unknown>;

const server = (id: string, data: Record<string, unknown> = {}) => ({
  id, type: 'server', position: { x: 0, y: 0 },
  data: { kind: 'server', label: 'API', maxQPS: 500, instances: 1, ...data },
});
const lg = (id: string) => ({ id, type: 'loadGenerator', position: { x: 0, y: 0 }, data: { kind: 'loadGenerator', label: 'LG', outputQPS: 100 } });

describe('validateDiagram', () => {
  it('returns empty for non-object and non-array input', () => {
    for (const bad of [null, undefined, 42, 'x', [], { nodes: 'nope' }, { nodes: {}, edges: 5 }]) {
      const v = validateDiagram(bad);
      expect(v.nodes).toEqual([]);
      expect(v.edges).toEqual([]);
    }
  });

  it('drops style, className and unknown props (CSS injection)', () => {
    const v = validateDiagram({
      nodes: [{
        ...server('a'),
        style: { position: 'fixed', inset: 0, background: 'url(https://evil.example/beacon)' },
        className: 'evil',
        hidden: true,
        data: { kind: 'server', label: 'A', maxQPS: 500, instances: 1, onClick: 'x', __proto__: { polluted: true } },
      }],
    });
    const n = v.nodes[0] as unknown as Record<string, unknown>;
    expect(Object.keys(n).sort()).toEqual(['data', 'id', 'position', 'type']);
    expect(Object.keys(n.data as object)).not.toContain('onClick');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('drops unknown kinds and nodes without data kind or id', () => {
    const v = validateDiagram({ nodes: [{ id: 'g', type: 'gateway', data: { kind: 'gateway' } }, { type: 'server', data: {} }, 7] });
    expect(v.nodes).toHaveLength(0);
    expect(v.dropped.length).toBe(3);
  });

  it('resets NaN and missing numbers to defaults and clamps out-of-range values', () => {
    const v = validateDiagram({ nodes: [server('a', { maxQPS: 'NaN', instances: -4, errorRate: 400 }), { id: 'b', type: 'server', position: {}, data: { kind: 'server' } }] });
    const a = v.nodes[0].data as Record<string, unknown>;
    expect(a.maxQPS).toBe(SERVER_DEFAULTS.maxQPS);
    expect(a.instances).toBe(1); // clamped to min
    expect(a.errorRate).toBe(100);
    const b = v.nodes[1].data as Record<string, unknown>;
    expect(b.maxQPS).toBe(SERVER_DEFAULTS.maxQPS);
    expect(b.instances).toBe(SERVER_DEFAULTS.instances);
    expect(b.label).toBe(SERVER_DEFAULTS.label);
    expect(v.nodes[1].position).toEqual({ x: 0, y: 0 });
  });

  it('strips computed analysis keys', () => {
    const v = validateDiagram({ nodes: [server('a', { status: 'critical', actualQPS: 9999, estimatedLatencyMs: 49999 })] });
    expect(v.nodes[0].data).not.toHaveProperty('status');
    expect(v.nodes[0].data).not.toHaveProperty('actualQPS');
  });

  it('drops dangling edges, edges into load generators and duplicates; sanitises edge data', () => {
    const v = validateDiagram({
      nodes: [lg('l1'), lg('l2'), server('s')],
      edges: [
        { id: 'e1', source: 'l1', target: 's', style: { stroke: 'red' }, data: { distributionMode: 'percent', distributionValue: 250, computedQPS: 5 } },
        { id: 'e1', source: 'l1', target: 's' },
        { id: 'e2', source: 'l1', target: 'ghost' },
        { id: 'e3', source: 'l1', target: 'l2' },
        { id: 'e4', source: 's', target: 's', data: { distributionMode: 'bogus', retryCount: 99 } },
      ],
    });
    expect(v.edges.map(e => e.id)).toEqual(['e1', 'e4']);
    expect(v.edges[0]).not.toHaveProperty('style');
    expect(v.edges[0].data).toEqual({ distributionMode: 'percent', distributionValue: 100 });
    expect(v.edges[1].data).toEqual({ distributionMode: 'auto', retryCount: 10 });
    expect(v.dropped).toHaveLength(3);
  });

  it('accepts old saves with strategy and without optional fields', () => {
    const v = validateDiagram({ nodes: [{ id: 'lb', type: 'loadBalancer', position: { x: 1, y: 2 }, data: { kind: 'loadBalancer', label: 'LB', maxQPS: 1000, strategy: 'weighted' } }] });
    expect(v.nodes[0].data).toMatchObject({ kind: 'loadBalancer', maxQPS: 1000, strategy: 'weighted' });
    expect(v.dropped).toEqual([]);
  });

  it('passes every shipped template unchanged in substance', () => {
    for (const t of TEMPLATES) {
      const v = validateDiagram(t);
      expect(v.nodes).toHaveLength(t.nodes.length);
      expect(v.edges).toHaveLength(t.edges.length);
    }
  });
});
