import { useEffect, useState } from 'react';
import { useDiagramStore } from '../store/diagramStore';
import { analyzeGraph } from '../engine/analyze';
import { getEventCount } from '../lib/analytics';
import type { AnalysisResult, NodeStatus } from '../types';

const STATUS_CONFIG: Record<NodeStatus, { icon: string; color: string }> = {
  healthy:  { icon: '✅', color: '#22c55e' },
  warning:  { icon: '⚠️', color: '#eab308' },
  near:     { icon: '🟠', color: '#f97316' },
  critical: { icon: '🔴', color: '#ef4444' },
};

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms >= 1)    return `${ms.toFixed(0)}ms`;
  return '< 1ms';
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function ResultChip({ r }: { r: AnalysisResult }) {
  const cfg = STATUS_CONFIG[r.status];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 10px',
      background: '#1a2235',
      border: `1px solid ${r.status === 'critical' ? cfg.color : '#1e2d45'}`,
      borderRadius: 20, fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0,
      boxShadow: r.status === 'critical' ? `0 0 8px ${cfg.color}40` : 'none',
    }}>
      <span>{cfg.icon}</span>
      <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{r.label}</span>
      <span style={{ color: cfg.color, fontWeight: 600 }}>{r.utilization.toFixed(0)}%</span>
      {r.errorRatePct > 0 && (
        <span style={{ color: '#ef4444', fontWeight: 600 }}>{r.errorRatePct.toFixed(0)}% err</span>
      )}
      {r.estimatedLatencyMs > 0 && (
        <span style={{ color: '#64748b' }}>~{formatLatency(r.estimatedLatencyMs)}</span>
      )}
    </div>
  );
}

const STRESS_MULTIPLIERS = [0.5, 1, 2, 5, 10];

const STATUS_COLOR: Record<NodeStatus, string> = {
  healthy: '#22c55e',
  warning: '#eab308',
  near: '#f97316',
  critical: '#ef4444',
};

function toStatus(util: number): NodeStatus {
  if (util > 100) return 'critical';
  if (util > 90)  return 'near';
  if (util > 70)  return 'warning';
  return 'healthy';
}

