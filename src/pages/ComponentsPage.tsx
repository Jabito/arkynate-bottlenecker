import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdBanner } from '../components/AdBanner';

interface ComponentDef {
  kind: string;
  icon: string;
  label: string;
  color: string;
  description: string;
  tip: string;
  fields: { name: string; description: string; isNew?: boolean }[];
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
    color: '#22d3ee',
    description: 'Distributes incoming traffic across multiple downstream targets using a configurable strategy.',
    tip: 'Connect to multiple server instances and set distribution strategy to model Nginx, HAProxy, or AWS ALB. Set a base latency of 1–5 ms to represent real forwarding overhead.',
    fields: [
      { name: 'Label', description: 'Display name on the canvas' },
      { name: 'Max QPS', description: 'Maximum throughput before this node becomes a bottleneck' },
      { name: 'Strategy', description: 'round-robin, weighted, or least-connections' },
      { name: 'Error Rate (%)', description: 'Percentage of requests this node fails to forward. Overloaded nodes shed excess load as additional errors.', isNew: true },
      { name: 'Base Latency (ms)', description: 'Processing latency at this node when not under load. Default: 2 ms. Rises under load via the M/M/1 queueing model.', isNew: true },
    ],
  },
  {
    kind: 'server',
    icon: '🖥️',
    label: 'Server / API',
    color: '#22d3ee',
    description: 'Represents an API server, microservice, or compute node. Scale horizontally by setting multiple instances.',
    tip: 'Set instances > 1 to model a horizontally-scaled fleet. Total capacity = maxQPS × instances. Assign a realistic error rate (1–5%) to see how downstream retries amplify your database load.',
    fields: [
      { name: 'Label', description: 'Display name on the canvas' },
      { name: 'Max QPS', description: 'Max throughput per single instance' },
      { name: 'Instances', description: 'Number of replicas running in parallel' },
      { name: 'Error Rate (%)', description: 'Baseline % of requests that result in errors (e.g. 5xx). Increases automatically when utilization exceeds 100%.', isNew: true },
      { name: 'Base Latency (ms)', description: 'Response time at this node under no load. Default: 50 ms. Use the M/M/1 formula to see latency blow up as utilization approaches 100%.', isNew: true },
    ],
  },
  {
    kind: 'database',
    icon: '🗄️',
    label: 'Database',
    color: '#f59e0b',
    description: 'Relational or document store with separate read/write capacities and optional read replicas.',
    tip: 'Databases are the most common bottleneck. Set a non-zero error rate and add retries on incoming edges to observe retry storms — a small DB error rate with 3 retries multiplies incoming QPS by up to 1.45×.',
    fields: [
      { name: 'Label', description: 'Display name on the canvas' },
      { name: 'DB Type', description: 'postgres, mysql, mongodb, or redis' },
      { name: 'Max Read QPS', description: 'Maximum read queries per second (per replica)' },
      { name: 'Max Write QPS', description: 'Maximum write queries per second' },
      { name: 'Read Replicas', description: 'Additional read-only replicas (adds to read capacity)' },
      { name: 'Read Ratio (%)', description: 'Percentage of incoming requests that are reads' },
      { name: 'Error Rate (%)', description: 'Baseline % of queries that fail. Combine with retries on upstream edges to model retry amplification.', isNew: true },
      { name: 'Base Latency (ms)', description: 'Query latency under no load. Default: 15 ms. Rises sharply as utilization approaches capacity.', isNew: true },
    ],
  },
  {
    kind: 'cache',
    icon: '🔴',
    label: 'Cache',
    color: '#22d3ee',
    description: 'In-memory cache layer (Redis, Memcached, or CDN). Intercepts requests based on hit rate and serves them locally.',
    tip: 'A high hit rate dramatically reduces load on downstream databases. Model cache warming by starting with a lower hit rate. Base latency of 1 ms reflects in-memory speed.',
    fields: [
      { name: 'Label', description: 'Display name on the canvas' },
      { name: 'Cache Type', description: 'redis, memcached, or cdn' },
      { name: 'Hit Rate (%)', description: 'Percentage of requests served from cache — only (100 − hitRate)% flow to downstream nodes' },
      { name: 'Max QPS', description: 'Maximum throughput of the cache node itself' },
      { name: 'Error Rate (%)', description: 'Percentage of cache operations that fail (e.g., evictions, OOM). Usually 0–1%.', isNew: true },
      { name: 'Base Latency (ms)', description: 'Cache read latency under no load. Default: 1 ms.', isNew: true },
    ],
  },
  {
    kind: 'queue',
    icon: '📨',
    label: 'Queue',
    color: '#8b5cf6',
    description: 'Message queue or event bus (Kafka, RabbitMQ, SQS). Decouples producers from consumers and buffers load spikes.',
    tip: 'Increase consumers to scale throughput linearly. Total capacity = maxThroughput × consumers. Set base latency to 5 ms to model Kafka publish latency.',
    fields: [
      { name: 'Label', description: 'Display name on the canvas' },
      { name: 'Queue Type', description: 'kafka, rabbitmq, or sqs' },
      { name: 'Max Throughput', description: 'Messages per second per consumer' },
      { name: 'Consumers', description: 'Number of concurrent consumers processing the queue' },
      { name: 'Error Rate (%)', description: 'Percentage of messages that fail to be delivered or processed.', isNew: true },
      { name: 'Base Latency (ms)', description: 'End-to-end publish latency. Default: 5 ms.', isNew: true },
    ],
  },
  {
    kind: 'edge',
    icon: '→',
    label: 'Connection (Edge)',
    color: '#22d3ee',
    description: 'Directed connection between two nodes. Controls how QPS flows from source to target, and how many times the caller retries on error.',
    tip: 'Set retryCount > 0 on edges leading to nodes with a non-zero error rate to observe retry amplification. Effective QPS = base × (1 + errorRate% × retryCount). A 10% DB error rate with 3 retries amplifies load by 1.30×.',
    fields: [
      { name: 'Endpoint Label', description: 'Optional label shown on the edge (e.g. "GET /users")' },
      { name: 'Distribution Mode', description: 'auto (equal split), percent (fixed % of source QPS), or absolute (fixed QPS cap)' },
      { name: 'Distribution Value', description: 'For percent mode: 0–100. For absolute mode: QPS value. Ignored in auto mode.' },
      { name: 'Retries on error', description: 'How many times the caller retries when the target node returns an error (0–5). Amplifies incoming QPS on the target proportionally to its error rate.', isNew: true },
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
    body: 'Each node has a configurable baseline error rate. When a node\'s utilization exceeds 100%, the engine automatically adds the overflow as additional errors — overloaded nodes shed excess load as failures.',
    formula: 'totalErrorRate = configuredErrorRate + max(0, utilization − 100)',
  },
  {
    icon: '⏱️',
    title: 'Latency Modeling (M/M/1)',
    body: 'Effective latency grows non-linearly as utilization approaches capacity, following the M/M/1 queueing model. End-to-end P50 latency is tracked along the critical path through your graph.',
    formula: 'effectiveLatency = baseLatency / (1 − utilization)',
  },
  {
    icon: '🔁',
    title: 'Retry Amplification',
    body: 'When a caller retries failed requests, it multiplies the actual load on the target node. Combined with the latency model, this creates realistic cascading overload scenarios.',
    formula: 'amplifiedQPS = baseQPS × (1 + errorRate × retryCount)',
  },
  {
    icon: '🧪',
    title: 'Stress Test',
    body: 'The Stress Test button runs your full diagram at 0.5×, 1×, 2×, 5×, and 10× of configured load in one click. A color-coded matrix shows exactly which nodes break first and at what multiplier.',
  },
];

