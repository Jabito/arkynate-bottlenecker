import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeData, NodeStatus } from '../types';

interface NodeBaseProps {
  data: NodeData;
  selected?: boolean;
  icon: string;
  typeLabel: string;
  children: React.ReactNode;
  hasInput?: boolean;
  hasOutput?: boolean;
  accentColor?: string;
}

const statusClass: Record<NodeStatus, string> = {
  healthy: '',
  warning: 'status-warning',
  near: 'status-near',
  critical: 'status-critical',
};

export function NodeBase({
  data,
  selected,
  icon,
  typeLabel,
  children,
  hasInput = true,
  hasOutput = true,
  accentColor = '#22d3ee',
}: NodeBaseProps) {
  const status = data.status ?? 'healthy';

  return (
    <div className={`bn-node ${selected ? 'selected' : ''} ${statusClass[status]}`}>
      {hasInput && (
        <Handle type="target" position={Position.Left}
          style={{ background: accentColor, borderColor: accentColor }} />
      )}
      <div className="bn-node-header">
        <span className="bn-node-icon">{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="bn-node-title">{data.label}</div>
          <div className="bn-node-type">{typeLabel}</div>
        </div>
      </div>
      <div className="bn-node-body">
        {children}
        {((data as { errorRatePct?: number }).errorRatePct ?? 0) > 0 && (
          <div style={{ marginTop: 4 }}>
            <span style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
              ERR {((data as { errorRatePct?: number }).errorRatePct ?? 0).toFixed(0)}%
            </span>
          </div>
        )}
        {((data as { estimatedLatencyMs?: number }).estimatedLatencyMs ?? 0) > 0 && (
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
            ~{formatLatency((data as { estimatedLatencyMs?: number }).estimatedLatencyMs ?? 0)}
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
      <span>{value}</span>
    </div>
  );
}

export function Meter({ utilization }: { utilization?: number }) {
  if (utilization == null) return null;
  const pct = Math.min(utilization, 100);
  const color =
    utilization > 100 ? '#ef4444' :
    utilization > 90  ? '#f97316' :
    utilization > 70  ? '#eab308' : '#22c55e';
  return (
    <div className="bn-meter">
      <div className="bn-meter-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms >= 1)    return `${ms.toFixed(0)}ms`;
  return '< 1ms';
}

export function qpsLabel(qps?: number): string {
  if (qps == null) return '—';
  if (qps >= 1000) return `${(qps / 1000).toFixed(1)}k/s`;
  return `${qps.toFixed(0)}/s`;
}
