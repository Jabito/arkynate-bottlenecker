import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AdBanner } from '../components/AdBanner';

const STEPS = [
  {
    num: '1',
    title: 'Add Components',
    desc: 'Drag load generators, servers, databases, caches, and queues onto the canvas from the sidebar.',
    color: '#22d3ee',
  },
  {
    num: '2',
    title: 'Connect & Configure',
    desc: 'Draw edges between components and set capacity limits, QPS values, and distribution modes.',
    color: '#a855f7',
  },
  {
    num: '3',
    title: 'Analyze',
    desc: 'Hit Analyze to simulate load flow. Bottlenecks are highlighted in red — instantly.',
    color: '#22c55e',
  },
];

const FEATURES = [
  { icon: '🎨', title: 'Visual Canvas', desc: 'Drag-and-drop interactive diagram editor powered by React Flow.' },
  { icon: '⚡', title: 'Load Simulation', desc: 'Simulate real traffic patterns with configurable QPS from any entry point.' },
  { icon: '🔴', title: 'Bottleneck Detection', desc: 'Instantly highlights overloaded nodes in red, warning nodes in yellow.' },
  { icon: '↔️', title: 'Edge Distribution', desc: 'Configure exact QPS split across edges with auto, percent, or absolute modes.' },
  { icon: '🖱️', title: 'Multi-Select', desc: 'Box-select and move multiple nodes simultaneously for easy rearranging.' },
  { icon: '⚙️', title: 'Config Panel', desc: 'Fine-tune every component: instances, hit rates, consumers, DB types, and more.' },
];

export default function HomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Bottlenecker — Free System Architecture Load Simulator';
  }, []);

  return (
    <div style={{ overflowY: 'auto', height: 'calc(100vh - 50px)', background: 'var(--bg-base)' }}>

      {/* Hero */}
      <section style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: 'clamp(48px, 8vw, 96px) clamp(16px, 5vw, 48px)',
        background: 'linear-gradient(180deg, #0d1526 0%, var(--bg-base) 100%)',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(34,211,238,0.1)',
          border: '1px solid rgba(34,211,238,0.3)',
          borderRadius: 20,
          padding: '4px 14px',
          marginBottom: 24,
          fontSize: 12,
          color: '#22d3ee',
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 500,
        }}>
          Free · Browser-based · No signup
        </div>
        <h1 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 'clamp(32px, 6vw, 64px)',
          fontWeight: 700,
          color: '#f1f5f9',
          lineHeight: 1.15,
          margin: '0 0 20px',
          maxWidth: 800,
        }}>
          Find Your System's{' '}
          <span style={{ color: '#22d3ee' }}>Bottleneck</span>
          <br />Before Your Users Do
        </h1>
        <p style={{
          fontSize: 'clamp(15px, 2vw, 18px)',
          color: '#94a3b8',
          maxWidth: 580,
          lineHeight: 1.7,
          margin: '0 0 36px',
        }}>
          Model your architecture, simulate load, and spot bottlenecks instantly.
          Add servers, databases, caches, and queues — no code required.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => navigate('/playground')}
            style={{
              padding: '14px 32px',
              background: 'linear-gradient(135deg, #0891b2, #7c3aed)',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontSize: 16,
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            Open Playground →
          </button>
          <Link
            to="/components"
            style={{
              padding: '14px 32px',
              background: 'transparent',
              border: '1px solid #1e2d45',
              borderRadius: 10,
              color: '#94a3b8',
              fontSize: 16,
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'none',
              transition: 'border-color 0.15s, color 0.15s',
              display: 'inline-flex',
              alignItems: 'center',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#22d3ee';
              e.currentTarget.style.color = '#f1f5f9';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#1e2d45';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            See Components
          </Link>
        </div>
      </section>

      {/* Ad */}
      <AdBanner
        slot="8258027561"
        format="rectangle"
        style={{ background: '#0d1526', borderTop: '1px solid #1e2d45', borderBottom: '1px solid #1e2d45' }}
      />

      {/* What is Bottlenecker */}
      <section style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: 'clamp(48px, 6vw, 80px) clamp(16px, 5vw, 48px)',
      }}>
        <h2 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 'clamp(22px, 3vw, 32px)',
          fontWeight: 700,
          color: '#f1f5f9',
          marginBottom: 16,
        }}>
          What is Bottlenecker?
        </h2>
        <p style={{ color: '#94a3b8', fontSize: 16, lineHeight: 1.8, margin: 0 }}>
          Bottlenecker is a free, browser-based system architecture simulator. Engineers and architects
          use it to visually model distributed systems — placing servers, databases, caches, load balancers,
          and message queues on an interactive canvas — then simulate realistic traffic loads to identify
          where the system breaks down. No code, no infrastructure, no signup needed. Everything runs
          locally in your browser.
        </p>
      </section>

      {/* How it works */}
      <section style={{
        background: '#0d1526',
        borderTop: '1px solid #1e2d45',
        borderBottom: '1px solid #1e2d45',
        padding: 'clamp(48px, 6vw, 80px) clamp(16px, 5vw, 48px)',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <h2 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'clamp(22px, 3vw, 32px)',
            fontWeight: 700,
            color: '#f1f5f9',
            textAlign: 'center',
            marginBottom: 48,
          }}>
            How It Works
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 24,
          }}>
            {STEPS.map(step => (
              <div
                key={step.num}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '28px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: `${step.color}20`,
                  border: `2px solid ${step.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: 16,
                  color: step.color,
                }}>
                  {step.num}
                </div>
                <h3 style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#f1f5f9',
                  margin: 0,
                }}>
                  {step.title}
                </h3>
                <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: 'clamp(48px, 6vw, 80px) clamp(16px, 5vw, 48px)',
      }}>
        <h2 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 'clamp(22px, 3vw, 32px)',
          fontWeight: 700,
          color: '#f1f5f9',
          textAlign: 'center',
          marginBottom: 48,
        }}>
          Everything You Need
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
        }}>
          {FEATURES.map(f => (
            <div
              key={f.title}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '20px 20px',
                display: 'flex',
                gap: 14,
              }}
            >
              <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{f.icon}</span>
              <div>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#f1f5f9',
                  marginBottom: 6,
                }}>
                  {f.title}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <button
            onClick={() => navigate('/playground')}
            style={{
              padding: '14px 32px',
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
            Try It Free — No Signup →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        background: '#0d1526',
        padding: '24px clamp(16px, 5vw, 48px)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 13,
          color: '#64748b',
        }}>
          Bottlenecker · by{' '}
          <span style={{ color: '#94a3b8' }}>Arkynate Labs</span>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {[
            { to: '/components', label: 'Components' },
            { to: '/playground', label: 'Playground' },
          ].map(link => (
            <Link
              key={link.to}
              to={link.to}
              style={{
                fontSize: 13,
                color: '#64748b',
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
