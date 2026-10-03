import { useMemo, useState } from 'react';
import type {
  LoadGeneratorData, LoadBalancerData, ServerData,
  DatabaseData, CacheData, QueueData, NodeData, EdgeData, NodeKind,
} from '../types';
import { useDiagramStore } from '../store/diagramStore';
import { NODE_FIELD_LIMITS, EDGE_FIELD_LIMITS, clampField, type FieldLimit } from '../engine/limits';
import { expectedAttempts } from '../engine/allocation';
import { DEFAULT_LATENCY_MS } from '../engine/capacity';
import { formatQPS } from '../engine/format';
import { AdBanner } from './AdBanner';

type Update = (p: Partial<NodeData>) => void;

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: 'var(--text-dim)', marginBottom: 4,
  textTransform: 'uppercase', letterSpacing: '0.06em',
};
const hintStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-dim)', background: 'var(--bg-elevated)', borderRadius: 6,
  padding: '6px 10px', marginBottom: 14, lineHeight: 1.6,
};
const warnStyle: React.CSSProperties = { ...hintStyle, color: 'var(--st-warning)', border: '1px solid color-mix(in srgb, var(--st-warning) 40%, transparent)' };

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function TextField({ id, label, value, placeholder, onChange }: {
  id: string; label: string; value: string; placeholder?: string; onChange: (v: string) => void;
}) {
  return (
    <Field id={id} label={label}>
      <input id={id} className="bn-input" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </Field>
  );
}

function SelectField<T extends string>({ id, label, value, options, onChange }: {
  id: string; label: string; value: T; options: [T, string][]; onChange: (v: T) => void;
}) {
  return (
    <Field id={id} label={label}>
      <select id={id} className="bn-input" style={{ cursor: 'pointer' }} value={value} onChange={e => onChange(e.target.value as T)}>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </Field>
  );
}

/**
 * Numeric input clamped to the shared limits table (#13). While the field is empty or
 * mid-edit the store keeps the last good value (an empty optional field means "default");
 * on blur the field shows the value actually in use.
 */
function NumberField({ id, label, value, limit, optional, placeholder, onChange }: {
  id: string; label: string; value: number | undefined; limit: FieldLimit;
  optional?: boolean; placeholder?: string; onChange: (v: number | undefined) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value == null ? '' : String(value));
  const parsed = draft == null || draft.trim() === '' ? null : Number(draft);
  const outOfRange = parsed != null && Number.isFinite(parsed) && clampField(parsed, limit) !== parsed;
  const hintId = `${id}-hint`;
  return (
    <Field id={id} label={label}>
      <input
        id={id}
        className="bn-input"
        type="number"
        inputMode="decimal"
        min={limit.min}
        max={limit.max}
        step={limit.integer ? 1 : 'any'}
        placeholder={placeholder}
        value={shown}
        aria-invalid={outOfRange || undefined}
        aria-describedby={outOfRange ? hintId : undefined}
        onChange={e => {
          const text = e.target.value;
          setDraft(text);
          if (text.trim() === '') { if (optional) onChange(undefined); return; }
          const n = Number(text);
          if (Number.isFinite(n)) onChange(clampField(n, limit));
        }}
        onBlur={() => setDraft(null)}
      />
      {outOfRange && (
        <div id={hintId} style={{ fontSize: 10, color: 'var(--st-warning)', marginTop: 3 }}>
          Allowed {limit.min.toLocaleString()}–{limit.max.toLocaleString()}; using {clampField(parsed!, limit).toLocaleString()}
        </div>
      )}
    </Field>
  );
}

/** Number field bound to a node field and its NODE_FIELD_LIMITS row. */
function NodeNumber({ nodeId, kind, field, label, value, optional, placeholder, onUpdate }: {
  nodeId: string; kind: NodeKind; field: string; label: string; value: number | undefined;
  optional?: boolean; placeholder?: string; onUpdate: Update;
}) {
  return (
    <NumberField
      id={`cfg-${nodeId}-${field}`} label={label} value={value} optional={optional} placeholder={placeholder}
      limit={NODE_FIELD_LIMITS[kind][field]}
      onChange={v => onUpdate({ [field]: v } as Partial<NodeData>)}
    />
  );
}

/** Error rate + base latency, common to every kind except the load generator. */
function ReliabilityFields({ nodeId, kind, data, onUpdate }: {
  nodeId: string; kind: Exclude<NodeKind, 'loadGenerator'>; data: { errorRate?: number; baseLatencyMs?: number }; onUpdate: Update;
}) {
  return (
    <>
      <NodeNumber nodeId={nodeId} kind={kind} field="errorRate" label="Error rate (%)" value={data.errorRate ?? 0} onUpdate={onUpdate} />
      <NodeNumber nodeId={nodeId} kind={kind} field="baseLatencyMs" label="Base latency (ms)" optional
        placeholder={String(DEFAULT_LATENCY_MS[kind])} value={data.baseLatencyMs} onUpdate={onUpdate} />
    </>
  );
}

