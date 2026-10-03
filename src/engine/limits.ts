import type { NodeKind } from '../types';

export interface FieldLimit { min: number; max: number; integer?: boolean }

/**
 * Valid ranges for every numeric node field. Used by the config panel (clamp on input)
 * and by diagram validation (import / share links / restore). Engine owns this table.
 */
export const NODE_FIELD_LIMITS: Record<NodeKind, Record<string, FieldLimit>> = {
  loadGenerator: { outputQPS: { min: 0, max: 10_000_000 } },
  loadBalancer:  { maxQPS: { min: 1, max: 10_000_000 }, errorRate: { min: 0, max: 100 }, baseLatencyMs: { min: 0, max: 60_000 } },
  server:        { maxQPS: { min: 1, max: 10_000_000 }, instances: { min: 1, max: 10_000, integer: true }, errorRate: { min: 0, max: 100 }, baseLatencyMs: { min: 0, max: 60_000 } },
  database:      { maxReadQPS: { min: 1, max: 10_000_000 }, maxWriteQPS: { min: 1, max: 10_000_000 }, readReplicas: { min: 0, max: 100, integer: true }, readRatio: { min: 0, max: 100 }, errorRate: { min: 0, max: 100 }, baseLatencyMs: { min: 0, max: 60_000 } },
  cache:         { hitRate: { min: 0, max: 100 }, maxQPS: { min: 1, max: 100_000_000 }, errorRate: { min: 0, max: 100 }, baseLatencyMs: { min: 0, max: 60_000 } },
  queue:         { maxThroughput: { min: 1, max: 10_000_000 }, consumers: { min: 1, max: 10_000, integer: true }, errorRate: { min: 0, max: 100 }, baseLatencyMs: { min: 0, max: 60_000 } },
};

export const EDGE_FIELD_LIMITS: Record<string, FieldLimit> = {
  percent:    { min: 0, max: 100 },
  absolute:   { min: 0, max: 10_000_000 },
  retryCount: { min: 0, max: 10, integer: true },
};

export function clampField(value: number, limit: FieldLimit): number {
  if (!Number.isFinite(value)) return limit.min;
  const v = Math.min(limit.max, Math.max(limit.min, value));
  return limit.integer ? Math.round(v) : v;
}
