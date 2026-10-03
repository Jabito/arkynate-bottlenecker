import type { NodeStatus } from '../types';
import { STATUS_THRESHOLDS, formatQPS } from '../engine/format';

/** How each status is shown: text (never colour alone, #59), icon and theme token. */
export const STATUS_STYLE: Record<NodeStatus, { label: string; icon: string; color: string }> = {
  healthy:  { label: 'Healthy',  icon: '✅', color: 'var(--st-healthy)' },
  warning:  { label: 'Warning',  icon: '⚠️', color: 'var(--st-warning)' },
  near:     { label: 'Near cap', icon: '🟠', color: 'var(--st-near)' },
  critical: { label: 'Critical', icon: '🔴', color: 'var(--st-critical)' },
};

/** Legend rows, thresholds from the engine (#60). */
export const STATUS_LEGEND: { status: NodeStatus; range: string }[] = [
  { status: 'healthy',  range: `≤ ${STATUS_THRESHOLDS.warning}%` },
  { status: 'warning',  range: `> ${STATUS_THRESHOLDS.warning}%` },
  { status: 'near',     range: `> ${STATUS_THRESHOLDS.near}%` },
  { status: 'critical', range: `≥ ${STATUS_THRESHOLDS.critical}%` },
];

/** Translucent tint of a token colour, for chip and pill backgrounds. */
export const tint = (color: string, pct = 15) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

/** QPS for a node stat; '—' until there is a value. */
export const qps = (v?: number) => (v == null ? undefined : formatQPS(v));