function LabelField({ nodeId, value, onUpdate }: { nodeId: string; value: string; onUpdate: Update }) {
  return <TextField id={`cfg-${nodeId}-label`} label="Label" value={value} onChange={v => onUpdate({ label: v })} />;
}

function LoadGeneratorConfig({ id, data, onUpdate }: { id: string; data: LoadGeneratorData; onUpdate: Update }) {
  return (
    <>
      <LabelField nodeId={id} value={data.label} onUpdate={onUpdate} />
      <NodeNumber nodeId={id} kind="loadGenerator" field="outputQPS" label="Output QPS" value={data.outputQPS} onUpdate={onUpdate} />
    </>
  );
}

function LoadBalancerConfig({ id, data, onUpdate }: { id: string; data: LoadBalancerData; onUpdate: Update }) {
  return (
    <>
      <LabelField nodeId={id} value={data.label} onUpdate={onUpdate} />
      <NodeNumber nodeId={id} kind="loadBalancer" field="maxQPS" label="Max QPS" value={data.maxQPS} onUpdate={onUpdate} />
      <div style={hintStyle}>Traffic splits equally across connections. To weight targets, set a percentage on each connection.</div>
      <ReliabilityFields nodeId={id} kind="loadBalancer" data={data} onUpdate={onUpdate} />
    </>
  );
}

function ServerConfig({ id, data, onUpdate }: { id: string; data: ServerData; onUpdate: Update }) {
  return (
    <>
      <LabelField nodeId={id} value={data.label} onUpdate={onUpdate} />
      <NodeNumber nodeId={id} kind="server" field="maxQPS" label="Max QPS (per instance)" value={data.maxQPS} onUpdate={onUpdate} />
      <NodeNumber nodeId={id} kind="server" field="instances" label="Instances" value={data.instances} onUpdate={onUpdate} />
      {data.capacity != null && (
        <div style={hintStyle}>Total capacity {formatQPS(data.capacity)} (max QPS × instances)</div>
      )}
      <ReliabilityFields nodeId={id} kind="server" data={data} onUpdate={onUpdate} />
    </>
  );
}

const pct = (v: number) => `${Math.round(v)}%`;

function DatabaseConfig({ id, data, onUpdate }: { id: string; data: DatabaseData; onUpdate: Update }) {
  return (
    <>
      <LabelField nodeId={id} value={data.label} onUpdate={onUpdate} />
      <SelectField id={`cfg-${id}-dbType`} label="DB type" value={data.dbType}
        options={[['postgres', 'PostgreSQL'], ['mysql', 'MySQL'], ['mongodb', 'MongoDB'], ['redis-db', 'Redis']]}
        onChange={v => onUpdate({ dbType: v })} />
      <NodeNumber nodeId={id} kind="database" field="maxReadQPS" label="Max read QPS (per node)" value={data.maxReadQPS} onUpdate={onUpdate} />
      <NodeNumber nodeId={id} kind="database" field="maxWriteQPS" label="Max write QPS (primary)" value={data.maxWriteQPS} onUpdate={onUpdate} />
      <NodeNumber nodeId={id} kind="database" field="readReplicas" label="Read replicas" value={data.readReplicas} onUpdate={onUpdate} />
      <NodeNumber nodeId={id} kind="database" field="readRatio" label="Read ratio (% reads)" value={data.readRatio} onUpdate={onUpdate} />
      <div style={hintStyle}>
        Reads go to the primary and replicas; writes go to the primary only.
        {data.readUtilization != null && data.writeUtilization != null && (
          <> Read path {pct(data.readUtilization)}, write path {pct(data.writeUtilization)}.</>
        )}
      </div>
      <ReliabilityFields nodeId={id} kind="database" data={data} onUpdate={onUpdate} />
    </>
  );
}

function CacheConfig({ id, data, onUpdate }: { id: string; data: CacheData; onUpdate: Update }) {
  return (
    <>
      <LabelField nodeId={id} value={data.label} onUpdate={onUpdate} />
      <SelectField id={`cfg-${id}-cacheType`} label="Cache type" value={data.cacheType}
        options={[['redis', 'Redis'], ['memcached', 'Memcached'], ['cdn', 'CDN']]}
        onChange={v => onUpdate({ cacheType: v })} />
      <NodeNumber nodeId={id} kind="cache" field="hitRate" label="Hit rate (%)" value={data.hitRate} onUpdate={onUpdate} />
      <NodeNumber nodeId={id} kind="cache" field="maxQPS" label="Max QPS" value={data.maxQPS} onUpdate={onUpdate} />
      <div style={hintStyle}>
        {data.hitRate}% of requests are served here; {100 - data.hitRate}% go downstream.
      </div>
      <ReliabilityFields nodeId={id} kind="cache" data={data} onUpdate={onUpdate} />
    </>
  );
}

