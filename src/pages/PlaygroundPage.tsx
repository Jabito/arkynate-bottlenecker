import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  SelectionMode,
  useReactFlow,
} from '@xyflow/react';
import type { NodeTypes, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useDiagramStore } from '../store/diagramStore';
import type { NodeData, EdgeData } from '../types';
import { LoadGeneratorNode } from '../nodes/LoadGeneratorNode';
import { LoadBalancerNode } from '../nodes/LoadBalancerNode';
import { ServerNode } from '../nodes/ServerNode';
import { DatabaseNode } from '../nodes/DatabaseNode';
import { CacheNode } from '../nodes/CacheNode';
import { QueueNode } from '../nodes/QueueNode';
import { ComponentPalette } from '../components/ComponentPalette';
import { ConfigPanel } from '../components/ConfigPanel';
import { AnalysisBar } from '../components/AnalysisBar';
import { AdBanner } from '../components/AdBanner';

const nodeTypes: NodeTypes = {
  loadGenerator: LoadGeneratorNode,
  loadBalancer:  LoadBalancerNode,
  server:        ServerNode,
  database:      DatabaseNode,
  cache:         CacheNode,
  queue:         QueueNode,
};

let idCounter = 1;

function FlowCanvas() {
  const { screenToFlowPosition } = useReactFlow();
  const {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect,
    setSelectedNode, setSelectedEdge,
    addNode,
  } = useDiagramStore();

  const displayEdges: Edge[] = useMemo(() =>
    edges.map(e => {
      const d = e.data as EdgeData | undefined;
      if (d?.label) return { ...e, label: d.label };
      return e;
    }),
    [edges]
  );

  const handleNodeClick = useCallback((_: React.MouseEvent, node: { id: string }) => {
    setSelectedNode(node.id);
  }, [setSelectedNode]);

  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: { id: string }) => {
    setSelectedEdge(edge.id);
  }, [setSelectedEdge]);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, [setSelectedNode, setSelectedEdge]);

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
      const { kind, defaultData } = JSON.parse(raw);
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const id = `${kind}-${Date.now()}-${idCounter++}`;
      addNode({ id, type: kind, position, data: defaultData });
    } catch {
      // ignore malformed drag data
    }
  }, [addNode, screenToFlowPosition]);

  return (
    <div
      style={{ flex: 1, position: 'relative' }}
      className={selectionBoxVisible ? undefined : 'selection-box-hidden'}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        fitView
        deleteKeyCode={['Delete', 'Backspace']}
        style={{ background: 'var(--bg-base)' }}
        selectionOnDrag
        panOnDrag={[1, 2]}
        selectionMode={SelectionMode.Partial}
        onSelectionStart={handleSelectionStart}
        onSelectionEnd={handleSelectionEnd}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--border)" />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const data = n.data as NodeData;
            if (data?.status === 'critical') return '#ef4444';
            if (data?.status === 'near')     return '#f97316';
            if (data?.status === 'warning')  return '#eab308';
            return '#22d3ee';
          }}
          maskColor="rgba(10,15,30,0.7)"
          style={{ bottom: 10, right: 10 }}
        />
      </ReactFlow>
    </div>
  );
}

export default function PlaygroundPage() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    document.title = 'Playground — Simulate Architecture Bottlenecks | Bottlenecker';
    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (desc) desc.content = 'Interactive canvas to simulate system architecture bottlenecks. Add components, set capacities, run load simulations, and identify performance bottlenecks in real time.';
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  if (isMobile) {
    return (
      <div style={{
        height: 'calc(100vh - 50px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
        padding: '24px',
        textAlign: 'center',
        gap: 16,
      }}>
        <span style={{ fontSize: 48 }}>🖥️</span>
        <h2 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 22,
          fontWeight: 700,
          color: '#f1f5f9',
          margin: 0,
        }}>
          Desktop Required
        </h2>
        <p style={{ color: '#94a3b8', fontSize: 15, maxWidth: 360, margin: 0, lineHeight: 1.6 }}>
          Bottlenecker Playground requires a desktop browser. Please visit on a larger screen.
        </p>
        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: 8,
            padding: '10px 24px',
            background: 'linear-gradient(135deg, #0891b2, #7c3aed)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 14,
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Go to Home
        </button>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 50px)',
        overflow: 'hidden',
      }}>
        <AdBanner
          slot="6844543977"
          format="auto"
          style={{ height: 90, background: '#0d1526', borderBottom: '1px solid #1e2d45' }}
        />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <ComponentPalette />
          <FlowCanvas />
          <ConfigPanel />
        </div>
        <AdBanner
          slot="1205058699"
          format="horizontal"
          style={{ height: 90, background: '#0d1526', borderTop: '1px solid #1e2d45' }}
        />
        <AnalysisBar />
      </div>
    </ReactFlowProvider>
  );
}
