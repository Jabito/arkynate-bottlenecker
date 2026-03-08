import type {
  LoadGeneratorData, LoadBalancerData, ServerData,
  DatabaseData, CacheData, QueueData, NodeData, EdgeData,
} from '../types';
import { useDiagramStore } from '../store/diagramStore';
import { AdBanner } from './AdBanner';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0a0f1e', border: '1px solid #1e2d45',
  borderRadius: 6, padding: '6px 10px', color: '#e2e8f0', fontSize: 13, outline: 'none',
};

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} style={{ ...inputStyle, ...props.style }}
      onFocus={e => { e.currentTarget.style.borderColor = '#22d3ee'; }}
      onBlur={e => { e.currentTarget.style.borderColor = '#1e2d45'; }}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...inputStyle, cursor: 'pointer' }} />;
}

function LoadGeneratorConfig({ data, onUpdate }: { data: LoadGeneratorData; onUpdate: (p: Partial<NodeData>) => void }) {
  return (
    <>
      <Field label="Label"><Input value={data.label} onChange={e => onUpdate({ label: e.target.value })} /></Field>
      <Field label="Output QPS"><Input type="number" min={1} value={data.outputQPS} onChange={e => onUpdate({ outputQPS: Number(e.target.value) })} /></Field>
    </>
  );
}

function LoadBalancerConfig({ data, onUpdate }: { data: LoadBalancerData; onUpdate: (p: Partial<NodeData>) => void }) {
  return (
    <>
      <Field label="Label"><Input value={data.label} onChange={e => onUpdate({ label: e.target.value })} /></Field>
      <Field label="Max QPS"><Input type="number" min={1} value={data.maxQPS} onChange={e => onUpdate({ maxQPS: Number(e.target.value) })} /></Field>
      <Field label="Strategy">
        <Select value={data.strategy} onChange={e => onUpdate({ strategy: e.target.value as LoadBalancerData['strategy'] })}>
          <option value="round-robin">Round Robin</option>
          <option value="weighted">Weighted</option>
          <option value="least-conn">Least Connections</option>
        </Select>
      </Field>
    </>
  );
}

function ServerConfig({ data, onUpdate }: { data: ServerData; onUpdate: (p: Partial<NodeData>) => void }) {
  return (
    <>
      <Field label="Label"><Input value={data.label} onChange={e => onUpdate({ label: e.target.value })} /></Field>
      <Field label="Max QPS (total)"><Input type="number" min={1} value={data.maxQPS} onChange={e => onUpdate({ maxQPS: Number(e.target.value) })} /></Field>
      <Field label="Instances"><Input type="number" min={1} value={data.instances} onChange={e => onUpdate({ instances: Number(e.target.value) })} /></Field>
    </>
  );
}

function DatabaseConfig({ data, onUpdate }: { data: DatabaseData; onUpdate: (p: Partial<NodeData>) => void }) {
  return (
    <>
      <Field label="Label"><Input value={data.label} onChange={e => onUpdate({ label: e.target.value })} /></Field>
      <Field label="DB Type">
        <Select value={data.dbType} onChange={e => onUpdate({ dbType: e.target.value as DatabaseData['dbType'] })}>
          <option value="postgres">PostgreSQL</option>
          <option value="mysql">MySQL</option>
          <option value="mongodb">MongoDB</option>
          <option value="redis-db">Redis</option>
        </Select>
      </Field>
      <Field label="Max Read QPS"><Input type="number" min={1} value={data.maxReadQPS} onChange={e => onUpdate({ maxReadQPS: Number(e.target.value) })} /></Field>
      <Field label="Max Write QPS"><Input type="number" min={1} value={data.maxWriteQPS} onChange={e => onUpdate({ maxWriteQPS: Number(e.target.value) })} /></Field>
      <Field label="Read Replicas"><Input type="number" min={0} value={data.readReplicas} onChange={e => onUpdate({ readReplicas: Number(e.target.value) })} /></Field>
    </>
  );
}

function CacheConfig({ data, onUpdate }: { data: CacheData; onUpdate: (p: Partial<NodeData>) => void }) {
  return (
    <>
      <Field label="Label"><Input value={data.label} onChange={e => onUpdate({ label: e.target.value })} /></Field>
      <Field label="Cache Type">
        <Select value={data.cacheType} onChange={e => onUpdate({ cacheType: e.target.value as CacheData['cacheType'] })}>
          <option value="redis">Redis</option>
          <option value="memcached">Memcached</option>
          <option value="cdn">CDN</option>
        </Select>
      </Field>
      <Field label="Hit Rate (%)"><Input type="number" min={0} max={100} value={data.hitRate} onChange={e => onUpdate({ hitRate: Number(e.target.value) })} /></Field>
      <Field label="Max QPS"><Input type="number" min={1} value={data.maxQPS} onChange={e => onUpdate({ maxQPS: Number(e.target.value) })} /></Field>
      <div style={{ fontSize: 11, color: '#64748b', background: '#0a1628', borderRadius: 6, padding: '6px 10px', marginBottom: 14 }}>
        {data.hitRate}% cache hits — only {100 - data.hitRate}% reach downstream
      </div>
    </>
  );
}

