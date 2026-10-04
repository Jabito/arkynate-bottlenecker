import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  BackgroundVariant,
  SelectionMode,
  useReactFlow,
} from '@xyflow/react';
import type { NodeTypes, Edge, Connection, OnSelectionChangeParams } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useDiagramStore } from '../store/diagramStore';
import type { NodeData, NodeKind } from '../types';
import { NODE_DEFAULTS } from '../data/nodeDefaults';
import { TEMPLATES } from '../data/templates';
import { readShareLocation } from '../lib/shareCodec';
import { templateKey } from '../lib/deepLinks';
import { criticalPathEdgeIds } from '../lib/criticalPath';
import { LoadGeneratorNode } from '../nodes/LoadGeneratorNode';
import { LoadBalancerNode } from '../nodes/LoadBalancerNode';
import { ServerNode } from '../nodes/ServerNode';
import { DatabaseNode } from '../nodes/DatabaseNode';
import { CacheNode } from '../nodes/CacheNode';
import { QueueNode } from '../nodes/QueueNode';
import { ComponentPalette } from '../components/ComponentPalette';
import { ConfigPanel } from '../components/ConfigPanel';
import { AnalysisBar } from '../components/AnalysisBar';
import { AdBanner, AD_SIZES, PLAYGROUND_ADS_ENABLED } from '../components/AdBanner';

// Lesson data loads only once a lesson is open (#100).
const LessonPanel = lazy(() => import('../components/LessonPanel'));

const nodeTypes: NodeTypes = {
  loadGenerator: LoadGeneratorNode,
  loadBalancer:  LoadBalancerNode,
  server:        ServerNode,
  database:      DatabaseNode,
  cache:         CacheNode,
  queue:         QueueNode,
};

const MIN_WIDTH = 768;
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

/** xyflow reads these variables, so edges and labels follow the theme tokens. */
const FLOW_STYLE = {
  background: 'var(--bg-base)',
  '--xy-edge-stroke': 'var(--edge)',
  '--xy-edge-stroke-selected': 'var(--edge-selected)',
  '--xy-edge-stroke-width': 2,
  '--xy-edge-label-background-color': 'var(--edge-label-bg)',
  '--xy-edge-label-color': 'var(--edge-label-fg)',
} as CSSProperties;

const STATUS_COLOR: Record<string, string> = {
  critical: 'var(--st-critical)',
  near:     'var(--st-near)',
  warning:  'var(--st-warning)',
};

let idCounter = 1;
/** The href whose deep link was already applied (StrictMode mounts effects twice). */
let handledHref: string | null = null;

function isNodeKind(v: unknown): v is NodeKind {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(NODE_DEFAULTS, v);
}

/** Applies `#d=` / `?diagram=` share links and `?template=` / `?lesson=` deep links once, then cleans the URL. */
function useDeepLinks() {
  const navigate = useNavigate();
  // Re-run when the query or fragment changes, e.g. a share link pasted into an open playground tab.
  const { search, hash } = useLocation();
  const openShareLink = useDiagramStore(s => s.openShareLink);
  const loadTemplate = useDiagramStore(s => s.loadTemplate);
  const loadLesson = useDiagramStore(s => s.loadLesson);
  const notify = useDiagramStore(s => s.notify);

  useEffect(() => {
    const href = window.location.href;
    if (handledHref === href) return;
    handledHref = href;

    const share = readShareLocation(window.location);
    const params = new URLSearchParams(window.location.search);
    const templateId = params.get('template');
    const lessonId = params.get('lesson');
    if (!share && !templateId && !lessonId) return;
    const clean = () => {
      handledHref = null;
      navigate('/playground', { replace: true });
    };

    if (share) {
      openShareLink(share).finally(clean);
    } else if (templateId) {
      const t = TEMPLATES.find(x => templateKey(x) === templateId);
      if (t) loadTemplate(t);
      else notify(`There is no template called “${templateId.slice(0, 40)}”.`);
      clean();
    } else if (lessonId) {
      import('../data/lessons')
        .then(({ LESSONS }) => {
          const lesson = LESSONS.find(l => l.id === lessonId);
          if (lesson) loadLesson(lesson);
          else notify(`There is no lesson called “${lessonId.slice(0, 40)}”.`);
        })
        .catch(() => notify('The lesson could not be loaded. Check your connection and try again.'))
        .finally(clean);
    }
  }, [search, hash, navigate, openShareLink, loadTemplate, loadLesson, notify]);
}

