import type { Node, Edge } from '@xyflow/react';
import type { NodeData, AnalysisResult, NodeStatus, EdgeData } from '../types';

function getCapacity(data: NodeData): number {
  switch (data.kind) {
    case 'loadGenerator': return data.outputQPS;
    case 'loadBalancer':  return data.maxQPS;
    case 'server':        return data.maxQPS; // maxQPS is total capacity
    case 'database':      return data.maxReadQPS + data.maxWriteQPS;
    case 'cache':         return data.maxQPS;
    case 'queue':         return data.maxThroughput * data.consumers;
  }
}

function toStatus(utilization: number): NodeStatus {
  if (utilization > 100) return 'critical';
  if (utilization > 90)  return 'near';
  if (utilization > 70)  return 'warning';
  return 'healthy';
}

function calcOutgoingQPS(data: NodeData, incomingQPS: number): number {
  switch (data.kind) {
    case 'loadGenerator': return data.outputQPS;
    case 'cache': return incomingQPS * (1 - data.hitRate / 100);
    default: return incomingQPS;
  }
}

export function analyzeGraph(
  nodes: Node<NodeData>[],
  edges: Edge[]
): { updatedNodes: Node<NodeData>[]; results: AnalysisResult[] } {
  // Build adjacency maps indexed by edge ID for weighted distribution
  const inEdgeIds  = new Map<string, string[]>(); // nodeId → incoming edgeIds
  const outEdgeIds = new Map<string, string[]>(); // nodeId → outgoing edgeIds
  const edgeById   = new Map<string, Edge>();

  // Also track node→node adjacency for topological sort
  const inNodes  = new Map<string, string[]>();
  const outNodes = new Map<string, string[]>();

  nodes.forEach(n => {
    inEdgeIds.set(n.id, []);
    outEdgeIds.set(n.id, []);
    inNodes.set(n.id, []);
    outNodes.set(n.id, []);
  });

  edges.forEach(e => {
    edgeById.set(e.id, e);
    inEdgeIds.get(e.target)?.push(e.id);
    outEdgeIds.get(e.source)?.push(e.id);
    inNodes.get(e.target)?.push(e.source);
    outNodes.get(e.source)?.push(e.target);
  });

  // Kahn's topological sort
  const inDegree = new Map<string, number>();
  nodes.forEach(n => inDegree.set(n.id, (inNodes.get(n.id) ?? []).length));
  const queue: string[] = [];
  nodes.forEach(n => { if (inDegree.get(n.id) === 0) queue.push(n.id); });
  const order: string[] = [];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    order.push(id);
    (outNodes.get(id) ?? []).forEach(t => {
      const d = (inDegree.get(t) ?? 1) - 1;
      inDegree.set(t, d);
      if (d === 0) queue.push(t);
    });
  }
  nodes.forEach(n => { if (!visited.has(n.id)) order.push(n.id); });

  // Propagate load with per-edge QPS tracking
  const actualQPSMap = new Map<string, number>();
  const edgeQPS      = new Map<string, number>();
  const nodeMap      = new Map<string, Node<NodeData>>(nodes.map(n => [n.id, n]));

  order.forEach(id => {
    const node = nodeMap.get(id);
    if (!node) return;
    const data = node.data;

    // Compute incoming QPS from sum of all incoming edge flows
    let incoming = 0;
    if (data.kind === 'loadGenerator') {
      incoming = data.outputQPS;
    } else {
      (inEdgeIds.get(id) ?? []).forEach(eid => {
        incoming += edgeQPS.get(eid) ?? 0;
      });
    }
    actualQPSMap.set(id, incoming);

    // Distribute outgoing QPS across outgoing edges by distribution mode
    const outgoing     = calcOutgoingQPS(data, incoming);
    const myOutEdgeIds = outEdgeIds.get(id) ?? [];
    if (myOutEdgeIds.length === 0) return;

    const absoluteEdges: string[] = [];
    const percentEdges:  string[] = [];
    const autoEdges:     string[] = [];

    myOutEdgeIds.forEach(eid => {
      const d = edgeById.get(eid)?.data as EdgeData | undefined;
      const mode = d?.distributionMode ?? 'auto';
      if (mode === 'absolute') absoluteEdges.push(eid);
      else if (mode === 'percent') percentEdges.push(eid);
      else autoEdges.push(eid);
    });

    let remaining = outgoing;

    absoluteEdges.forEach(eid => {
      const d = edgeById.get(eid)?.data as EdgeData | undefined;
      const val = Math.min(d?.distributionValue ?? 0, remaining);
      edgeQPS.set(eid, val);
      remaining -= val;
    });

    percentEdges.forEach(eid => {
      const d = edgeById.get(eid)?.data as EdgeData | undefined;
      const val = outgoing * ((d?.distributionValue ?? 0) / 100);
      edgeQPS.set(eid, val);
      remaining -= val;
    });

    if (autoEdges.length > 0) {
      const perAuto = Math.max(0, remaining) / autoEdges.length;
      autoEdges.forEach(eid => edgeQPS.set(eid, perAuto));
    }
  });

  const results: AnalysisResult[] = [];
  const updatedNodes = nodes.map(n => {
    const actual      = actualQPSMap.get(n.id) ?? 0;
    const capacity    = getCapacity(n.data);
    const utilization = capacity > 0 ? (actual / capacity) * 100 : 0;
    const status      = toStatus(utilization);
    results.push({ nodeId: n.id, label: n.data.label, kind: n.data.kind, actualQPS: actual, capacity, utilization, status });
    return { ...n, data: { ...n.data, actualQPS: actual, status } as NodeData };
  });

  const statusOrder: Record<NodeStatus, number> = { critical: 0, near: 1, warning: 2, healthy: 3 };
  results.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  return { updatedNodes, results };
}
