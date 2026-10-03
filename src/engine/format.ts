import type { NodeStatus } from '../types';

/** Status thresholds, shared by the engine, node cards, stress test and the legend. */
export const STATUS_THRESHOLDS = { warning: 70, near: 90, critical: 100 } as const;

/**
 * Utilisation (%) → status. Single source of truth for the thresholds.
 * At 100% a queue never drains (M/M/1 latency is unbounded), so 100% is already critical.
 */
export function statusOf(utilization: number): NodeStatus {
  if (utilization >= 100) return 'critical';
  if (utilization > 90)  return 'near';
  if (utilization > 70)  return 'warning';
  return 'healthy';
}

/** Requests per second for display: 950/s, 1.0k/s, 12.5k/s. */
export function formatQPS(qps: number): string {
  if (!Number.isFinite(qps)) return '∞/s';
  const r = Math.round(qps);
  if (r >= 1000) return `${(qps / 1000).toFixed(1)}k/s`;
  return `${r}/s`;
}

/** Latency for display: < 1ms, 42ms, 1.2s. */
export function formatLatency(ms: number): string {
  if (!Number.isFinite(ms)) return '∞';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms >= 1)    return `${ms.toFixed(0)}ms`;
  return '< 1ms';
}