function EmptyState() {
  const loadTemplate = useDiagramStore(s => s.loadTemplate);
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 5, pointerEvents: 'none', padding: 24,
    }}>
      <div style={{
        pointerEvents: 'auto', maxWidth: 460, width: '100%',
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '20px 22px', color: 'var(--text)', boxShadow: '0 8px 32px var(--overlay)',
      }}>
        <h2 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, color: 'var(--text-strong)' }}>
          Start from a working example
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0 16px' }}>
          {TEMPLATES.map(t => (
            <button
              key={t.name}
              type="button"
              onClick={() => loadTemplate(t)}
              title={t.description}
              style={{
                padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-strong)',
              }}
            >
              {t.name}
            </button>
          ))}
        </div>
        <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text-muted)' }}>…or build one in 60 seconds:</p>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.6, listStyle: 'decimal' }}>
          <li>Drag a <strong>Load Generator</strong> and an <strong>API Server</strong> from the left.</li>
          <li>Drag from the generator's right dot to the server to send it traffic.</li>
          <li>Watch the server's meter. Past 100% it turns red. Add <strong>Instances</strong> to fix it.</li>
        </ol>
      </div>
    </div>
  );
}

/**
 * Edges along `meta.criticalPath` get `bn-critical-path` while that path runs through a critical
 * node (#79). The class is added here, at render time only, so it never reaches the store, a save or a share.
 */
function useCriticalPathEdges(edges: Edge[]): Edge[] {
  const path = useDiagramStore(s => s.analysisMeta?.criticalPath);
  const results = useDiagramStore(s => s.analysisResults);
  return useMemo(() => {
    const ids = criticalPathEdgeIds(edges, path, results);
    if (ids.size === 0) return edges;
    return edges.map(e => (ids.has(e.id) ? { ...e, className: e.className ? `${e.className} bn-critical-path` : 'bn-critical-path' } : e));
  }, [edges, path, results]);
}

function FlowCanvas() {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const nodes = useDiagramStore(s => s.nodes);
  const edges = useCriticalPathEdges(useDiagramStore(s => s.edges));
  const loadId = useDiagramStore(s => s.loadId);
  const onNodesChange = useDiagramStore(s => s.onNodesChange);
  const onEdgesChange = useDiagramStore(s => s.onEdgesChange);
  const onConnect = useDiagramStore(s => s.onConnect);
  const setSelection = useDiagramStore(s => s.setSelection);
  const addNode = useDiagramStore(s => s.addNode);

  // Fit whenever the whole canvas is replaced. xyflow queues the fit until the new nodes are measured.
  const fittedLoadId = useRef(loadId);
  const lastLoadAt = useRef(0);
  useEffect(() => {
    if (fittedLoadId.current === loadId) return;
    fittedLoadId.current = loadId;
    lastLoadAt.current = performance.now();
    fitView({ padding: 0.15, duration: 300 });
  }, [loadId, fitView]);

  // Panes that appear just after a load (the lazily loaded lesson panel) narrow the canvas after that
  // fit ran, so re-fit when the canvas width changes within a few seconds of a load. Later resizes keep
  // the user's own pan and zoom.
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (Math.abs(w - width) < 24) return;
      width = w;
      if (performance.now() - lastLoadAt.current < 4000) void fitView({ padding: 0.15, duration: 200 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitView]);

  const handleSelectionChange = useCallback(({ nodes: n, edges: e }: OnSelectionChangeParams) => {
    setSelection(n.map(x => x.id), e.map(x => x.id));
  }, [setSelection]);

  const isValidConnection = useCallback((c: Edge | Connection) => {
    if (c.source === c.target) return false;
    const target = useDiagramStore.getState().nodes.find(n => n.id === c.target);
    return target?.data.kind !== 'loadGenerator';
  }, []);

  const [selectionBoxVisible, setSelectionBoxVisible] = useState(true);
  const handleSelectionStart = useCallback(() => setSelectionBoxVisible(true), []);
  const handleSelectionEnd = useCallback(() => setSelectionBoxVisible(false), []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/bottlenecker');
    if (!raw) return;
    try {
      const { kind } = JSON.parse(raw) as { kind?: unknown };
      if (!isNodeKind(kind)) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const id = `${kind}-${Date.now()}-${idCounter++}`;
      addNode({ id, type: kind, position, data: NODE_DEFAULTS[kind]() });
    } catch {
      // ignore malformed drag data
    }
  }, [addNode, screenToFlowPosition]);

  return (
    <div
      ref={wrapperRef}
      style={{ flex: 1, position: 'relative' }}
      className={selectionBoxVisible ? undefined : 'selection-box-hidden'}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {nodes.length === 0 && <EmptyState />}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={handleSelectionChange}
        isValidConnection={isValidConnection}
        deleteKeyCode={['Delete', 'Backspace']}
        style={FLOW_STYLE}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        selectionOnDrag
        panOnDrag={[1, 2]}
        panOnScroll
        edgesFocusable
        nodesFocusable
        selectionMode={SelectionMode.Partial}
        onSelectionStart={handleSelectionStart}
        onSelectionEnd={handleSelectionEnd}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--border)" />
        <Controls />
        <MiniMap
          nodeColor={(n) => STATUS_COLOR[(n.data as NodeData)?.status ?? ''] ?? 'var(--accent)'}
          maskColor="var(--overlay)"
          style={{ bottom: 10, right: 10, width: 160, height: 110 }}
        />
        <Panel position="bottom-center">
          <div style={{
            fontSize: 11, color: 'var(--text-dim)', background: 'var(--bg-surface)',
            border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', whiteSpace: 'nowrap',
          }}>
            Scroll to pan · {MOD}+scroll or pinch to zoom · Drag to select · Space+drag to pan · Tab to a node or edge, Enter to edit
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

