import type { Node, Edge } from '@xyflow/react';
import type { NodeData, EdgeData } from '../types';
import { COMPUTED_NODE_KEYS } from '../types';

type AppNode = Node<NodeData>;

/** The saved form of a node: id, type, position and config data. No analysis output, no React Flow runtime fields. */
export interface PortableNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: NodeData;
}

export interface PortableEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data: EdgeData;
}

const COMPUTED = new Set<string>(COMPUTED_NODE_KEYS);

/** Node data without the keys the engine writes. */
export function stripComputed(data: NodeData): NodeData {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!COMPUTED.has(k) && v !== undefined) out[k] = v;
  }
  return out as NodeData;
}

const round = (n: number) => Math.round(n * 10) / 10;

export function toPortableNode(n: AppNode): PortableNode {
  return {
    id: n.id,
    type: n.type ?? n.data.kind,
    position: { x: round(n.position.x), y: round(n.position.y) },
    data: stripComputed(n.data),
  };
}

export function toPortableEdge(e: Edge): PortableEdge {
  const { computedQPS: _computed, ...data } = (e.data ?? { distributionMode: 'auto' }) as EdgeData;
  void _computed;
  const out: PortableEdge = { id: e.id, source: e.source, target: e.target, data: data as EdgeData };
  if (e.sourceHandle) out.sourceHandle = e.sourceHandle;
  if (e.targetHandle) out.targetHandle = e.targetHandle;
  return out;
}

/** Strips computed keys and transient fields (measured, selected, dragging, style, className, width/height, label). */
export function toPortable(nodes: AppNode[], edges: Edge[]): { nodes: PortableNode[]; edges: PortableEdge[] } {
  return { nodes: nodes.map(toPortableNode), edges: edges.map(toPortableEdge) };
}
