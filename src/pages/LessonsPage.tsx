import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDiagramStore } from '../store/diagramStore';
import { LESSONS, type Lesson } from '../data/lessons';
import { AdBanner } from '../components/AdBanner';

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      background: `${color}22`,
      border: `1px solid ${color}55`,
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
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: '#64748b',
      marginBottom: 6,
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      {children}
    </div>
  );
}

function LessonCard({ lesson }: { lesson: Lesson }) {
  const navigate = useNavigate();
  const { loadTemplate } = useDiagramStore();

  const handleOpen = () => {
    loadTemplate(lesson.diagram);
    navigate('/playground');
  };

  return (
    <div style={{
      background: '#0a1120',
      border: '1px solid #1e2d45',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#22d3ee44'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#1e2d45'; }}
    >
      {/* Card header */}
      <div style={{
        padding: '16px 20px 14px',
        borderBottom: '1px solid #1e2d45',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 20, lineHeight: 1 }}>{lesson.icon}</span>
          <Badge label={lesson.component} color={lesson.badgeColor} />
          <h2 style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 700,
            color: '#f1f5f9',
            fontFamily: "'Space Grotesk', sans-serif",
            lineHeight: 1.3,
          }}>
            {lesson.title}
          </h2>
        </div>
        <p style={{
          margin: 0,
          fontSize: 12,
          color: '#64748b',
          fontFamily: "'Space Grotesk', sans-serif",
          fontStyle: 'italic',
        }}>
          {lesson.subtitle}
        </p>
      </div>

      {/* Card body */}
      <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Problem */}
        <div>
          <SectionLabel>Problem</SectionLabel>
          <p style={{
            margin: 0,
            fontSize: 13,
            color: '#94a3b8',
            lineHeight: 1.65,
            fontFamily: "'Inter', sans-serif",
          }}>
            {lesson.problem}
          </p>
        </div>

        {/* Symptoms */}
        <div>
          <SectionLabel>Symptoms in Production</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {lesson.symptoms.map((s, i) => (
              <li key={i} style={{
                fontSize: 12,
                color: '#94a3b8',
                lineHeight: 1.55,
                fontFamily: "'Inter', sans-serif",
              }}>
                {s}
              </li>
            ))}
          </ul>
        </div>

        {/* Root Cause */}
        <div>
          <SectionLabel>Root Cause</SectionLabel>
          <p style={{
            margin: 0,
            fontSize: 13,
            color: '#94a3b8',
            lineHeight: 1.65,
            fontFamily: "'Inter', sans-serif",
          }}>
            {lesson.rootCause}
          </p>
        </div>

        {/* Mitigations */}
        <div>
          <SectionLabel>Mitigations</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {lesson.mitigations.map((m, i) => (
              <li key={i} style={{
                fontSize: 12,
                color: '#94a3b8',
                lineHeight: 1.55,
                fontFamily: "'Inter', sans-serif",
              }}>
                {m}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 20px 20px' }}>
        <button
          onClick={handleOpen}
          style={{
            width: '100%',
            background: '#0891b2',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            padding: '10px 16px',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "'Space Grotesk', sans-serif",
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#0e7490'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#0891b2'; }}
        >
          Open in Playground →
        </button>
      </div>
    </div>
  );
}

export default function LessonsPage() {
  useEffect(() => {
    document.title = 'Architecture Bottleneck Lessons — Learn to Avoid System Bottlenecks | Bottlenecker';
    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (desc) desc.content = 'Interactive lessons on common system architecture bottlenecks: database overload, cache misses, queue saturation, and more. Learn how to identify and avoid bottlenecks with real diagrams.';
  }, []);

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      background: '#0d1526',
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: '#0d1526',
        borderBottom: '1px solid #1e2d45',
        padding: '20px 32px 16px',
      }}>
        <h1 style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 700,
          color: '#f1f5f9',
          lineHeight: 1.2,
        }}>
          Architecture Bottleneck Lessons
        </h1>
        <p style={{
          margin: '4px 0 0',
          fontSize: 13,
          color: '#64748b',
        }}>
          Real-world system bottleneck scenarios — learn how to identify and avoid architecture bottlenecks with interactive diagrams.
        </p>
      </div>

      <AdBanner
        slot="9084205252"
        format="rectangle"
        style={{ background: '#0d1526', borderBottom: '1px solid #1e2d45' }}
      />

      {/* Card grid */}
      <div style={{
        padding: '28px 32px 48px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(520px, 1fr))',
        gap: 20,
        maxWidth: 1300,
      }}>
        {LESSONS.map(lesson => (
          <LessonCard key={lesson.id} lesson={lesson} />
        ))}
      </div>
    </div>
  );
}
