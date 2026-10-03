import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges, addEdge } from './flowChanges';

const n = (id: string): Node => ({ id, position: { x: 0, y: 0 }, data: {} });

describe('flowChanges (local xyflow equivalents)', () => {
  it('applies remove, select, position, dimensions, replace and add', () => {
    const nodes = [n('a'), n('b'), n('c')];
    const out = applyNodeChanges([
      { type: 'remove', id: 'a' },
      { type: 'select', id: 'b', selected: true },
      { type: 'position', id: 'b', position: { x: 5, y: 6 }, dragging: true },
      { type: 'dimensions', id: 'c', dimensions: { width: 10, height: 20 } },
      { type: 'add', item: n('d') },
      { type: 'add', item: n('e'), index: 0 },
    ], nodes);
    expect(out.map(x => x.id)).toEqual(['e', 'b', 'c', 'd']);
    expect(out[1]).toMatchObject({ selected: true, position: { x: 5, y: 6 }, dragging: true });
    expect(out[2].measured).toEqual({ width: 10, height: 20 });
    expect(nodes[1].selected).toBeUndefined(); // inputs are not mutated
    const unchanged = applyNodeChanges([{ type: 'select', id: 'zzz', selected: true }], nodes);
    expect(unchanged[0]).toBe(nodes[0]);
    expect(applyNodeChanges([{ type: 'replace', id: 'a', item: { ...n('a'), data: { v: 1 } } }], nodes)[0].data).toEqual({ v: 1 });
  });

  it('addEdge creates an id, drops null handles and ignores duplicates', () => {
    const edges = addEdge({ source: 'a', target: 'b', sourceHandle: null, targetHandle: null }, []);
    expect(edges).toHaveLength(1);
    expect(edges[0].id).toBe('xy-edge__a-b');
    expect(edges[0]).not.toHaveProperty('sourceHandle');
    expect(addEdge({ source: 'a', target: 'b', sourceHandle: null, targetHandle: null }, edges)).toBe(edges);
    const removed = applyEdgeChanges([{ type: 'remove', id: 'xy-edge__a-b' }], edges as Edge[]);
    expect(removed).toEqual([]);
  });
});
