import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react';

/*
 * Local equivalents of @xyflow/react's applyNodeChanges / applyEdgeChanges / addEdge
 * (same semantics, MIT-licensed originals). The store imports these instead of the
 * library so the main bundle (Home, Lessons, Components) doesn't pull in React Flow:
 * the library ships as one module whose top-level code can't be tree-shaken.
 */

type AnyChange = NodeChange | EdgeChange;
type Mutable = Record<string, unknown>;

function applyOne(change: AnyChange, el: Mutable): void {
  switch (change.type) {
    case 'select':
      el.selected = change.selected;
      break;
    case 'position':
      if (change.position !== undefined) el.position = change.position;
      if (change.dragging !== undefined) el.dragging = change.dragging;
      break;
    case 'dimensions':
      if (change.dimensions !== undefined) {
        el.measured = { ...change.dimensions };
        if (change.setAttributes === true || change.setAttributes === 'width') el.width = change.dimensions.width;
        if (change.setAttributes === true || change.setAttributes === 'height') el.height = change.dimensions.height;
      }
      if (typeof change.resizing === 'boolean') el.resizing = change.resizing;
      break;
  }
}

function applyChanges<T extends { id: string }>(changes: AnyChange[], elements: T[]): T[] {
  const byId = new Map<string, AnyChange[]>();
  const adds: Extract<AnyChange, { type: 'add' }>[] = [];
  for (const c of changes) {
    if (c.type === 'add') {
      adds.push(c);
    } else if (c.type === 'remove' || c.type === 'replace') {
      byId.set(c.id, [c]);
    } else {
      const list = byId.get(c.id);
      if (list) list.push(c);
      else byId.set(c.id, [c]);
    }
  }

  const out: T[] = [];
  for (const el of elements) {
    const list = byId.get(el.id);
    if (!list) {
      out.push(el);
      continue;
    }
    const first = list[0];
    if (first.type === 'remove') continue;
    if (first.type === 'replace') {
      out.push({ ...(first.item as unknown as T) });
      continue;
    }
    const copy = { ...el } as unknown as Mutable;
    list.forEach(c => applyOne(c, copy));
    out.push(copy as unknown as T);
  }

  for (const c of adds) {
    const item = { ...(c.item as unknown as T) };
    if (c.index !== undefined) out.splice(c.index, 0, item);
    else out.push(item);
  }
  return out;
}

export function applyNodeChanges<N extends Node>(changes: NodeChange<N>[], nodes: N[]): N[] {
  return applyChanges(changes as AnyChange[], nodes);
}

export function applyEdgeChanges<E extends Edge>(changes: EdgeChange<E>[], edges: E[]): E[] {
  return applyChanges(changes as AnyChange[], edges);
}

/** Adds an edge for a connection unless the same connection already exists. */
export function addEdge(params: Edge | (Connection & Partial<Edge>), edges: Edge[]): Edge[] {
  if (!params.source || !params.target) return edges;
  const edge: Edge = {
    ...params,
    id: 'id' in params && params.id
      ? params.id
      : `xy-edge__${params.source}${params.sourceHandle || ''}-${params.target}${params.targetHandle || ''}`,
  };
  const exists = edges.some(e =>
    e.source === edge.source && e.target === edge.target &&
    (e.sourceHandle === edge.sourceHandle || (!e.sourceHandle && !edge.sourceHandle)) &&
    (e.targetHandle === edge.targetHandle || (!e.targetHandle && !edge.targetHandle)));
  if (exists) return edges;
  if (edge.sourceHandle === null) delete edge.sourceHandle;
  if (edge.targetHandle === null) delete edge.targetHandle;
  return edges.concat(edge);
}
