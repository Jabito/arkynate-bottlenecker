import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useDiagramStore } from '../store/diagramStore';
import { analyzeGraph } from '../engine/analyze';
import { maxSustainableMultiplier } from '../engine/stress';
import { statusOf, formatQPS, formatLatency } from '../engine/format';
import { STATUS_STYLE, STATUS_LEGEND, tint } from '../nodes/status';
import { getEventCount } from '../lib/analytics';
import type { AnalysisResult, AnalysisMeta, AnalysisWarning } from '../types';

const FONT_HEAD = "'Space Grotesk', sans-serif";
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const pct = (v: number) => (v < 1 && v > 0 ? v.toFixed(1) : v.toFixed(0));
const successText = (v: number) => (v >= 99.95 ? '100' : v.toFixed(1));

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el.isContentEditable);
}

/** Close a popover on Escape or a press outside it. */
function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onDown); };
  }, [open, close, ref]);
}

const barButton = (enabled: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '6px 12px',
  background: enabled ? 'var(--bg-elevated)' : 'transparent',
  border: `1px solid ${enabled ? 'var(--border)' : 'transparent'}`,
  borderRadius: 8,
  color: enabled ? 'var(--text-muted)' : 'var(--text-dim)',
  opacity: enabled ? 1 : 0.6,
  fontSize: 12, fontWeight: 600, fontFamily: FONT_HEAD,
  cursor: enabled ? 'pointer' : 'not-allowed',
  whiteSpace: 'nowrap', flexShrink: 0,
});

const popoverStyle: React.CSSProperties = {
  position: 'absolute', bottom: 'calc(100% + 8px)', zIndex: 50,
  background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
  boxShadow: '0 8px 32px var(--shadow)', padding: 14, fontSize: 12, color: 'var(--text)',
};

const Divider = () => <div aria-hidden="true" style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />;

// ── Result chips ───────────────────────────────────────────────────────────

function ResultChip({ r, onSelect }: { r: AnalysisResult; onSelect: (id: string) => void }) {
  const s = STATUS_STYLE[r.status];
  const latency = Number.isFinite(r.estimatedLatencyMs) ? `~${formatLatency(r.estimatedLatencyMs)}` : '∞';
  const detail = [
    `${r.label}: ${s.label}, ${pct(r.utilization)}% of ${formatQPS(r.capacity)}`,
    r.errorRatePct > 0 ? `${pct(r.errorRatePct)}% errors` : '',
    r.backlogQPS > 0 ? `backlog +${formatQPS(r.backlogQPS)}` : '',
    r.async ? 'async (behind a queue)' : `latency ${latency}`,
  ].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      onClick={() => onSelect(r.nodeId)}
      title={`${detail} — click to select`}
      aria-label={`${detail}. Select and centre`}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px',
        background: 'var(--bg-elevated)',
        border: `1px solid ${r.status === 'critical' ? s.color : 'var(--border)'}`,
        borderRadius: 20, fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer',
        boxShadow: r.status === 'critical' ? `0 0 8px ${tint(s.color, 30)}` : 'none',
        color: 'var(--text)',
      }}
    >
      <span aria-hidden="true">{s.icon}</span>
      <span style={{ fontWeight: 500 }}>{r.label}</span>
      <span style={{ color: s.color, fontWeight: 600 }}>{pct(r.utilization)}%</span>
      {r.errorRatePct > 0 && <span style={{ color: 'var(--st-critical)', fontWeight: 600 }}>{pct(r.errorRatePct)}% err</span>}
      {r.backlogQPS > 0 && <span style={{ color: 'var(--st-critical)' }}>+{formatQPS(r.backlogQPS)} backlog</span>}
      {!r.async && r.actualQPS > 0 && <span style={{ color: 'var(--text-dim)' }}>{latency}</span>}
    </button>
  );
}

// ── Details popover: critical path + engine warnings ───────────────────────

const WARNING_ICON: Record<AnalysisWarning['kind'], string> = {
  cycle: '🔁', unallocated: '↘', overallocated: '％', backlog: '📥', convergence: '≈', invalid: '✎',
};

