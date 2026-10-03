import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeData, NodeStatus } from '../types';
import { statusOf, formatQPS, formatLatency } from '../engine/format';
import { STATUS_STYLE, tint } from './status';

interface NodeBaseProps {
  data: NodeData;
  selected?: boolean;
  icon: string;
  typeLabel: string;
  children: React.ReactNode;
  hasInput?: boolean;
  hasOutput?: boolean;
  /** Brand tint of the node kind (handles only); text and status use theme tokens. */
  accentColor?: string;
}

const statusClass: Record<NodeStatus, string> = {
  healthy: '',
  warning: 'status-warning',
  near: 'status-near',
  critical: 'status-critical',
};

/** Engine output on node data (COMPUTED_NODE_KEYS); undefined until the first analysis. */
type Computed = {
  status?: NodeStatus; utilization?: number; errorRatePct?: number;
  estimatedLatencyMs?: number; unallocatedQPS?: number; actualQPS?: number;
};

function StatusPill({ status }: { status: NodeStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      title={`Status: ${s.label}`}
      style={{
        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
        color: s.color, background: tint(s.color), border: `1px solid ${tint(s.color, 40)}`,
        padding: '1px 6px', borderRadius: 10, whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      {s.label}
    </span>
  );
}

export function NodeBase({
  data,
  selected,
  icon,
  typeLabel,
  children,
  hasInput = true,
  hasOutput = true,
  accentColor = 'var(--accent)',
}: NodeBaseProps) {
  const c = data as Computed;
  const status = c.status;
  const unallocated = c.unallocatedQPS ?? 0;
  const latency = c.estimatedLatencyMs;
  const ariaStatus = status ? `, ${STATUS_STYLE[status].label}${c.utilization != null ? ` at ${Math.round(c.utilization)}%` : ''}` : '';

  return (
    <div
      className={`bn-node ${selected ? 'selected' : ''} ${status ? statusClass[status] : ''}`}
      aria-label={`${data.label} (${typeLabel})${ariaStatus}`}
    >
      {hasInput && (
        <Handle type="target" position={Position.Left}
          style={{ background: accentColor, borderColor: accentColor }} />
      )}
      <div className="bn-node-header">
        <span className="bn-node-icon" aria-hidden="true">{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="bn-node-title">{data.label}</div>
          <div className="bn-node-type">{typeLabel}</div>
        </div>
        {status && <StatusPill status={status} />}
      </div>
      <div className="bn-node-body">
        {children}
        {(c.errorRatePct ?? 0) > 0 && (
          <div style={{ marginTop: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--st-critical)', background: tint('var(--st-critical)'), padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
              ERR {(c.errorRatePct ?? 0) < 1 ? (c.errorRatePct ?? 0).toFixed(1) : (c.errorRatePct ?? 0).toFixed(0)}%
            </span>
          </div>
        )}
        {unallocated > 0 && (
          <div style={{ fontSize: 10, color: 'var(--st-warning)', marginTop: 4 }} title="Output that no connection carries: add an auto connection, or it ends here">
            Unsent {formatQPS(unallocated)}
          </div>
        )}
        {latency != null && (c.actualQPS ?? 0) > 0 && latency > 0 && (
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }} title="Mean latency at this node (M/M/1)">
            {Number.isFinite(latency) ? `~${formatLatency(latency)}` : '∞ (saturated)'}
          </div>
        )}
      </div>
      {hasOutput && (
        <Handle type="source" position={Position.Right}
          style={{ background: accentColor, borderColor: accentColor }} />
      )}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="bn-stat">
      <span>{label}</span>
      <span>{value ?? '—'}</span>
    </div>
  );
}

/** Utilisation bar. Renders the engine's number; no local capacity formulas (#78). */
export function Meter({ utilization }: { utilization?: number }) {
  if (utilization == null) return null;
  const pct = Number.isFinite(utilization) ? Math.min(utilization, 100) : 100;
  return (
    <div className="bn-meter" role="meter" aria-label="Utilisation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div className="bn-meter-fill" style={{ width: `${pct}%`, background: STATUS_STYLE[statusOf(utilization)].color }} />
    </div>
  );
}
