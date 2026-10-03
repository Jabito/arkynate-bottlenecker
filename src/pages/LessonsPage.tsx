import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDiagramStore } from '../store/diagramStore';
import { LESSONS, type Lesson } from '../data/lessons';
import { AdBanner } from '../components/AdBanner';

const GRID_MAX = 1680;
const GUTTER = 'clamp(16px, 4vw, 32px)';

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      background: `color-mix(in srgb, ${color} 13%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 33%, transparent)`,
      color: color,
      borderRadius: 20,
      padding: '2px 10px',
      fontSize: 11,
      fontWeight: 600,
      fontFamily: "'Space Grotesk', sans-serif",
      letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--text-dim)',
      margin: '0 0 6px',
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      {children}
    </h3>
  );
}

const proseStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: 'var(--text-muted)',
  lineHeight: 1.65,
  fontFamily: "'Inter', sans-serif",
};

const listStyle: React.CSSProperties = { margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 };
const itemStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, fontFamily: "'Inter', sans-serif" };

function LessonCard({ lesson }: { lesson: Lesson }) {
  const navigate = useNavigate();
  const loadTemplate = useDiagramStore(s => s.loadTemplate);
  const isDirty = useDiagramStore(s => s.isDirty);
  const diagramName = useDiagramStore(s => s.diagramName);
  const [confirming, setConfirming] = useState(false);

  const open = () => {
    loadTemplate(lesson.diagram);
    navigate('/playground');
  };

  // Ask first when the playground has unsaved work (#10); the replace stays undoable.
  const handleOpen = () => {
    if (isDirty) setConfirming(true);
    else open();
  };

  return (
    <article
      id={lesson.id}
      className="bn-lesson-card"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      {/* Card header */}
      <div style={{
        padding: '16px 20px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>{lesson.icon}</span>
          <Badge label={lesson.component} color={lesson.badgeColor} />
          <h2 style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--text-strong)',
            fontFamily: "'Space Grotesk', sans-serif",
            lineHeight: 1.3,
          }}>
            {lesson.title}
          </h2>
        </div>
        <p style={{
          margin: 0,
          fontSize: 12,
          color: 'var(--text-dim)',
          fontFamily: "'Space Grotesk', sans-serif",
          fontStyle: 'italic',
        }}>
          {lesson.subtitle}
        </p>
      </div>

      {/* Card body */}
      <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <SectionLabel>Problem</SectionLabel>
          <p style={proseStyle}>{lesson.problem}</p>
        </div>

        <div>
          <SectionLabel>Symptoms in Production</SectionLabel>
          <ul className="bn-list" style={listStyle}>
            {lesson.symptoms.map((s, i) => <li key={i} style={itemStyle}>{s}</li>)}
          </ul>
        </div>

        <div>
          <SectionLabel>Root Cause</SectionLabel>
          <p style={proseStyle}>{lesson.rootCause}</p>
        </div>

        <div>
          <SectionLabel>Mitigations</SectionLabel>
          <ul className="bn-list" style={listStyle}>
            {lesson.mitigations.map((m, i) => <li key={i} style={itemStyle}>{m}</li>)}
          </ul>
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 20px 20px' }}>
        {confirming ? (
          <div role="alertdialog" aria-label="Replace the current diagram?" style={{
            border: '1px solid var(--st-warning)', borderRadius: 8, padding: '10px 12px',
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
          }}>
            <div style={{ flex: '1 1 200px', fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
              Replace “{diagramName}” on the playground? Its unsaved changes stay reachable with Undo (⌘Z).
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="bn-btn-primary" onClick={open}>Open lesson</button>
              <button className="bn-btn-ghost" autoFocus onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleOpen}
            className="bn-btn-primary"
            style={{
              width: '100%',
              borderRadius: 8,
              padding: '10px 16px',
              fontSize: 13,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Open in Playground →
          </button>
        )}
      </div>
    </article>
  );
}

export default function LessonsPage() {
  useEffect(() => {
    document.title = 'Architecture Bottleneck Lessons — Learn to Avoid System Bottlenecks | Bottlenecker';
    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (desc) desc.content = 'Lessons on common system architecture bottlenecks: database overload, cache misses, queue saturation, and more. Learn how to identify and avoid bottlenecks with real diagrams.';
  }, []);

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      background: 'var(--bg-nav)',
      color: 'var(--text)',
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'var(--bg-nav)',
        borderBottom: '1px solid var(--border)',
        padding: `20px ${GUTTER} 16px`,
      }}>
        <div style={{ maxWidth: GRID_MAX, margin: '0 auto' }}>
          <h1 style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text-strong)',
            lineHeight: 1.2,
          }}>
            Architecture Bottleneck Lessons
          </h1>
          <p style={{
            margin: '4px 0 0',
            fontSize: 13,
            color: 'var(--text-muted)',
          }}>
            Real-world system bottleneck scenarios — read why each one happens, then open it in the playground and try the fix.
          </p>
        </div>
      </div>

      <AdBanner
        slot="9084205252"
        format="rectangle"
        style={{ background: 'var(--bg-nav)', borderBottom: '1px solid var(--border)' }}
      />

      {/* Card grid (#20 #87) */}
      <div style={{
        padding: `28px ${GUTTER} 48px`,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(520px, 100%), 1fr))',
        gap: 20,
        maxWidth: GRID_MAX,
        margin: '0 auto',
        boxSizing: 'content-box',
      }}>
        {LESSONS.map(lesson => (
          <LessonCard key={lesson.id} lesson={lesson} />
        ))}
      </div>
    </div>
  );
}