function DetailsPopover({ meta, onSelect }: { meta: AnalysisMeta; onSelect: (id: string) => void }) {
  // Mounted only while open, so the bar itself never subscribes to node drags (#43).
  const nodes = useDiagramStore(s => s.nodes);
  const labels = useMemo(() => new Map(nodes.map(n => [n.id, n.data.label])), [nodes]);
  const path = meta.criticalPath;
  return (
    <div role="dialog" aria-label="Analysis details" style={{ ...popoverStyle, left: 0, width: 380, maxHeight: '60vh', overflowY: 'auto' }} className="scrollbar-thin">
      <div style={{ fontFamily: FONT_HEAD, fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Critical path (slowest request path)
      </div>
      {path.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', marginBottom: 12 }}>No traffic reaches any component yet.</div>
      ) : (
        <ol style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
          {path.map((id, i) => (
            <li key={id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {i > 0 && <span aria-hidden="true" style={{ color: 'var(--text-dim)' }}>→</span>}
              <button type="button" onClick={() => onSelect(id)} className="bn-btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }}>
                {labels.get(id) ?? id}
              </button>
            </li>
          ))}
        </ol>
      )}
      <div style={{ fontFamily: FONT_HEAD, fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Model notes {meta.warnings.length > 0 && `(${meta.warnings.length})`}
      </div>
      {meta.warnings.length === 0 ? (
        <div style={{ color: 'var(--text-dim)' }}>None — every request is accounted for.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {meta.warnings.map((w, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, lineHeight: 1.5 }}>
              <span aria-hidden="true" style={{ flexShrink: 0, width: 16, textAlign: 'center' }}>{WARNING_ICON[w.kind]}</span>
              {w.nodeId ? (
                <button type="button" onClick={() => onSelect(w.nodeId!)} style={{ all: 'unset', cursor: 'pointer', color: 'var(--text)' }} title="Select this component">
                  {w.message}
                </button>
              ) : <span>{w.message}</span>}
            </li>
          ))}
        </ul>
      )}
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
        Latency is the M/M/1 mean along the request path, weighted by traffic. Requests end at a queue once enqueued.
      </div>
    </div>
  );
}

// ── Shortcuts + legend popover ─────────────────────────────────────────────

const SHORTCUTS: [string, string][] = [
  [`${MOD} Enter`, 'Analyze now'],
  [`${MOD} Z`, 'Undo'],
  [`${MOD} ⇧ Z`, 'Redo'],
  ['Delete / Backspace', 'Remove the selection'],
  ['Drag on canvas', 'Box-select'],
  ['Right / middle drag', 'Pan'],
  ['?', 'Show this help'],
];

function ShortcutsPopover() {
  return (
    <div role="dialog" aria-label="Keyboard shortcuts" style={{ ...popoverStyle, right: 0, width: 280 }}>
      <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, marginBottom: 8 }}>Shortcuts</div>
      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', margin: 0 }}>
        {SHORTCUTS.map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt><kbd style={{ fontFamily: 'inherit', fontSize: 11, padding: '1px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-elevated)' }}>{k}</kbd></dt>
            <dd style={{ margin: 0, color: 'var(--text-muted)' }}>{v}</dd>
          </div>
        ))}
      </dl>
      <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, margin: '12px 0 6px' }}>Status colours</div>
      <StatusLegend vertical />
    </div>
  );
}

function StatusLegend({ vertical = false }: { vertical?: boolean }) {
  return (
    <ul aria-label="Status legend (utilisation)" style={{
      display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: vertical ? 4 : 8,
      listStyle: 'none', padding: 0, margin: 0, fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap',
    }}>
      {STATUS_LEGEND.map(({ status, range }) => (
        <li key={status} style={{ display: 'flex', alignItems: 'center', gap: 4 }} title={`${STATUS_STYLE[status].label}: ${range} of capacity`}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_STYLE[status].color, flexShrink: 0 }} />
          {vertical ? `${STATUS_STYLE[status].label} — ${range}` : range}
        </li>
      ))}
    </ul>
  );
}

// ── Stress test dialog ─────────────────────────────────────────────────────

const STRESS_MULTIPLIERS = [0.5, 1, 2, 5, 10];