function DesktopRequired() {
  const navigate = useNavigate();
  const hasLink = readShareLocation(window.location) !== null || /[?&](template|lesson)=/.test(window.location.search);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');

  const copy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => setCopied('ok'), () => setCopied('fail'));
  };

  const buttonStyle: CSSProperties = {
    padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
    fontFamily: "'Space Grotesk', sans-serif", textDecoration: 'none',
  };
  const primary: CSSProperties = { ...buttonStyle, background: 'var(--accent-strong)', color: 'var(--on-accent)', border: 'none' };
  const secondary: CSSProperties = { ...buttonStyle, background: 'transparent', color: 'var(--text-strong)', border: '1px solid var(--border)' };

  return (
    <div style={{
      height: 'calc(100dvh - 50px)', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg-base)', padding: 24, textAlign: 'center', gap: 16,
    }}>
      <span style={{ fontSize: 48 }} aria-hidden="true">🖥️</span>
      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: 'var(--text-strong)', margin: 0 }}>
        {hasLink ? 'Open this link on a desktop' : 'The playground needs a larger screen'}
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 15, maxWidth: 380, margin: 0, lineHeight: 1.6 }}>
        {hasLink
          ? 'This link opens a diagram in the playground, which needs a screen at least 768 px wide. Copy the link and open it on a computer.'
          : 'The playground needs a screen at least 768 px wide. The lessons work on any screen.'}
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {hasLink ? (
          <button type="button" onClick={copy} style={primary}>
            {copied === 'ok' ? 'Link copied' : copied === 'fail' ? 'Copy failed: use the address bar' : 'Copy link'}
          </button>
        ) : (
          <Link to="/lessons" style={primary}>Read the lessons</Link>
        )}
        <button type="button" onClick={() => navigate('/')} style={secondary}>Go to Home</button>
      </div>
    </div>
  );
}

function ActiveLesson() {
  const active = useDiagramStore(s => s.activeLessonId !== null);
  if (!active) return null;
  return (
    <Suspense fallback={null}>
      <LessonPanel />
    </Suspense>
  );
}

function Workspace() {
  useDeepLinks();
  const [bottomAdFilled, setBottomAdFilled] = useState(false);
  return (
    <ReactFlowProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 50px)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <ComponentPalette />
          <ActiveLesson />
          <FlowCanvas />
          <ConfigPanel />
        </div>
        {/* Fixed-height slot: the canvas never resizes when the ad fills. */}
        {PLAYGROUND_ADS_ENABLED && (<>
        {/* Takes space only once an ad is served (ruling 5); unfilled, the canvas keeps the room (#74) */}
        <div style={bottomAdFilled
          ? { height: 116, flexShrink: 0, overflow: 'hidden', background: 'var(--bg-nav)', borderTop: '1px solid var(--border)' }
          : { flexShrink: 0 }}>
          <AdBanner slot="1205058699" size={AD_SIZES.leaderboard} onFilledChange={setBottomAdFilled} />
        </div>
        </>)}
        <AnalysisBar />
      </div>
    </ReactFlowProvider>
  );
}

export default function PlaygroundPage() {
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < MIN_WIDTH);

  useEffect(() => {
    const handler = () => setIsNarrow(window.innerWidth < MIN_WIDTH);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // The link stays in the address bar on narrow screens, so it can be copied or forwarded.
  return isNarrow ? <DesktopRequired /> : <Workspace />;
}
