import type { Node, Edge } from '@xyflow/react';
import type { NodeData } from '../types';
import { analyzeGraph } from './analyze';

/** Load multipliers beyond this count as "never saturates". */
export const STRESS_LIMIT = 10_000;

/**
 * Largest load multiplier at which no traffic-carrying node is at or over capacity
 * (#96). Found by doubling then bisecting, because retries and throttling make load
 * non-linear. Infinity when nothing saturates up to STRESS_LIMIT, or nothing flows.
 */
export function maxSustainableMultiplier(nodes: Node<NodeData>[], edges: Edge[]): number {
  const saturatedAt = (m: number) => analyzeGraph(nodes, edges, m).meta.saturated;
  let lo = 0, hi = 1;
  if (!saturatedAt(1)) {
    lo = 1; hi = 2;
    while (!saturatedAt(hi)) {
      if (hi >= STRESS_LIMIT) return Infinity;
      lo = hi; hi *= 2;
    }
  }
  for (let i = 0; i < 40 && hi - lo > 1e-4 * hi; i++) {
    const mid = (lo + hi) / 2;
    if (saturatedAt(mid)) hi = mid; else lo = mid;
  }
  return lo;
}