function QueueConfig({ id, data, onUpdate }: { id: string; data: QueueData; onUpdate: Update }) {
  return (
    <>
      <LabelField nodeId={id} value={data.label} onUpdate={onUpdate} />
      <SelectField id={`cfg-${id}-queueType`} label="Queue type" value={data.queueType}
        options={[['kafka', 'Kafka'], ['rabbitmq', 'RabbitMQ'], ['sqs', 'Amazon SQS']]}
        onChange={v => onUpdate({ queueType: v })} />
      <NodeNumber nodeId={id} kind="queue" field="maxThroughput" label="Throughput (msg/s per consumer)" value={data.maxThroughput} onUpdate={onUpdate} />
      <NodeNumber nodeId={id} kind="queue" field="consumers" label="Consumers" value={data.consumers} onUpdate={onUpdate} />
      {data.capacity != null && (
        <div style={hintStyle}>
          Drains {formatQPS(data.capacity).replace('/s', ' msg/s')}. Messages above that build a backlog instead of failing.
          {(data.backlogQPS ?? 0) > 0 && <> Backlog grows by {formatQPS(data.backlogQPS!).replace('/s', ' msg/s')}.</>}
        </div>
      )}
      <ReliabilityFields nodeId={id} kind="queue" data={data} onUpdate={onUpdate} />
    </>
  );
}

/** How the source's output is shared out: drives the Edge Config warnings (#3, #11). */
function useAllocationSummary(sourceId: string | undefined) {
  const edges = useDiagramStore(s => s.edges);
  return useMemo(() => {
    let percent = 0, auto = 0, absolute = 0;
    for (const e of edges) {
      if (e.source !== sourceId) continue;
      const d = e.data as EdgeData | undefined;
      const mode = d?.distributionMode ?? 'auto';
      if (mode === 'percent') percent += clampField(Number(d?.distributionValue ?? 0), EDGE_FIELD_LIMITS.percent);
      else if (mode === 'absolute') absolute++;
      else auto++;
    }
    return { percent, auto, absolute };
  }, [edges, sourceId]);
}

