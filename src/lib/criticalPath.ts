import type { Edge } from '@xyflow/react';
import type { AnalysisResult, EdgeData } from '../types';

/**
 * Ids of the traffic-carrying edges along the critical path (#79), or an empty set when the
 * path doesn't run through a critical node: a healthy diagram has a slowest path, but no bottleneck to show.
 */
export function criticalPathEdgeIds(edges: Edge[], path: string[] | undefined, results: AnalysisResult[]): Set<string> {
  const ids = new Set<string>();
  if (!path || path.length < 2) return ids;
  const critical = new Set(results.filter(r => r.status === 'critical').map(r => r.nodeId));
  if (!path.some(id => critical.has(id))) return ids;
  const next = new Map(path.slice(0, -1).map((id, i) => [id, path[i + 1]]));
  for (const e of edges) {
    if (next.get(e.source) === e.target && ((e.data as EdgeData | undefined)?.computedQPS ?? 0) > 0) ids.add(e.id);
  }
  return ids;
}
