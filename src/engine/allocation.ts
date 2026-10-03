import type { EdgeData } from '../types';
import { EDGE_FIELD_LIMITS, clampField } from './limits';

export type DistributionMode = EdgeData['distributionMode'];

export interface OutEdge {
  id: string;
  mode: DistributionMode;
  /** Percent 0-100 or absolute QPS cap, clamped to EDGE_FIELD_LIMITS. Unused for auto. */
  value: number;
  retryCount: number;
}

/** Clamp an edge's settings (negative percents, >100%, NaN, retries out of range). */
export function readOutEdge(id: string, data: EdgeData | undefined): OutEdge {
  const mode: DistributionMode =
    data?.distributionMode === 'percent' || data?.distributionMode === 'absolute' ? data.distributionMode : 'auto';
  const raw = Number(data?.distributionValue ?? 0);
  const value = mode === 'auto' ? 0 : clampField(raw, EDGE_FIELD_LIMITS[mode]);
  const retryCount = clampField(Number(data?.retryCount ?? 0), EDGE_FIELD_LIMITS.retryCount);
  return { id, mode, value, retryCount };
}

export interface AllocationPlan {
  /** Base (first-attempt) QPS per edge id. */
  base: Map<string, number>;
  /** Output no edge carries: percent/absolute leave a remainder and there is no auto edge. */
  unallocated: number;
  /** Sum of the percent edges as configured (before scaling). */
  percentSum: number;
  /** True when percent edges add up to more than 100% and were scaled down to fit. */
  overallocated: boolean;
}

/**
 * Split a node's output over its edges:
 * 1. absolute edges take their cap (scaled down together if the caps exceed the output),
 * 2. percent edges take their share of what is left (scaled to 100% if they sum above it),
 * 3. auto edges split the rest equally; with no auto edge the rest is unallocated.
 * Traffic is never created or destroyed (#3, #11).
 */
export function allocate(output: number, edges: OutEdge[]): AllocationPlan {
  const base = new Map<string, number>();
  let absSum = 0, percentSum = 0, autoCount = 0;
  for (const e of edges) {
    if (e.mode === 'absolute') absSum += e.value;
    else if (e.mode === 'percent') percentSum += e.value;
    else autoCount++;
  }
  const absScale = absSum > output && absSum > 0 ? output / absSum : 1;
  const afterAbs = Math.max(0, output - absSum * absScale);
  const overallocated = percentSum > 100;
  const pScale = overallocated ? 100 / percentSum : 1;
  const afterPercent = afterAbs * Math.max(0, 1 - (percentSum * pScale) / 100);
  for (const e of edges) {
    if (e.mode === 'absolute') base.set(e.id, e.value * absScale);
    else if (e.mode === 'percent') base.set(e.id, afterAbs * (e.value * pScale) / 100);
    else base.set(e.id, afterPercent / autoCount);
  }
  const unallocated = autoCount === 0 && edges.length > 0 ? afterPercent : autoCount === 0 ? output : 0;
  return { base, unallocated, percentSum, overallocated };
}

/** Expected attempts per request with r retries against error rate e: Σₖ₌₀ʳ eᵏ. */
export function expectedAttempts(errorRate: number, retryCount: number): number {
  if (retryCount <= 0 || errorRate <= 0) return 1;
  const e = Math.min(1, errorRate);
  if (e === 1) return retryCount + 1;
  return (1 - Math.pow(e, retryCount + 1)) / (1 - e);
}
