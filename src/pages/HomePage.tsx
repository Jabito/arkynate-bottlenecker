import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AdBanner, AD_SIZES } from '../components/AdBanner';
import { getEventCount } from '../lib/analytics';
import { STATUS_THRESHOLDS } from '../engine/format';

// Same threshold as the playground's "Desktop Required" screen.
const MQ_PHONE = '(max-width: 767px)';

function useIsPhone(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const mql = window.matchMedia(MQ_PHONE);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return useSyncExternalStore(subscribe, () => window.matchMedia(MQ_PHONE).matches);
}

const STEPS = [
  {
    num: '1',
    title: 'Add Components',
    desc: 'Drag load generators, load balancers, servers, databases, caches and queues onto the canvas from the sidebar.',
    color: 'var(--accent)',
  },
  {
    num: '2',
    title: 'Connect & Configure',
    desc: 'Draw edges between components, set how much traffic the load generator sends, each component’s capacity, and how edges split traffic.',
    color: 'var(--purple)',
  },
  {
    num: '3',
    title: 'Watch It Break',
    desc: 'The simulation re-runs on every change. Overloaded components turn red, so the bottleneck is obvious.',
    color: 'var(--st-healthy)',
  },
];

const FEATURES = [
  { icon: '🎨', title: 'Visual Canvas', desc: 'Drag-and-drop interactive diagram editor powered by React Flow.' },
  { icon: '⚡', title: 'Load Simulation', desc: 'A load generator sends traffic that flows through your architecture, with error rates, retries and latency.' },
  {
    icon: '🚦', title: 'Bottleneck Detection',
    desc: `Nodes turn yellow above ${STATUS_THRESHOLDS.warning}% of capacity, orange above ${STATUS_THRESHOLDS.near}% and red at ${STATUS_THRESHOLDS.critical}%.`,
  },
  { icon: '↔️', title: 'Edge Distribution', desc: 'Split traffic across edges by percent or absolute QPS, or split it evenly.' },
  { icon: '🖱️', title: 'Multi-Select', desc: 'Box-select and move multiple nodes simultaneously for easy rearranging.' },
  { icon: '⚙️', title: 'Config Panel', desc: 'Fine-tune every component: server instances, read replicas and read ratio, cache hit rate, queue consumers.' },
];

const h2Style: React.CSSProperties = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: 'clamp(22px, 3vw, 32px)',
  fontWeight: 700,
  color: 'var(--text-strong)',
};

const primaryCta: React.CSSProperties = {
  padding: '14px 32px',
  background: 'linear-gradient(135deg, var(--accent-strong), var(--purple))',
  border: 'none',
  borderRadius: 10,
  color: 'var(--on-accent)',
  fontSize: 16,
  fontFamily: "'Space Grotesk', sans-serif",
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
};

const secondaryCta: React.CSSProperties = {
  padding: '14px 32px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text-muted)',
  fontSize: 16,
  fontFamily: "'Space Grotesk', sans-serif",
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
};

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();
}