export default function ComponentsPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Components — Bottlenecker';
  }, []);

  return (
    <div style={{ overflowY: 'auto', height: 'calc(100vh - 50px)', background: 'var(--bg-base)' }}>

      {/* Ad */}
      <AdBanner
        slot="7128778727"
        format="rectangle"
        style={{ background: '#0d1526', borderBottom: '1px solid #1e2d45' }}
      />

      {/* Header */}
      <section style={{
        background: '#0d1526',
        borderBottom: '1px solid #1e2d45',
        padding: 'clamp(32px, 5vw, 64px) clamp(16px, 5vw, 48px)',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 'clamp(26px, 4vw, 42px)',
          fontWeight: 700,
          color: '#f1f5f9',
          margin: '0 0 12px',
        }}>
          Component Reference
        </h1>
        <p style={{ color: '#64748b', fontSize: 15, margin: 0, maxWidth: 600, marginInline: 'auto', lineHeight: 1.6 }}>
          Six node types and connection edges to model any distributed system — with latency, error rates, and retry amplification built in.
        </p>
      </section>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(32px, 5vw, 64px) clamp(16px, 5vw, 48px)' }}>

        {/* Simulation Features section */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 11,
            fontWeight: 600,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 16,
          }}>
            Simulation Features
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
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
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
                    {f.title}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, marginBottom: f.formula ? 10 : 0 }}>
                  {f.body}
                </div>
                {f.formula && (
                  <div style={{
                    fontFamily: "'Courier New', monospace",
                    fontSize: 11,
                    color: '#22d3ee',
                    background: 'rgba(34,211,238,0.06)',
                    border: '1px solid rgba(34,211,238,0.15)',
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
            color: '#64748b',
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
                    color: '#f1f5f9',
                    marginBottom: 4,
                  }}>
                    {comp.label}
                  </div>
                  <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
                    {comp.description}
                  </div>
                </div>
              </div>

              {/* Fields table */}
              <div style={{ padding: '16px 24px 0' }}>
                <div style={{
                  fontSize: 11,
                  color: '#64748b',
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
                        {field.isNew && (
                          <span style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: '#0891b2',
                            background: 'rgba(8,145,178,0.15)',
                            border: '1px solid rgba(8,145,178,0.3)',
                            borderRadius: 4,
                            padding: '1px 5px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                          }}>
                            New
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                        {field.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Usage tip */}
              <div style={{
                margin: '16px 24px 20px',
                background: 'rgba(34,211,238,0.05)',
                border: '1px solid rgba(34,211,238,0.15)',
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                gap: 8,
              }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                  {comp.tip}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', marginTop: 56 }}>
          <p style={{ color: '#64748b', marginBottom: 20, fontSize: 15 }}>
            Ready to model your system?
          </p>
          <button
            onClick={() => navigate('/playground')}
            style={{
              padding: '14px 36px',
              background: 'linear-gradient(135deg, #0891b2, #7c3aed)',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
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