function QueueConfig({ data, onUpdate }: { data: QueueData; onUpdate: (p: Partial<NodeData>) => void }) {
  return (
    <>
      <Field label="Label"><Input value={data.label} onChange={e => onUpdate({ label: e.target.value })} /></Field>
      <Field label="Queue Type">
        <Select value={data.queueType} onChange={e => onUpdate({ queueType: e.target.value as QueueData['queueType'] })}>
          <option value="kafka">Kafka</option>
          <option value="rabbitmq">RabbitMQ</option>
          <option value="sqs">Amazon SQS</option>
        </Select>
      </Field>
      <Field label="Throughput (msg/s per consumer)"><Input type="number" min={1} value={data.maxThroughput} onChange={e => onUpdate({ maxThroughput: Number(e.target.value) })} /></Field>
      <Field label="Consumers"><Input type="number" min={1} value={data.consumers} onChange={e => onUpdate({ consumers: Number(e.target.value) })} /></Field>
      <div style={{ fontSize: 11, color: '#22d3ee', background: '#0a1628', borderRadius: 6, padding: '6px 10px', marginBottom: 14 }}>
        Total capacity: {(data.maxThroughput * data.consumers).toLocaleString()} msg/s
      </div>
    </>
  );
}

function EdgeConfigPanel() {
  const { edges, selectedEdgeId, updateEdgeData } = useDiagramStore();
  const edge = edges.find(e => e.id === selectedEdgeId);
  if (!edge) return null;

  const d = (edge.data as EdgeData | undefined) ?? { distributionMode: 'auto' as const };
  const onUpdate = (patch: Partial<EdgeData>) => updateEdgeData(edge.id, patch);

  const infoText = {
    auto:     'Remaining QPS divided equally among all auto edges.',
    percent:  "This edge receives the given % of the source's outgoing QPS.",
    absolute: 'This edge receives exactly the specified QPS (capped at source output).',
  }[d.distributionMode];

  return (
    <>
      <Field label="Endpoint Label">
        <Input
          value={d.label ?? ''}
          placeholder="e.g. GET /users"
          onChange={e => onUpdate({ label: e.target.value || undefined })}
        />
      </Field>
      <Field label="Distribution">
        <Select value={d.distributionMode} onChange={e => onUpdate({ distributionMode: e.target.value as EdgeData['distributionMode'] })}>
          <option value="auto">Auto (equal split)</option>
          <option value="percent">Percentage</option>
          <option value="absolute">Absolute QPS</option>
        </Select>
      </Field>
      {d.distributionMode !== 'auto' && (
        <Field label={d.distributionMode === 'percent' ? 'Percentage (0-100)' : 'QPS'}>
          <Input
            type="number"
            min={0}
            max={d.distributionMode === 'percent' ? 100 : undefined}
            value={d.distributionValue ?? 0}
            onChange={e => onUpdate({ distributionValue: Number(e.target.value) })}
          />
        </Field>
      )}
      <div style={{ fontSize: 11, color: '#64748b', background: '#0a1628', borderRadius: 6, padding: '6px 10px', marginBottom: 14, lineHeight: 1.6 }}>
        {infoText}
      </div>
    </>
  );
}

const panelShell = (title: string, children: React.ReactNode) => (
  <div style={{
    width: 240, background: '#111827', borderLeft: '1px solid #1e2d45',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  }}>
    <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #1e2d45' }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {title}
      </div>
    </div>
    <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }} className="scrollbar-thin">
      {children}
    </div>
  </div>
);

export function ConfigPanel() {
  const { nodes, selectedNodeId, selectedEdgeId, updateNodeData } = useDiagramStore();
  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  if (selectedEdgeId) {
    return panelShell('Edge Config', <EdgeConfigPanel />);
  }

  if (!selectedNode) {
    return (
      <div style={{
        width: 240, background: '#111827', borderLeft: '1px solid #1e2d45',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
          No selection
        </div>
        <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.5 }}>
          Click a node or edge to configure its properties.
        </div>
        <AdBanner slot="5483690415" format="rectangle"
          style={{ width: 200, minHeight: 200, margin: '16px auto 0' }} />
      </div>
    );
  }

  const { data } = selectedNode;
  const onUpdate = (patch: Partial<NodeData>) => updateNodeData(selectedNode.id, patch);

  return panelShell('Configure', <>
    {data.kind === 'loadGenerator' && <LoadGeneratorConfig data={data as LoadGeneratorData} onUpdate={onUpdate} />}
    {data.kind === 'loadBalancer'  && <LoadBalancerConfig  data={data as LoadBalancerData}  onUpdate={onUpdate} />}
    {data.kind === 'server'        && <ServerConfig        data={data as ServerData}         onUpdate={onUpdate} />}
    {data.kind === 'database'      && <DatabaseConfig      data={data as DatabaseData}       onUpdate={onUpdate} />}
    {data.kind === 'cache'         && <CacheConfig         data={data as CacheData}          onUpdate={onUpdate} />}
    {data.kind === 'queue'         && <QueueConfig         data={data as QueueData}          onUpdate={onUpdate} />}
  </>);
}
