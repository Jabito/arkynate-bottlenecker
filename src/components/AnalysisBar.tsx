import { useDiagramStore } from '../store/diagramStore';
import type { AnalysisResult, NodeStatus } from '../types';

const STATUS_CONFIG: Record<NodeStatus, { icon: string; color: string }> = {
  healthy:  { icon: '✅', color: '#22c55e' },
  warning:  { icon: '⚠️', color: '#eab308' },
  near:     { icon: '🟠', color: '#f97316' },
  critical: { icon: '🔴', color: '#ef4444' },
};

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
    </div>
  );
}

export function AnalysisBar() {
  const { analysisResults, runAnalysis, nodes, edges } = useDiagramStore();
  const hasNodes = nodes.length > 0;
  const criticalCount = analysisResults.filter(r => r.status === 'critical').length;
  const hasResults = analysisResults.length > 0;

  return (
    <div style={{
      height: 52, background: '#0d1526', borderTop: '1px solid #1e2d45',
      display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', overflow: 'hidden',
    }}>
      <button
        onClick={runAnalysis}
        disabled={!hasNodes}
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
      <div style={{ width: 1, height: 28, background: '#1e2d45', flexShrink: 0 }} />
      {!hasResults ? (
        <span style={{ fontSize: 11, color: '#475569' }}>
          {hasNodes
            ? `${nodes.length} node${nodes.length !== 1 ? 's' : ''}, ${edges.length} connection${edges.length !== 1 ? 's' : ''} — click Analyze to simulate`
            : 'Add components to the canvas to get started'}
        </span>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
          {criticalCount > 0 ? (
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 700, color: '#ef4444', whiteSpace: 'nowrap', flexShrink: 0 }}>
              🔴 {criticalCount} bottleneck{criticalCount !== 1 ? 's' : ''}
            </div>
          ) : (
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 700, color: '#22c55e', whiteSpace: 'nowrap', flexShrink: 0 }}>
              ✅ All clear
            </div>
          )}
          <div style={{ width: 1, height: 20, background: '#1e2d45', flexShrink: 0 }} />
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', alignItems: 'center' }} className="scrollbar-thin">
            {analysisResults.map(r => <ResultChip key={r.nodeId} r={r} />)}
          </div>
        </div>
      )}
    </div>
  );
}
