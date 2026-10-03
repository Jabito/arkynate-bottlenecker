import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useReactFlow } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { useDiagramStore } from '../store/diagramStore';
import { LESSONS, type LessonCondition } from '../data/lessons';
import { evaluateCondition, type ConditionState } from '../lib/lessonChecks';

/*
 * Interactive lessons (#100). Shown on /playground while `activeLessonId` is set: the goal,
 * the steps and the success checks, re-evaluated after every auto-analysis. Lazy-loaded by
 * PlaygroundPage, so the lesson data stays out of the playground chunk until a lesson opens.
 */

const WIDTH = 264;
const FONT_HEAD = "'Space Grotesk', sans-serif";

const headingStyle: CSSProperties = {
  fontFamily: FONT_HEAD, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--text-dim)', margin: '0 0 6px',
};

const iconButton: CSSProperties = {
  width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)',
  cursor: 'pointer', fontSize: 13, flexShrink: 0, padding: 0,
};

/** Live state of each condition. Re-renders only when a tick or a shown value changes, not on drag frames. */
function useConditions(conditions: LessonCondition[]): ConditionState[] {
  const flat = useDiagramStore(useShallow(s => conditions.flatMap(c => {
    const r = evaluateCondition(c, { nodes: s.nodes, results: s.analysisResults, meta: s.analysisMeta });
    return [r.ok, r.now];
  })));
  return useMemo(() => {
    const out: ConditionState[] = [];
    for (let i = 0; i < flat.length; i += 2) out.push({ ok: flat[i] as boolean, now: flat[i + 1] as string });
    return out;
  }, [flat]);
}

function Mark({ ok, label }: { ok: boolean | undefined; label: string }) {
  return (
    <span
      className={`bn-lesson-mark${ok ? ' is-done' : ''}`}
      aria-hidden="true"
    >
      {ok ? '✓' : label}
    </span>
  );
}