function EdgeConfigPanel({ edgeId }: { edgeId: string }) {
  const edge = useDiagramStore(s => s.edges.find(e => e.id === edgeId));
  const updateEdgeData = useDiagramStore(s => s.updateEdgeData);
  const sourceLabel = useDiagramStore(s => s.nodes.find(n => n.id === edge?.source)?.data.label);
  const target = useDiagramStore(s => s.nodes.find(n => n.id === edge?.target)?.data);
  const sourceUnallocated = useDiagramStore(s => (s.nodes.find(n => n.id === edge?.source)?.data as { unallocatedQPS?: number } | undefined)?.unallocatedQPS ?? 0);
  const summary = useAllocationSummary(edge?.source);
  if (!edge) return null;

  const d = (edge.data as EdgeData | undefined) ?? { distributionMode: 'auto' as const };
  const onUpdate = (patch: Partial<EdgeData>) => updateEdgeData(edge.id, patch);
  const computed = d.computedQPS;
  const src = sourceLabel ?? 'the source';
  const now = computed != null ? ` Now carrying ${formatQPS(computed)}.` : '';
  const remaining = Math.max(0, 100 - summary.percent);

  const infoText = d.distributionMode === 'auto'
    ? `Shares what ${src} sends after any percent and absolute connections, split equally across its ${summary.auto} auto connection${summary.auto === 1 ? '' : 's'}.${now}`
    : d.distributionMode === 'percent'
    ? `Takes ${d.distributionValue ?? 0}% of what ${src} sends after any absolute connections.${now}`
    : `Carries at most ${formatQPS(d.distributionValue ?? 0)}, retries included. If ${src}'s caps add up to more than it sends, they are scaled down together; anything left goes to its auto connections.${now}`;

  const targetError = (target as { errorRatePct?: number; errorRate?: number } | undefined);
  const errorPct = targetError?.errorRatePct ?? targetError?.errorRate ?? 0;
  const retries = d.retryCount ?? 0;
  const attempts = expectedAttempts(errorPct / 100, retries);

  return (
    <>
      <TextField id={`cfg-${edge.id}-label`} label="Endpoint label" value={d.label ?? ''} placeholder="e.g. GET /users"
        onChange={v => onUpdate({ label: v || undefined })} />
      <SelectField id={`cfg-${edge.id}-mode`} label="Distribution" value={d.distributionMode}
        options={[['auto', 'Auto (equal split)'], ['percent', 'Percentage of source'], ['absolute', 'Absolute QPS cap']]}
        onChange={v => onUpdate({ distributionMode: v })} />
      {d.distributionMode !== 'auto' && (
        <NumberField
          key={d.distributionMode}
          id={`cfg-${edge.id}-value`}
          label={d.distributionMode === 'percent' ? 'Percentage (0–100)' : 'QPS cap'}
          value={d.distributionValue ?? 0}
          limit={EDGE_FIELD_LIMITS[d.distributionMode]}
          onChange={v => onUpdate({ distributionValue: v ?? 0 })}
        />
      )}
      <div style={hintStyle}>{infoText}</div>
      {summary.percent > 100 && (
        <div style={warnStyle} role="status">
          Percent connections from {src} add up to {+summary.percent.toFixed(1)}%. They are scaled down to fit 100%.
        </div>
      )}
      {summary.percent > 0 && summary.percent <= 100 && (
        <div style={hintStyle}>
          Percent connections from {src}: {+summary.percent.toFixed(1)}%.{' '}
          {summary.auto > 0
            ? `Auto connections share the remaining ${+remaining.toFixed(1)}%.`
            : remaining > 0 ? `The remaining ${+remaining.toFixed(1)}% is not sent anywhere.` : ''}
        </div>
      )}
      {sourceUnallocated > 0 && (
        <div style={warnStyle} role="status">
          {formatQPS(sourceUnallocated)} from {src} is not sent on any connection. Add an auto connection to carry the rest, or that traffic ends at {src}.
        </div>
      )}
      <NumberField
        id={`cfg-${edge.id}-retries`}
        label="Retries on error"
        value={retries}
        limit={EDGE_FIELD_LIMITS.retryCount}
        onChange={v => onUpdate({ retryCount: v ?? 0 })}
      />
      {retries > 0 && (
        <div style={hintStyle}>
          Each request costs 1 + e + … + e<sup>{retries}</sup> attempts, e = the target's error rate
          (now {errorPct < 1 ? errorPct.toFixed(1) : errorPct.toFixed(0)}%): ×{attempts.toFixed(2)} load. Overload raises e, so retries can compound.
        </div>
      )}
    </>
  );
}

function NodeConfig({ nodeId }: { nodeId: string }) {
  const data = useDiagramStore(s => s.nodes.find(n => n.id === nodeId)?.data);
  const updateNodeData = useDiagramStore(s => s.updateNodeData);
  if (!data) return null;
  const onUpdate: Update = patch => updateNodeData(nodeId, patch);
  switch (data.kind) {
    case 'loadGenerator': return <LoadGeneratorConfig id={nodeId} data={data} onUpdate={onUpdate} />;
    case 'loadBalancer':  return <LoadBalancerConfig  id={nodeId} data={data} onUpdate={onUpdate} />;
    case 'server':        return <ServerConfig        id={nodeId} data={data} onUpdate={onUpdate} />;
    case 'database':      return <DatabaseConfig      id={nodeId} data={data} onUpdate={onUpdate} />;
    case 'cache':         return <CacheConfig         id={nodeId} data={data} onUpdate={onUpdate} />;
    case 'queue':         return <QueueConfig         id={nodeId} data={data} onUpdate={onUpdate} />;
  }
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '24px 4px' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }} aria-hidden="true">🔍</div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
        No selection
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
        Click a node or connection to configure it.
      </div>
    </div>
  );
}

export function ConfigPanel() {
  const selectedNodeId = useDiagramStore(s => s.selectedNodeId);
  const selectedEdgeId = useDiagramStore(s => s.selectedEdgeId);
  const nodeExists = useDiagramStore(s => s.selectedNodeId != null && s.nodes.some(n => n.id === s.selectedNodeId));

  const title = selectedEdgeId ? 'Edge Config' : nodeExists ? 'Configure' : 'Config';

  // The panel and its single ad slot stay mounted whatever is selected, so selecting
  // and deselecting never re-requests an ad (#73).
  return (
    <aside
      aria-label="Configuration"
      style={{
        width: 240, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {title}
        </h2>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }} className="scrollbar-thin">
        {selectedEdgeId
          ? <EdgeConfigPanel key={selectedEdgeId} edgeId={selectedEdgeId} />
          : nodeExists && selectedNodeId
          ? <NodeConfig key={selectedNodeId} nodeId={selectedNodeId} />
          : <EmptyState />}
      </div>
      <AdBanner slot="5483690415" format="rectangle" style={{ width: 200, minHeight: 200, margin: '0 auto 12px', flexShrink: 0 }} />
    </aside>
  );
}
