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
  fields: { name: string; description: string }[];
}

const COMPONENTS: ComponentDef[] = [
  {
    kind: 'loadGenerator',
    icon: '⚡',
    label: 'Load Generator',
    color: '#a855f7',
    description: 'Represents the source of incoming traffic to your system. Every diagram should start with a Load Generator.',
    tip: 'Use multiple Load Generators to model different traffic sources (e.g., web users vs. batch jobs).',
    fields: [
      { name: 'Label', description: 'Display name on the canvas' },
      { name: 'Output QPS', description: 'Queries per second emitted from this source' },
    ],
  },
  {
    kind: 'loadBalancer',
    icon: '⚖️',
    label: 'Load Balancer',
    color: '#22d3ee',
    description: 'Distributes incoming traffic across multiple downstream targets using a configurable strategy.',
    tip: 'Connect to multiple server instances and set distribution strategy to model Nginx, HAProxy, or AWS ALB.',
    fields: [
      { name: 'Label', description: 'Display name on the canvas' },
      { name: 'Max QPS', description: 'Maximum throughput before this node becomes a bottleneck' },
      { name: 'Strategy', description: 'round-robin, weighted, or least-connections' },
    ],
  },
  {
    kind: 'server',
    icon: '🖥️',
    label: 'Server / API',
    color: '#22d3ee',
    description: 'Represents an API server, microservice, or compute node. Scale horizontally by setting multiple instances.',
    tip: 'Set instances > 1 to model a horizontally-scaled fleet. Total capacity = maxQPS × instances.',
    fields: [
      { name: 'Label', description: 'Display name on the canvas' },
      { name: 'Max QPS', description: 'Max throughput per single instance' },
      { name: 'Instances', description: 'Number of replicas running in parallel' },
    ],
  },
  {
    kind: 'database',
    icon: '🗄️',
    label: 'Database',
    color: '#f59e0b',
    description: 'Relational or document store with separate read/write capacities and optional read replicas.',
    tip: 'Set readRatio to the percentage of requests that are reads. Read replicas multiply your read capacity.',
    fields: [
      { name: 'Label', description: 'Display name on the canvas' },
      { name: 'DB Type', description: 'postgres, mysql, mongodb, or redis' },
      { name: 'Max Read QPS', description: 'Maximum read queries per second (per replica)' },
      { name: 'Max Write QPS', description: 'Maximum write queries per second' },
      { name: 'Read Replicas', description: 'Additional read-only replicas (adds to read capacity)' },
      { name: 'Read Ratio (%)', description: 'Percentage of incoming requests that are reads' },
    ],
  },
  {
    kind: 'cache',
    icon: '🔴',
    label: 'Cache',
    color: '#22d3ee',
    description: 'In-memory cache layer (Redis, Memcached, or CDN). Intercepts requests based on hit rate and serves them locally.',
    tip: 'A high hit rate dramatically reduces load on downstream databases. Model cache warming by starting with a lower hit rate.',
    fields: [
      { name: 'Label', description: 'Display name on the canvas' },
      { name: 'Cache Type', description: 'redis, memcached, or cdn' },
      { name: 'Hit Rate (%)', description: 'Percentage of requests served from cache' },
      { name: 'Max QPS', description: 'Maximum throughput of the cache node itself' },
    ],
  },
  {
    kind: 'queue',
    icon: '📨',
    label: 'Queue',
    color: '#8b5cf6',
    description: 'Message queue or event bus (Kafka, RabbitMQ, SQS). Decouples producers from consumers and buffers load spikes.',
    tip: 'Increase consumers to scale throughput linearly. Total capacity = maxThroughput × consumers.',
    fields: [
      { name: 'Label', description: 'Display name on the canvas' },
      { name: 'Queue Type', description: 'kafka, rabbitmq, or sqs' },
      { name: 'Max Throughput', description: 'Messages per second per consumer' },
      { name: 'Consumers', description: 'Number of concurrent consumers processing the queue' },
    ],
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
        <p style={{ color: '#64748b', fontSize: 15, margin: 0, maxWidth: 560, marginInline: 'auto', lineHeight: 1.6 }}>
          Six building blocks to model any distributed system. Combine them to simulate real architectures.
        </p>
      </section>

      {/* Component cards */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(32px, 5vw, 64px) clamp(16px, 5vw, 48px)' }}>
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
                <span style={{
                  fontSize: 32,
                  lineHeight: 1,
                  flexShrink: 0,
                }}>
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
                      }}
                    >
                      <div style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: 12,
                        fontWeight: 600,
                        color: comp.color,
                        minWidth: 140,
                        flexShrink: 0,
                      }}>
                        {field.name}
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