export default function LessonPanel() {
  const lessonId = useDiagramStore(s => s.activeLessonId);
  const loadLesson = useDiagramStore(s => s.loadLesson);
  const endLesson = useDiagramStore(s => s.endLesson);
  const index = LESSONS.findIndex(l => l.id === lessonId);
  const lesson = index >= 0 ? LESSONS[index] : null;
  const next = index >= 0 ? LESSONS[index + 1] : undefined;
  const [collapsed, setCollapsed] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const focusAfter = useRef<'toggle' | 'title' | null>(null);

  // The panel narrows the canvas after the load's fit (it loads lazily), so fit again when it mounts or
  // toggles. Not on lesson changes: the width stays the same and the load's own fit (loadId) covers it.
  const { fitView } = useReactFlow();
  // Two frames: xyflow learns the new pane width from a ResizeObserver, which runs after the first.
  useEffect(() => {
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => { void fitView({ padding: 0.15, duration: 200 }); });
    });
    return () => cancelAnimationFrame(raf);
  }, [collapsed, fitView]);

  // Keep keyboard focus in the panel when the focused control disappears (collapse, next lesson).
  useEffect(() => {
    const target = focusAfter.current === 'toggle' ? toggleRef.current : focusAfter.current === 'title' ? titleRef.current : null;
    focusAfter.current = null;
    target?.focus();
  }, [collapsed, lessonId]);

  const toggle = (value: boolean) => {
    focusAfter.current = 'toggle';
    setCollapsed(value);
  };

  // A restored id that no longer names a lesson (renamed or removed) ends quietly.
  useEffect(() => {
    if (lessonId !== null && !lesson) endLesson();
  }, [lessonId, lesson, endLesson]);

  const conditions = useMemo(() => (lesson ? [
    ...lesson.steps.flatMap(s => (s.check ? [s.check] : [])),
    ...lesson.checks.map(c => c.when),
  ] : []), [lesson]);
  const states = useConditions(conditions);

  if (!lesson) return null;

  let k = 0;
  const stepStates = lesson.steps.map(s => (s.check ? states[k++] : undefined));
  const checkStates = lesson.checks.map(() => states[k++]);
  const passed = checkStates.filter(s => s?.ok).length;
  const complete = passed === lesson.checks.length;
  const backHref = `/lessons#${lesson.id}`;

  if (collapsed) {
    return (
      <aside aria-label={`Lesson: ${lesson.title}`} className="bn-lesson-panel is-collapsed">
        <button
          type="button"
          ref={toggleRef}
          onClick={() => toggle(false)}
          aria-expanded={false}
          title="Show the lesson"
          style={{ ...iconButton, width: 32, height: 32 }}
        >
          <span aria-hidden="true">{lesson.icon}</span>
          <span className="sr-only">Show lesson: {lesson.title}</span>
        </button>
        <span
          aria-label={`${passed} of ${lesson.checks.length} checks passed`}
          style={{ fontSize: 11, fontWeight: 700, color: complete ? 'var(--st-healthy)' : 'var(--text-muted)', fontFamily: FONT_HEAD }}
        >
          {complete ? '✓' : `${passed}/${lesson.checks.length}`}
        </span>
      </aside>
    );
  }

  return (
    <aside aria-label={`Lesson: ${lesson.title}`} className="bn-lesson-panel scrollbar-thin" style={{ width: WIDTH }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Link to={backHref} className="bn-lesson-link" style={{ flex: 1 }}>← All lessons</Link>
        <button
          ref={toggleRef} type="button" onClick={() => toggle(true)} aria-expanded={true} aria-controls="bn-lesson-body"
          title="Collapse the lesson panel" aria-label="Collapse the lesson panel" style={iconButton}
        >
          ‹
        </button>
        <button
          type="button" onClick={endLesson}
          title="End the lesson (the diagram stays)" aria-label="End the lesson" style={iconButton}
        >
          ✕
        </button>
      </div>

      <div id="bn-lesson-body">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
          <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1.2 }}>{lesson.icon}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...headingStyle, margin: 0 }}>Lesson {index + 1} of {LESSONS.length}</div>
            <h2 ref={titleRef} tabIndex={-1} style={{ margin: 0, outline: 'none', fontFamily: FONT_HEAD, fontSize: 15, fontWeight: 700, color: 'var(--text-strong)', lineHeight: 1.3 }}>
              {lesson.title}
            </h2>
          </div>
        </div>

        {/* At the top so completion is seen without scrolling the panel. */}
        <div role="status" aria-live="polite" style={{ marginBottom: 14 }}>
          {complete && (
            <div className="bn-lesson-done">
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 14, color: 'var(--st-healthy)', marginBottom: 4 }}>
                ✓ Lesson complete
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 12, lineHeight: 1.5, color: 'var(--text)' }}>
                Every check passes at full load. Try another mitigation from the lesson, or {next ? 'move on' : 'go back: that was the last lesson'}.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {next && (
                  <button type="button" className="bn-btn-primary" onClick={() => { focusAfter.current = 'title'; loadLesson(next); }}>
                    Next lesson →
                  </button>
                )}
                <Link to={backHref} className="bn-btn-ghost" style={{ textDecoration: 'none' }}>Back to lessons</Link>
              </div>
            </div>
          )}
          {!complete && (
            <button
              type="button"
              className="bn-lesson-progress"
              onClick={() => document.getElementById('bn-lesson-checks')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}
            >
              <span style={{ flex: 1 }}>Success check</span>
              <span style={{ fontWeight: 700 }}>{passed} of {lesson.checks.length} passing</span>
            </button>
          )}
        </div>
        <section aria-labelledby="bn-lesson-goal" style={{ marginBottom: 14 }}>
          <h3 id="bn-lesson-goal" style={headingStyle}>Why this breaks</h3>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: 'var(--text)' }}>{lesson.goal}</p>
        </section>

        <section aria-labelledby="bn-lesson-steps" style={{ marginBottom: 14 }}>
          <h3 id="bn-lesson-steps" style={headingStyle}>Steps</h3>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lesson.steps.map((s, i) => {
              const st = stepStates[i];
              return (
                <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.55, color: st?.ok ? 'var(--text-muted)' : 'var(--text)' }}>
                  <Mark ok={st?.ok} label={String(i + 1)} />
                  <span>
                    {s.text}
                    {st?.ok && <span className="sr-only"> (done)</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="bn-lesson-checks" style={{ marginBottom: 14 }}>
          <h3 id="bn-lesson-checks" style={headingStyle}>Success check · {passed}/{lesson.checks.length}</h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {lesson.checks.map((c, i) => {
              const st = checkStates[i];
              return (
                <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12, lineHeight: 1.5 }}>
                  <Mark ok={st?.ok} label="○" />
                  <span style={{ flex: 1, color: 'var(--text)' }}>
                    {c.label}
                    <span className="sr-only">{st?.ok ? ': passed' : ': not yet'}</span>
                  </span>
                  <span style={{ color: st?.ok ? 'var(--st-healthy)' : 'var(--st-critical)', fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {st?.now}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

      </div>
    </aside>
  );
}