export default function HomePage() {
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const [pageViews, setPageViews] = useState<number | null>(null);
  const [analyzeCount, setAnalyzeCount] = useState<number | null>(null);

  useEffect(() => {
    getEventCount('page_view').then(setPageViews);
    getEventCount('analyze_click').then(setAnalyzeCount);
  }, []);

  useEffect(() => {
    document.title = 'Bottlenecker — Find Architecture Bottlenecks Before They Hit Production';
    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (desc) desc.content = 'Free visual tool for detecting system architecture bottlenecks. Model servers, databases, caches and queues, simulate load, and see exactly where performance bottlenecks occur — in your browser, no signup needed.';
  }, []);

  return (
    <div style={{ overflowY: 'auto', height: '100%', background: 'var(--bg-base)', color: 'var(--text)' }}>

      {/* Hero */}
      <section style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: 'clamp(48px, 8vw, 96px) clamp(16px, 5vw, 48px)',
        background: 'linear-gradient(180deg, var(--bg-nav) 0%, var(--bg-base) 100%)',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
          borderRadius: 20,
          padding: '4px 14px',
          marginBottom: 24,
          fontSize: 12,
          color: 'var(--accent)',
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 500,
        }}>
          Free · Browser-based · No signup
        </div>
        <h1 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 'clamp(32px, 6vw, 64px)',
          fontWeight: 700,
          color: 'var(--text-strong)',
          lineHeight: 1.15,
          margin: '0 0 20px',
          maxWidth: 800,
        }}>
          Find Your Architecture{' '}
          <span style={{ color: 'var(--accent)' }}>Bottleneck</span>
          <br />Before Your Users Do
        </h1>
        <p style={{
          fontSize: 'clamp(15px, 2vw, 18px)',
          color: 'var(--text-muted)',
          maxWidth: 580,
          lineHeight: 1.7,
          margin: '0 0 36px',
        }}>
          Model your system architecture, simulate load, and spot performance bottlenecks instantly.
          Add servers, databases, caches, and queues — no code required.
        </p>
        {isPhone ? (
          /* The playground needs a desktop; on phones lead with the Lessons (#70) */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Link to="/lessons" style={primaryCta}>Start with the Lessons →</Link>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', maxWidth: 320, lineHeight: 1.5 }}>
              Best on desktop — open the Playground on a larger screen to build your own diagrams.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => navigate('/playground')} style={primaryCta}>
              Open Playground →
            </button>
            <Link to="/lessons" style={secondaryCta}>Learn with Lessons</Link>
            <Link to="/components" style={secondaryCta}>See Components</Link>
          </div>
        )}
        {analyzeCount !== null && analyzeCount > 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 16, textAlign: 'center' }}>
            ⚡ {formatCount(analyzeCount)} simulations run worldwide
          </div>
        )}
        {/* Product shot: the Retry Storm template mid-incident (#98) */}
        <figure style={{ margin: 'clamp(32px, 5vw, 56px) 0 0', width: '100%', maxWidth: 1040 }}>
          {(() => {
            const shot = (
              <img
                src="/hero-canvas.webp"
                width={1600}
                height={830}
                alt="Bottlenecker canvas: a load balancer feeding two API servers at 83% and a database critical at 178% on its write path"
                style={{
                  display: 'block', width: '100%', height: 'auto',
                  borderRadius: 14, border: '1px solid var(--border)',
                  boxShadow: '0 24px 64px color-mix(in srgb, var(--bg-base) 70%, black)',
                }}
              />
            );
            return isPhone ? shot : (
              <Link to="/playground?template=retry-storm" aria-label="Open this Retry Storm example in the Playground">{shot}</Link>
            );
          })()}
          <figcaption style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 12 }}>
            Retry Storm template: retries push the primary database past its write capacity.
          </figcaption>
        </figure>
      </section>

      {/* Ad */}
      <AdBanner
        slot="8258027561"
        size={AD_SIZES.mediumRectangle}
        style={{ padding: '16px 0', background: 'var(--bg-nav)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
      />

      {/* What is Bottlenecker */}
      <section style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: 'clamp(48px, 6vw, 80px) clamp(16px, 5vw, 48px)',
      }}>
        <h2 style={{ ...h2Style, marginBottom: 16 }}>
          What is Bottlenecker?
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.8, margin: 0 }}>
          Bottlenecker is a free, browser-based system architecture simulator. Engineers and architects
          use it to visually model distributed systems — placing servers, databases, caches, load balancers,
          and message queues on an interactive canvas — then simulate realistic traffic loads to identify
          where the system breaks down. No code, no infrastructure, no signup needed. The simulation runs
          in your browser, and your diagrams never leave it.
        </p>
      </section>

      {/* How it works */}
      <section style={{
        background: 'var(--bg-nav)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        padding: 'clamp(48px, 6vw, 80px) clamp(16px, 5vw, 48px)',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <h2 style={{ ...h2Style, textAlign: 'center', marginBottom: 48 }}>
            How It Works
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
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
                  background: `color-mix(in srgb, ${step.color} 12%, transparent)`,
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
                  color: 'var(--text-strong)',
                  margin: 0,
                }}>
                  {step.title}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <AdBanner
        slot="9246623251"
        size={AD_SIZES.mediumRectangle}
        style={{ padding: '16px 0', background: 'var(--bg-nav)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
      />

      {/* Features grid */}
      <section style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: 'clamp(48px, 6vw, 80px) clamp(16px, 5vw, 48px)',
      }}>
        <h2 style={{ ...h2Style, textAlign: 'center', marginBottom: 48 }}>
          Everything You Need
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
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
              <span aria-hidden style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{f.icon}</span>
              <div>
                <h3 style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text-strong)',
                  margin: '0 0 6px',
                }}>
                  {f.title}
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          {isPhone ? (
            <Link to="/lessons" style={{ ...primaryCta, fontSize: 15 }}>Read the Lessons →</Link>
          ) : (
            <button onClick={() => navigate('/playground')} style={{ ...primaryCta, fontSize: 15 }}>
              Try It Free — No Signup →
            </button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-nav)',
        padding: '24px clamp(16px, 5vw, 48px)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 13,
            color: 'var(--text-dim)',
          }}>
            Bottlenecker · by{' '}
            <span style={{ color: 'var(--text-muted)' }}>Arkynate Labs</span>
          </div>
          {pageViews !== null && pageViews > 0 && (
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              · {formatCount(pageViews)} visits since launch
            </span>
          )}
        </div>
        <nav aria-label="Footer" style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
          <Link to="/components" className="bn-link">Components</Link>
          <Link to="/lessons" className="bn-link">Lessons</Link>
          <Link to="/playground" className="bn-link">Playground</Link>
          <Link to="/privacy" className="bn-link">Privacy</Link>
          <a href="https://github.com/Jabito/arkynate-bottlenecker" target="_blank" rel="noopener noreferrer" className="bn-link">
            GitHub
          </a>
          <a href="https://www.paypal.com/paypalme/kingJabito" target="_blank" rel="noopener noreferrer" className="bn-link">
            ☕ Support
          </a>
        </nav>
      </footer>
    </div>
  );
}
