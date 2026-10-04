import { useNavigate } from 'react-router-dom';
import { AdBanner, AD_SIZES } from '../components/AdBanner';

interface ComponentDef {
  kind: string;
  icon: string;
  label: string;
  color: string;
  description: string;
  tip: string;
  fields: { name: string; description: string }[];
}

const COMPONENTS: ComponentDef[] = [
  {
    kind: 'loadGenerator',
    icon: '⚡',
    label: 'Load Generator',
    color: '#a855f7',
    description: 'Represents the source of incoming traffic to your system. Every diagram should start with a Load Generator.',
    tip: 'Use multiple Load Generators to model different traffic sources (e.g., web users vs. batch jobs). Multiply all generators at once using the Stress Test button.',
    fields: [
      { name: 'Label', description: 'Display name on the canvas' },
      { name: 'Output QPS', description: 'Queries per second emitted from this source. The Stress Test multiplies this value across 0.5×–10× runs.' },
    ],
  },
  {
    kind: 'loadBalancer',
    icon: '⚖️',
    label: 'Load Balancer',
    color: 'var(--accent)',
    description: 'Distributes incoming traffic across its downstream connections — equally by default, or weighted with per-connection percentages.',
    tip: 'Connect it to several servers to model Nginx, HAProxy, or AWS ALB. To weight targets, set a percentage on each connection. A saturated load balancer passes on only its capacity, so the servers behind it look idle. Set a base latency of 1–5 ms to represent real forwarding overhead.',
    fields: [
      { name: 'Label', description: 'Display name on the canvas' },
      { name: 'Max QPS', description: 'Maximum throughput before this node becomes a bottleneck' },
      { name: 'Error Rate (%)', description: 'Percentage of requests this node fails to forward. Past capacity it also sheds the excess as errors.' },
      { name: 'Base Latency (ms)', description: 'Processing latency at this node when not under load. Default: 2 ms. Rises under load via the M/M/1 queueing model.' },
    ],
  },
  {
    kind: 'server',
    icon: '🖥️',
    label: 'Server / API',
    color: 'var(--accent)',
    description: 'Represents an API server, microservice, or compute node. Scale horizontally by setting multiple instances.',
    tip: 'Set instances > 1 to model a horizontally-scaled fleet. Total capacity = maxQPS × instances. Assign a realistic error rate (1–5%) to see how downstream retries amplify your database load.',
    fields: [
      { name: 'Label', description: 'Display name on the canvas' },
      { name: 'Max QPS (per instance)', description: 'Max throughput of one instance; capacity = Max QPS × Instances' },
      { name: 'Instances', description: 'Number of replicas running in parallel' },
      { name: 'Error Rate (%)', description: 'Baseline % of requests that result in errors (e.g. 5xx). Past 100% utilization the node also sheds the excess: total errors = 1 − (capacity ÷ incoming) × (1 − baseline).' },
      { name: 'Base Latency (ms)', description: 'Response time at this node under no load. Default: 50 ms. Grows as base ÷ (1 − utilization) and becomes unbounded at 100%.' },
    ],
  },
  {
    kind: 'database',
    icon: '🗄️',
    label: 'Database',
    color: '#f59e0b',
    description: 'Relational or document store with separate read/write capacities and optional read replicas.',
    tip: 'Databases are the most common bottleneck. Reads and writes are checked separately — utilization is whichever path is busier — so replicas fix read pressure but never write pressure. Add retries on incoming connections to observe retry storms: at a 15% error rate, 3 retries cost 1.18× the load, and once that overloads the database the rising error rate drives even more retries.',
    fields: [
      { name: 'Label', description: 'Display name on the canvas' },
      { name: 'DB Type', description: 'postgres, mysql, mongodb, or redis' },
      { name: 'Max Read QPS', description: 'Read queries per second per node; read capacity = Max Read × (1 + replicas)' },
      { name: 'Max Write QPS', description: 'Write queries per second on the primary — replicas do not add write capacity' },
      { name: 'Read Replicas', description: 'Additional read-only replicas (adds to read capacity only)' },
      { name: 'Read Ratio (%)', description: 'Percentage of incoming requests that are reads; the rest are writes' },
      { name: 'Error Rate (%)', description: 'Baseline % of queries that fail. Combine with retries on upstream edges to model retry amplification.' },
      { name: 'Base Latency (ms)', description: 'Query latency under no load. Default: 15 ms. Rises sharply as utilization approaches capacity.' },
    ],
  },
  {
    kind: 'cache',
    icon: '🗃️',
    label: 'Cache',
    color: 'var(--accent)',
    description: 'In-memory cache layer (Redis, Memcached, or CDN). Intercepts requests based on hit rate and serves them locally.',
    tip: 'A high hit rate dramatically reduces load on downstream databases. Model cache warming by starting with a lower hit rate. Base latency of 1 ms reflects in-memory speed.',
    fields: [
      { name: 'Label', description: 'Display name on the canvas' },
      { name: 'Cache Type', description: 'redis, memcached, or cdn' },
      { name: 'Hit Rate (%)', description: 'Percentage of requests served from cache — only (100 − hitRate)% flow to downstream nodes' },
      { name: 'Max QPS', description: 'Maximum throughput of the cache node itself' },
      { name: 'Error Rate (%)', description: 'Percentage of cache operations that fail (e.g., evictions, OOM). Usually 0–1%.' },
      { name: 'Base Latency (ms)', description: 'Cache read latency under no load. Default: 1 ms.' },
    ],
  },
  {
    kind: 'queue',
    icon: '📨',
    label: 'Queue',
    color: '#8b5cf6',
    description: 'Message queue or event bus (Kafka, RabbitMQ, SQS). Decouples producers from consumers and buffers load spikes.',
    tip: 'Drain rate = Max Throughput × Consumers. Messages arriving faster than that build a backlog (msg/s) instead of failing, and only the drained rate reaches the consumer servers behind the queue. The queue ends the synchronous request, so the consumer side is left out of request latency. Set base latency to 5 ms to model Kafka publish latency.',
    fields: [
      { name: 'Label', description: 'Display name on the canvas' },
      { name: 'Queue Type', description: 'kafka, rabbitmq, or sqs' },
      { name: 'Max Throughput', description: 'Messages per second per consumer' },
      { name: 'Consumers', description: 'Number of concurrent consumers processing the queue' },
      { name: 'Error Rate (%)', description: 'Percentage of messages that fail to be delivered or processed.' },
      { name: 'Base Latency (ms)', description: 'Publish latency seen by the producer. Default: 5 ms.' },
    ],
  },
  {
    kind: 'edge',
    icon: '→',
    label: 'Connection (Edge)',
    color: 'var(--accent)',
    description: 'Directed connection between two nodes. Controls how QPS flows from source to target, and how many times the caller retries on error.',
    tip: 'Set retries > 0 on connections into nodes that fail to observe retry amplification. Each request costs 1 + e + e² + … + eʳ attempts, where e is the target\'s total error rate (configured + overload): a 10% error rate with 3 retries means 1.11× the load. If that pushes the target past capacity, e rises and the simulator solves the loop to its steady state.',
    fields: [
      { name: 'Endpoint Label', description: 'Optional label shown on the edge (e.g. "GET /users")' },
      { name: 'Distribution Mode', description: 'absolute (QPS cap) connections are filled first, then percent connections take their share of what is left, then auto connections split the rest equally. Percentages above 100% in total are scaled down; with no auto connection, leftover traffic is reported as unsent.' },
      { name: 'Distribution Value', description: 'For percent mode: 0–100. For absolute mode: QPS value. Ignored in auto mode.' },
      { name: 'Retries on error', description: 'How many times the caller retries when the target returns an error (0–10). Absolute caps still hold after retries.' },
    ],
  },
];