function StressTestOverlay({ onClose }: { onClose: () => void }) {
  const { nodes, edges } = useDiagramStore();

  const runs = STRESS_MULTIPLIERS.map(m => {
    const { results } = analyzeGraph(nodes, edges, m);
    return { multiplier: m, results };
  });

  const nodeRows = runs[0].results.filter(r => r.kind !== 'loadGenerator');

  const getUtil = (nodeId: string, runIdx: number) =>
    runs[runIdx].results.find(r => r.nodeId === nodeId)?.utilization ?? 0;

  const firstBreaks = nodeRows.map(nr => {
    const breakIdx = runs.findIndex(r => (r.results.find(res => res.nodeId === nr.nodeId)?.utilization ?? 0) > 100);
    return { label: nr.label, breakAt: breakIdx >= 0 ? STRESS_MULTIPLIERS[breakIdx] : null };
  }).filter(f => f.breakAt !== null);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#111827', border: '1px solid #1e2d45', borderRadius: 12,
        padding: 24, maxWidth: 720, width: '90%', maxHeight: '80vh', overflowY: 'auto',
      }} className="scrollbar-thin">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>
            🧪 Stress Test
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {nodeRows.length === 0 ? (
          <div style={{ fontSize: 12, color: '#475569' }}>No nodes to stress test (add non-generator nodes).</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #1e2d45' }}>
                      Node
                    </th>
                    {STRESS_MULTIPLIERS.map(m => (
                      <th key={m} style={{ padding: '6px 8px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #1e2d45', textAlign: 'center' }}>
                        {m}×
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nodeRows.map(nr => (
                    <tr key={nr.nodeId} style={{ borderBottom: '1px solid #0d1526' }}>
                      <td style={{ padding: '6px 8px', color: '#e2e8f0', fontWeight: 500 }}>{nr.label}</td>
                      {STRESS_MULTIPLIERS.map((_, colIdx) => {
                        const util = getUtil(nr.nodeId, colIdx);
                        const status = toStatus(util);
                        const color = STATUS_COLOR[status];
                        return (
                          <td key={colIdx} style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <span style={{
                              color, fontWeight: 600,
                              background: `${color}20`,
                              padding: '2px 8px', borderRadius: 4,
                            }}>
                              {util.toFixed(0)}%
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 16, padding: 12, background: '#0d1526', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Space Grotesk', sans-serif" }}>
                First breaks at
              </div>
              {firstBreaks.length === 0 ? (
                <div style={{ fontSize: 12, color: '#22c55e' }}>✅ No nodes break even at 10× load</div>
              ) : firstBreaks.map(f => (
                <div key={f.label} style={{ fontSize: 12, color: '#e2e8f0', marginBottom: 4 }}>
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>{f.label}</span>
                  {' '}breaks at{' '}
                  <span style={{ color: '#f97316', fontWeight: 600 }}>{f.breakAt}×</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AnalysisBar() {
  const { analysisResults, runAnalysis, nodes, edges, analyzeCount, undo, redo, getShareURL } = useDiagramStore();
  const [showStress, setShowStress] = useState(false);
  const [globalCount, setGlobalCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const hasNodes    = nodes.length > 0;
  const criticalCount = analysisResults.filter(r => r.status === 'critical').length;
  const hasResults  = analysisResults.length > 0;

  const maxCumulativeLatency = hasResults
    ? Math.max(...analysisResults.map(r => r.cumulativeLatencyMs ?? 0))
    : 0;

  // Fetch global analyze count on mount
  useEffect(() => {
    getEventCount('analyze_click').then(setGlobalCount);
  }, []);

  // Keyboard shortcuts: Cmd/Ctrl+Enter → analyze, Cmd/Ctrl+Z → undo, Cmd/Ctrl+Shift+Z → redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isTyping =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement;
      if (isTyping) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (hasNodes) runAnalysis();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasNodes, runAnalysis, undo, redo]);

  const handleShare = () => {
    const url = getShareURL();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      {showStress && <StressTestOverlay onClose={() => setShowStress(false)} />}
      <div style={{
        height: 52, background: '#0d1526', borderTop: '1px solid #1e2d45',
        display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', overflow: 'hidden',
      }}>
        <button
          onClick={runAnalysis}
          disabled={!hasNodes}
          title="Analyze (⌘Enter)"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px',
            background: hasNodes ? 'linear-gradient(135deg, #0891b2, #7c3aed)' : '#1a2235',
            border: 'none', borderRadius: 8,
            color: hasNodes ? '#fff' : '#475569',
            fontSize: 12, fontWeight: 600,
            fontFamily: "'Space Grotesk', sans-serif",
            cursor: hasNodes ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          ⚡ Analyze
        </button>

        {/* Bottlenecks analyzed chip — shown right after Analyze button */}
        {globalCount !== null && globalCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px',
            background: '#0d1f35',
            border: '1px solid #1e3a52',
            borderRadius: 20, fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0,
            color: '#64748b',
          }}>
            <span style={{ color: '#22d3ee', fontWeight: 700 }}>{formatCount(globalCount)}</span>
            <span>Bottlenecks Analyzed</span>
          </div>
        )}

        <button
          onClick={() => setShowStress(true)}
          disabled={!hasNodes}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px',
            background: hasNodes ? '#1a2235' : '#111827',
            border: `1px solid ${hasNodes ? '#1e2d45' : 'transparent'}`,
            borderRadius: 8,
            color: hasNodes ? '#94a3b8' : '#475569',
            fontSize: 12, fontWeight: 600,
            fontFamily: "'Space Grotesk', sans-serif",
            cursor: hasNodes ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          🧪 Stress Test
        </button>

        <button
          onClick={handleShare}
          disabled={!hasNodes}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px',
            background: copied ? '#0f2a1a' : (hasNodes ? '#1a2235' : '#111827'),
            border: `1px solid ${copied ? '#22c55e' : (hasNodes ? '#1e2d45' : 'transparent')}`,
            borderRadius: 8,
            color: copied ? '#22c55e' : (hasNodes ? '#94a3b8' : '#475569'),
            fontSize: 12, fontWeight: 600,
            fontFamily: "'Space Grotesk', sans-serif",
            cursor: hasNodes ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap', flexShrink: 0,
            transition: 'all 0.2s',
          }}
        >
          {copied ? '✓ Copied' : '🔗 Share'}
        </button>

        <div style={{ width: 1, height: 28, background: '#1e2d45', flexShrink: 0 }} />

        {/* Session stats */}
        {analyzeCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 8px',
            background: '#0d1f35',
            border: '1px solid #1e2d45',
            borderRadius: 12, fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0,
            color: '#64748b',
          }}>
            <span>You've run</span>
            <span style={{ color: '#94a3b8', fontWeight: 600 }}>{analyzeCount}</span>
            <span>{analyzeCount === 1 ? 'analysis' : 'analyses'}</span>
          </div>
        )}

        {analyzeCount > 0 ? (
          <div style={{ width: 1, height: 20, background: '#1e2d45', flexShrink: 0 }} />
        ) : null}

        {!hasResults ? (
          <span style={{ fontSize: 11, color: '#475569' }}>
            {hasNodes
              ? `${nodes.length} node${nodes.length !== 1 ? 's' : ''}, ${edges.length} connection${edges.length !== 1 ? 's' : ''} — click Analyze to simulate`
              : 'Add components to the canvas to get started'}
          </span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', flex: 1 }}>
            {criticalCount > 0 ? (
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 700, color: '#ef4444', whiteSpace: 'nowrap', flexShrink: 0 }}>
                🔴 {criticalCount} bottleneck{criticalCount !== 1 ? 's' : ''}
              </div>
            ) : (
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 700, color: '#22c55e', whiteSpace: 'nowrap', flexShrink: 0 }}>
                ✅ All clear
              </div>
            )}
            {maxCumulativeLatency > 0 && (
              <>
                <div style={{ width: 1, height: 20, background: '#1e2d45', flexShrink: 0 }} />
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  Est. P50: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{formatLatency(maxCumulativeLatency)}</span>
                </div>
              </>
            )}
            <div style={{ width: 1, height: 20, background: '#1e2d45', flexShrink: 0 }} />
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', alignItems: 'center' }} className="scrollbar-thin">
              {analysisResults.map(r => <ResultChip key={r.nodeId} r={r} />)}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