function StressTestDialog({ onClose }: { onClose: () => void }) {
  const nodes = useDiagramStore(s => s.nodes);
  const edges = useDiagramStore(s => s.edges);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Five runs plus the sustainable-load search, once per diagram (#81).
  const stress = useMemo(() => {
    const runs = STRESS_MULTIPLIERS.map(m => new Map(analyzeGraph(nodes, edges, m).results.map(r => [r.nodeId, r])));
    const base = analyzeGraph(nodes, edges, 1);
    const maxM = maxSustainableMultiplier(nodes, edges);
    const firstToBreak = Number.isFinite(maxM)
      ? analyzeGraph(nodes, edges, maxM * 1.001).results.filter(r => r.status === 'critical' && r.actualQPS > 0).map(r => r.label)
      : [];
    const rows = base.results
      .filter(r => r.actualQPS > 0)
      .sort((a, b) => a.headroom - b.headroom);
    return { runs, rows, maxM, firstToBreak, generated: base.meta.generatedQPS };
  }, [nodes, edges]);

  // Focus moves in, Tab stays inside, Escape closes, focus returns to the opener.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); opener?.focus(); };
  }, [onClose]);

  const th: React.CSSProperties = { padding: '6px 8px', color: 'var(--text-dim)', fontWeight: 600, borderBottom: '1px solid var(--border)', textAlign: 'center' };
  const { maxM } = stress;

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stress-title"
        style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
          padding: 24, maxWidth: 760, width: '90%', maxHeight: '80vh', overflowY: 'auto', color: 'var(--text)',
        }}
        className="scrollbar-thin"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 id="stress-title" style={{ fontFamily: FONT_HEAD, fontSize: 15, fontWeight: 700, color: 'var(--text-strong)', margin: 0 }}>
            🧪 Stress Test
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close stress test"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>
            ×
          </button>
        </div>

        {stress.rows.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No traffic reaches any component. Connect a load generator first.</div>
        ) : (
          <>
            <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: FONT_HEAD, marginBottom: 4 }}>
                Max sustainable load
              </div>
              {Number.isFinite(maxM) ? (
                <div style={{ fontSize: 13 }}>
                  <strong style={{ color: maxM < 1 ? 'var(--st-critical)' : 'var(--text-strong)', fontFamily: FONT_HEAD, fontSize: 18 }}>
                    {maxM.toFixed(2)}×
                  </strong>{' '}
                  of today's load ({formatQPS(stress.generated * maxM)}).{' '}
                  {stress.firstToBreak.length > 0 && <>First to reach 100%: <strong>{stress.firstToBreak.join(', ')}</strong>.</>}
                  {maxM < 1 && <> Already over capacity at 1×.</>}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--st-healthy)' }}>Nothing saturates even at 10,000× load.</div>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <caption style={{ textAlign: 'left', fontSize: 11, color: 'var(--text-dim)', paddingBottom: 6 }}>
                  Utilisation at each multiple of load. Headroom = capacity ÷ load today.
                </caption>
                <thead>
                  <tr>
                    <th scope="col" style={{ ...th, textAlign: 'left' }}>Component</th>
                    {STRESS_MULTIPLIERS.map(m => <th scope="col" key={m} style={th}>{m}×</th>)}
                    <th scope="col" style={th}>Headroom</th>
                  </tr>
                </thead>
                <tbody>
                  {stress.rows.map(row => (
                    <tr key={row.nodeId} style={{ borderBottom: '1px solid var(--border)' }}>
                      <th scope="row" style={{ padding: '6px 8px', color: 'var(--text)', fontWeight: 500, textAlign: 'left' }}>{row.label}</th>
                      {stress.runs.map((run, i) => {
                        const util = run.get(row.nodeId)?.utilization ?? 0;
                        const color = STATUS_STYLE[statusOf(util)].color;
                        return (
                          <td key={i} style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <span style={{ color, fontWeight: 600, background: tint(color, 12), padding: '2px 8px', borderRadius: 4 }}>
                              {Number.isFinite(util) ? `${util.toFixed(0)}%` : '∞'}
                            </span>
                          </td>
                        );
                      })}
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: row.headroom < 1 ? 'var(--st-critical)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {Number.isFinite(row.headroom) ? `${row.headroom.toFixed(2)}×` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── The bar ────────────────────────────────────────────────────────────────

export function AnalysisBar() {
  const analysisResults = useDiagramStore(s => s.analysisResults);
  const meta = useDiagramStore(s => s.analysisMeta);
  const nodeCount = useDiagramStore(s => s.nodes.length);
  const edgeCount = useDiagramStore(s => s.edges.length);
  const runAnalysis = useDiagramStore(s => s.runAnalysis);
  const undo = useDiagramStore(s => s.undo);
  const redo = useDiagramStore(s => s.redo);
  const canUndo = useDiagramStore(s => s._history.length > 0);
  const canRedo = useDiagramStore(s => s._future.length > 0);
  const setSelectedNode = useDiagramStore(s => s.setSelectedNode);
  const getShareURL = useDiagramStore(s => s.getShareURL);
  const { fitView } = useReactFlow();

  const [showStress, setShowStress] = useState(false);
  const [popover, setPopover] = useState<'details' | 'help' | null>(null);
  const [globalCount, setGlobalCount] = useState<number | null>(null);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  const closePopover = useCallback(() => setPopover(null), []);
  useDismiss(popover === 'details', closePopover, detailsRef);
  useDismiss(popover === 'help', closePopover, helpRef);

  const hasNodes = nodeCount > 0;
  const counts = useMemo(() => {
    let critical = 0, stressed = 0;
    for (const r of analysisResults) {
      if (r.status === 'critical') critical++;
      else if (r.status === 'warning' || r.status === 'near') stressed++;
    }
    return { critical, stressed };
  }, [analysisResults]);

  useEffect(() => {
    getEventCount('analyze_click').then(setGlobalCount);
  }, []);

  const selectNode = useCallback((id: string) => {
    setSelectedNode(id);
    setPopover(null);
    fitView({ nodes: [{ id }], duration: 300, padding: 0.6, maxZoom: 1.2 });
  }, [setSelectedNode, fitView]);

  const analyzeNow = useCallback(() => runAnalysis({ explicit: true }), [runAnalysis]);

  // ⌘/Ctrl+Enter → analyze, ⌘/Ctrl+Z → undo, ⌘/Ctrl+Shift+Z → redo, ? → shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTyping()) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        if (hasNodes) analyzeNow();
      } else if (mod && e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if (!mod && e.key === '?') {
        e.preventDefault();
        setPopover(p => (p === 'help' ? null : 'help'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasNodes, analyzeNow, undo, redo]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(await getShareURL());
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
    setTimeout(() => setCopied(null), 2500);
  };

  const latency = meta?.endToEndLatencyMs;
  const warningCount = meta?.warnings.length ?? 0;

  return (
    <>
      {showStress && <StressTestDialog onClose={() => setShowStress(false)} />}
      <div
        role="region"
        aria-label="Analysis"
        style={{
          height: 52, background: 'var(--bg-surface)', borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={analyzeNow}
          disabled={!hasNodes}
          title={`Analysis re-runs on every change. Run now (${MOD} Enter)`}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
            background: hasNodes ? 'var(--accent-strong)' : 'var(--bg-elevated)',
            border: 'none', borderRadius: 8,
            color: hasNodes ? 'var(--on-accent)' : 'var(--text-dim)',
            fontSize: 12, fontWeight: 600, fontFamily: FONT_HEAD,
            cursor: hasNodes ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          ⚡ Analyze
        </button>

        <button type="button" onClick={undo} disabled={!canUndo} title={`Undo (${MOD} Z)`} aria-label="Undo" style={{ ...barButton(canUndo), padding: '6px 9px' }}>↶</button>
        <button type="button" onClick={redo} disabled={!canRedo} title={`Redo (${MOD} ⇧ Z)`} aria-label="Redo" style={{ ...barButton(canRedo), padding: '6px 9px' }}>↷</button>

        {globalCount !== null && globalCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
            background: 'var(--bg-base)', border: '1px solid var(--border)',
            borderRadius: 20, fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0, color: 'var(--text-dim)',
          }}>
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>🌐 {formatCount(globalCount)}</span>
            <span>simulations worldwide</span>
          </div>
        )}

        <button type="button" onClick={() => setShowStress(true)} disabled={!hasNodes} style={barButton(hasNodes)}>
          🧪 Stress Test
        </button>

        <button
          type="button"
          onClick={handleShare}
          disabled={!hasNodes}
          aria-live="polite"
          style={{
            ...barButton(hasNodes),
            ...(copied === 'ok' ? { color: 'var(--st-healthy)', borderColor: 'var(--st-healthy)' } : {}),
            ...(copied === 'fail' ? { color: 'var(--st-critical)', borderColor: 'var(--st-critical)' } : {}),
          }}
        >
          {copied === 'ok' ? '✓ Link copied' : copied === 'fail' ? 'Copy failed' : '🔗 Share'}
        </button>

        <Divider />

        {!meta || !hasNodes ? (
          <span style={{ fontSize: 11, color: 'var(--text-dim)', flex: 1 }}>
            {hasNodes
              ? `${nodeCount} node${nodeCount !== 1 ? 's' : ''}, ${edgeCount} connection${edgeCount !== 1 ? 's' : ''}`
              : 'Add components to the canvas, or start from a template'}
          </span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', flex: 1, minWidth: 0 }}>
            <div aria-live="polite" style={{ fontFamily: FONT_HEAD, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
              color: counts.critical > 0 ? 'var(--st-critical)' : 'var(--st-healthy)' }}>
              {counts.critical > 0
                ? `🔴 ${counts.critical} bottleneck${counts.critical !== 1 ? 's' : ''}`
                : '✅ No bottlenecks'}
              {counts.stressed > 0 && (
                <span style={{ color: 'var(--st-warning)', fontWeight: 600 }}> · {counts.stressed} warning{counts.stressed !== 1 ? 's' : ''}</span>
              )}
            </div>

            {latency != null && (
              <>
                <Divider />
                <div style={{ fontFamily: FONT_HEAD, fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap', flexShrink: 0 }}
                  title="Mean request latency (M/M/1), weighted by traffic along the synchronous path">
                  Est. latency (mean):{' '}
                  {Number.isFinite(latency)
                    ? <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{formatLatency(latency)}</span>
                    : <span style={{ color: 'var(--st-critical)', fontWeight: 600 }}>∞ / saturated</span>}
                </div>
                <div style={{ fontFamily: FONT_HEAD, fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap', flexShrink: 0 }}
                  title="Share of generated requests that complete successfully end to end">
                  Success:{' '}
                  <span style={{ fontWeight: 600, color: meta.successRatePct >= 99 ? 'var(--text-muted)' : meta.successRatePct >= 90 ? 'var(--st-warning)' : 'var(--st-critical)' }}>
                    {successText(meta.successRatePct)}%
                  </span>
                </div>
              </>
            )}

            <div ref={detailsRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setPopover(p => (p === 'details' ? null : 'details'))}
                aria-expanded={popover === 'details'}
                aria-haspopup="dialog"
                style={{ ...barButton(true), padding: '4px 10px', fontSize: 11,
                  ...(warningCount > 0 ? { color: 'var(--st-warning)', borderColor: tint('var(--st-warning)', 60) } : {}) }}
              >
                {warningCount > 0 ? `⚠ ${warningCount} note${warningCount !== 1 ? 's' : ''}` : 'Path'} ▾
              </button>
              {popover === 'details' && <DetailsPopover meta={meta} onSelect={selectNode} />}
            </div>

            <Divider />
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', alignItems: 'center', minWidth: 0 }} className="scrollbar-thin">
              {analysisResults.map(r => <ResultChip key={r.nodeId} r={r} onSelect={selectNode} />)}
            </div>
          </div>
        )}

        <div style={{ flexShrink: 0 }}><StatusLegend /></div>

        <div ref={helpRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setPopover(p => (p === 'help' ? null : 'help'))}
            aria-expanded={popover === 'help'}
            aria-haspopup="dialog"
            aria-label="Keyboard shortcuts and legend"
            title="Shortcuts (?)"
            style={{ ...barButton(true), padding: '4px 10px', borderRadius: '50%' }}
          >
            ?
          </button>
          {popover === 'help' && <ShortcutsPopover />}
        </div>
      </div>
    </>
  );
}