interface SimFeature {
  icon: string;
  title: string;
  body: string;
  formula?: string;
}

const SIM_FEATURES: SimFeature[] = [
  {
    icon: '📉',
    title: 'Error Rate Modeling',
    body: 'Each node has a configurable baseline error rate. A node past capacity serves only its capacity and sheds the rest as errors, and only successful requests continue downstream — so one saturated tier never fakes a bottleneck behind it.',
    formula: 'errors = 1 − (min(in, capacity) ÷ in) × (1 − baseline)',
  },
  {
    icon: '⏱️',
    title: 'Latency Modeling (M/M/1)',
    body: 'Latency grows non-linearly as utilization approaches capacity (M/M/1) and is unbounded at 100%. The bar shows the mean request latency, weighted by traffic along the synchronous path, and the critical path — the slowest path that carries traffic.',
    formula: 'latency = baseLatency / (1 − utilization)',
  },
  {
    icon: '🔁',
    title: 'Retry Amplification',
    body: 'Retries multiply the load on the target by the expected number of attempts. Overload raises the error rate, which raises attempts again, so the engine iterates the whole graph to a steady state (and warns if it cannot settle).',
    formula: 'attempts = 1 + e + e² + … + eʳ',
  },
  {
    icon: '🧪',
    title: 'Stress Test',
    body: 'The Stress Test runs your diagram at 0.5×, 1×, 2×, 5× and 10× of configured load, shows each component\'s exact headroom, and finds the maximum sustainable load and which component reaches 100% first.',
  },
];

