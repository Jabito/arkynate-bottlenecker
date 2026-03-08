import type { Node, Edge } from '@xyflow/react';
import type { NodeData, AnalysisResult, NodeStatus, EdgeData } from '../types';

function getCapacity(data: NodeData): number {
  switch (data.kind) {
    case 'loadGenerator': return data.outputQPS;
    case 'loadBalancer':  return data.maxQPS;
    case 'server':        return data.maxQPS;
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
    case 'loadGenerator': return incomingQPS;
    case 'cache': return incomingQPS * (1 - data.hitRate / 100);
    default: return incomingQPS;
  }
}

const DEFAULT_LATENCY: Partial<Record<NodeData['kind'], number>> = {
  loadBalancer: 2,
  server:       50,
  database:     15,
  cache:        1,
  queue:        5,
};

export function analyzeGraph(
  nodes: Node<NodeData>[],
  edges: Edge[],
  qpsMultiplier = 1,
): { updatedNodes: Node<NodeData>[]; results: AnalysisResult[]; edgeFlows: Map<string, number> } {
  const inEdgeIds  = new Map<string, string[]>();
  const outEdgeIds = new Map<string, string[]>();
  const edgeById   = new Map<string, Edge>();
  const inNodes    = new Map<string, string[]>();
  const outNodes   = new Map<string, string[]>();

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

  const nodeMap      = new Map<string, Node<NodeData>>(nodes.map(n => [n.id, n]));
  const actualQPSMap = new Map<string, number>();
  const edgeQPS      = new Map<string, number>();

  // Pass 1: propagate QPS with retry amplification
  order.forEach(id => {
    const node = nodeMap.get(id);
    if (!node) return;
    const data = node.data;

    let incoming = 0;
    if (data.kind === 'loadGenerator') {
      incoming = data.outputQPS * qpsMultiplier;
    } else {
      (inEdgeIds.get(id) ?? []).forEach(eid => {
        incoming += edgeQPS.get(eid) ?? 0;
      });
    }
    actualQPSMap.set(id, incoming);

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

    // Apply retry amplification: amplifiedQPS = base × (1 + (targetErrorRate/100) × retryCount)
    const withRetry = (eid: string, baseVal: number): number => {
      const e = edgeById.get(eid);
      const edgeData = e?.data as EdgeData | undefined;
      const retryCount = edgeData?.retryCount ?? 0;
      if (retryCount === 0) return baseVal;
      const targetNode = e ? nodeMap.get(e.target) : undefined;
      const targetErrorRate = (targetNode?.data as { errorRate?: number } | undefined)?.errorRate ?? 0;
      return baseVal * (1 + (targetErrorRate / 100) * retryCount);
    };

    let remaining = outgoing;

    absoluteEdges.forEach(eid => {
      const d = edgeById.get(eid)?.data as EdgeData | undefined;
      const val = Math.min(d?.distributionValue ?? 0, remaining);
      edgeQPS.set(eid, withRetry(eid, val));
      remaining -= val;
    });

    percentEdges.forEach(eid => {
      const d = edgeById.get(eid)?.data as EdgeData | undefined;
      const val = outgoing * ((d?.distributionValue ?? 0) / 100);
      edgeQPS.set(eid, withRetry(eid, val));
      remaining -= val;
    });

    if (autoEdges.length > 0) {
      const perAuto = Math.max(0, remaining) / autoEdges.length;
      autoEdges.forEach(eid => edgeQPS.set(eid, withRetry(eid, perAuto)));
    }
  });

  // Pass 2: compute error rates, latency, cumulative latency in topological order
  const cumulativeLatMap   = new Map<string, number>();
  const utilizationMap     = new Map<string, number>();
  const statusMap          = new Map<string, NodeStatus>();
  const errorRatePctMap    = new Map<string, number>();
  const errorQPSMap        = new Map<string, number>();
  const estimatedLatMap    = new Map<string, number>();

  order.forEach(id => {
    const node = nodeMap.get(id);
    if (!node) return;
    const actual   = actualQPSMap.get(id) ?? 0;
    const capacity = getCapacity(node.data);
    const util     = capacity > 0 ? (actual / capacity) * 100 : 0;
    utilizationMap.set(id, util);
    statusMap.set(id, toStatus(util));

    const configuredErrorRate = (node.data as { errorRate?: number }).errorRate ?? 0;
    const overloadError       = Math.max(0, util - 100);
    const totalErrorRatePct   = Math.min(100, configuredErrorRate + overloadError);
    errorRatePctMap.set(id, totalErrorRatePct);
    errorQPSMap.set(id, actual * totalErrorRatePct / 100);

    const baseLatencyMs     = (node.data as { baseLatencyMs?: number }).baseLatencyMs ?? (DEFAULT_LATENCY[node.data.kind] ?? 0);
    const utilFraction      = util / 100;
    const effectiveLatency  = baseLatencyMs > 0
      ? baseLatencyMs / (1 - Math.min(utilFraction, 0.999))
      : 0;
    estimatedLatMap.set(id, effectiveLatency);

    let maxPredLat = 0;
    (inNodes.get(id) ?? []).forEach(predId => {
      const predLat = cumulativeLatMap.get(predId) ?? 0;
      if (predLat > maxPredLat) maxPredLat = predLat;
    });
    cumulativeLatMap.set(id, maxPredLat + effectiveLatency);
  });

  const results: AnalysisResult[] = [];
  const updatedNodes = nodes.map(n => {
    const actual             = actualQPSMap.get(n.id) ?? 0;
    const capacity           = getCapacity(n.data);
    const utilization        = utilizationMap.get(n.id) ?? 0;
    const status             = statusMap.get(n.id) ?? 'healthy';
    const errorQPS           = errorQPSMap.get(n.id) ?? 0;
    const errorRatePct       = errorRatePctMap.get(n.id) ?? 0;
    const estimatedLatencyMs = estimatedLatMap.get(n.id) ?? 0;
    const cumulativeLatencyMs = cumulativeLatMap.get(n.id) ?? 0;

    results.push({
      nodeId: n.id, label: n.data.label, kind: n.data.kind,
      actualQPS: actual, capacity, utilization, status,
      errorQPS, errorRatePct, estimatedLatencyMs, cumulativeLatencyMs,
    });

    return {
      ...n,
      data: {
        ...n.data,
        actualQPS: actual,
        status,
        errorRatePct,
        estimatedLatencyMs,
      } as NodeData,
    };
  });

  const statusOrder: Record<NodeStatus, number> = { critical: 0, near: 1, warning: 2, healthy: 3 };
  results.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  return { updatedNodes, results, edgeFlows: edgeQPS };
}