export default function ComponentsPage() {
  const navigate = useNavigate();


  return (
    <div style={{ background: 'var(--bg-base)' }}>

      {/* Ad */}
      <AdBanner
        slot="7128778727"
        size={AD_SIZES.mediumRectangle}
        style={{ padding: '16px 0', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
      />

      {/* Header */}
      <section style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        padding: 'clamp(32px, 5vw, 64px) clamp(16px, 5vw, 48px)',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 'clamp(26px, 4vw, 42px)',
          fontWeight: 700,
          color: 'var(--text-strong)',
          margin: '0 0 12px',
        }}>
          Component Reference
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 15, margin: 0, maxWidth: 600, marginInline: 'auto', lineHeight: 1.6 }}>
          Six node types and connection edges to model any distributed system — with latency, error rates, queue backlog and retry amplification built in.
        </p>
      </section>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(32px, 5vw, 64px) clamp(16px, 5vw, 48px)' }}>

        {/* Simulation Features section */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 16,
          }}>
            Simulation Features
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(380px, 100%), 1fr))', gap: 16 }}>
            {SIM_FEATURES.map(f => (
              <div
                key={f.title}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '16px 18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{f.icon}</span>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>
                    {f.title}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: f.formula ? 10 : 0 }}>
                  {f.body}
                </div>
                {f.formula && (
                  <div style={{
                    fontFamily: "'Courier New', monospace",
                    fontSize: 11,
                    color: 'var(--accent)',
                    background: 'color-mix(in srgb, var(--accent) 6%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--accent) 15%, transparent)',
                    borderRadius: 6,
                    padding: '6px 10px',
                  }}>
                    {f.formula}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Component cards */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 16,
          }}>
            Components &amp; Edges
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {COMPONENTS.map(comp => (
            <div
              key={comp.kind}
              style={{
                background: 'var(--bg-surface)',
                border: `1px solid var(--border)`,
                borderLeft: `4px solid ${comp.color}`,
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              {/* Card header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: comp.kind === 'edge' ? 22 : 32, lineHeight: 1, flexShrink: 0, color: comp.kind === 'edge' ? comp.color : undefined }}>
                  {comp.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--text-strong)',
                    marginBottom: 4,
                  }}>
                    {comp.label}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {comp.description}
                  </div>
                </div>
              </div>

              {/* Fields table */}
              <div style={{ padding: '16px 24px 0' }}>
                <div style={{
                  fontSize: 11,
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 10,
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 600,
                }}>
                  Configuration Fields
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {comp.fields.map((field, i) => (
                    <div
                      key={field.name}
                      style={{
                        display: 'flex',
                        gap: 16,
                        padding: '8px 0',
                        borderBottom: i < comp.fields.length - 1 ? '1px solid var(--border)' : 'none',
                        flexWrap: 'wrap',
                        alignItems: 'baseline',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        minWidth: 160,
                        flexShrink: 0,
                      }}>
                        <span style={{
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontSize: 12,
                          fontWeight: 600,
                          color: comp.color,
                        }}>
                          {field.name}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                        {field.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Usage tip */}
              <div style={{
                margin: '16px 24px 20px',
                background: 'color-mix(in srgb, var(--accent) 5%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent) 15%, transparent)',
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                gap: 8,
              }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  {comp.tip}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', marginTop: 56 }}>
          <p style={{ color: 'var(--text-dim)', marginBottom: 20, fontSize: 15 }}>
            Ready to model your system?
          </p>
          <button
            onClick={() => navigate('/playground')}
            style={{
              padding: '14px 36px',
              background: 'var(--accent-strong)',
              border: 'none',
              borderRadius: 10,
              color: 'var(--on-accent)',
              fontSize: 15,
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            Try in Playground →
          </button>
        </div>
      </div>
    </div>
  );
}
