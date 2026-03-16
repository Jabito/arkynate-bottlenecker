import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  getNodesBounds,
} from '@xyflow/react';
import type {
  Node, Edge, NodeChange, EdgeChange, Connection,
} from '@xyflow/react';
import { toPng, toJpeg } from 'html-to-image';
import type { NodeData, EdgeData, AnalysisResult } from '../types';
import type { Template } from '../data/templates';
import { analyzeGraph } from '../engine/analyze';
import { trackEvent } from '../lib/analytics';

type AppNode = Node<NodeData>;
type DiagramSnapshot = { nodes: AppNode[]; edges: Edge[] };

// Derives the display label shown on the edge line in the canvas.
// percent  → "30%"
// absolute → "≤500/s"
// auto     → "1.2k/s" (only after analysis; empty otherwise)
// If the user has also set an endpoint label (e.g. "GET /users"), it is
// prepended: "GET /users · 1.2k/s"
function computeEdgeLabel(d: EdgeData): string | undefined {
  let traffic: string | undefined;

  if (d.distributionMode === 'percent' && (d.distributionValue ?? 0) > 0) {
    traffic = `${d.distributionValue}%`;
  } else if (d.distributionMode === 'absolute' && (d.distributionValue ?? 0) > 0) {
    const v = d.distributionValue ?? 0;
    traffic = `≤${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}/s`;
  } else if (d.distributionMode === 'auto' && (d.computedQPS ?? 0) > 0) {
    const v = d.computedQPS ?? 0;
    traffic = v >= 1000 ? `${(v / 1000).toFixed(1)}k/s` : `${v.toFixed(0)}/s`;
  }

  if (d.label && traffic) return `${d.label} · ${traffic}`;
  if (d.label) return d.label;
  return traffic;
}

function applyEdgeLabels(edges: Edge[]): Edge[] {
  return edges.map(e => ({
    ...e,
    label: computeEdgeLabel(e.data as EdgeData) || undefined,
  }));
}

/** Unicode-safe: object → base64 string for URL embedding */
function encodeForURL(obj: unknown): string {
  const json = JSON.stringify(obj);
  return btoa(
    encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

/** Reverse of encodeForURL */
export function decodeFromURL(encoded: string): unknown {
  return JSON.parse(
    decodeURIComponent(
      atob(encoded)
        .split('')
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    )
  );
}

interface DiagramState {
  nodes: AppNode[];
  edges: Edge[];
  analysisResults: AnalysisResult[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  diagramName: string;
  savedDiagrams: Record<string, { nodes: AppNode[]; edges: Edge[]; name: string }>;
  analyzeCount: number;
  _history: DiagramSnapshot[];
  _future: DiagramSnapshot[];

  onNodesChange: (changes: NodeChange<AppNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setSelectedNode: (id: string | null) => void;
  setSelectedEdge: (id: string | null) => void;
  addNode: (node: AppNode) => void;
  updateNodeData: (id: string, data: Partial<NodeData>) => void;
  updateEdgeData: (id: string, patch: Partial<EdgeData>) => void;
  runAnalysis: () => void;
  newDiagram: () => void;
  saveDiagram: (name?: string) => void;
  loadDiagram: (name: string) => void;
  deleteDiagram: (name: string) => void;
  loadTemplate: (template: Template) => void;
  setDiagramName: (name: string) => void;
  exportJSON: () => void;
  exportPNG: () => Promise<void>;
  exportJPG: () => Promise<void>;
  importJSON: (json: string) => void;
  undo: () => void;
  redo: () => void;
  getShareURL: () => string;
}

function pushSnapshot(history: DiagramSnapshot[], nodes: AppNode[], edges: Edge[]): DiagramSnapshot[] {
  return [...history.slice(-19), { nodes, edges }];
}

export const useDiagramStore = create<DiagramState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      analysisResults: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      diagramName: 'Untitled Diagram',
      savedDiagrams: {},
      analyzeCount: 0,
      _history: [],
      _future: [],

      onNodesChange: (changes) => {
        const hasRemove = changes.some(c => c.type === 'remove');
        if (hasRemove) {
          const { nodes, edges, _history } = get();
          set(s => ({
            nodes: applyNodeChanges(changes, s.nodes),
            _history: pushSnapshot(_history, nodes, edges),
            _future: [],
          }));
        } else {
          set(s => ({ nodes: applyNodeChanges(changes, s.nodes) }));
        }
      },

      onEdgesChange: (changes) => {
        const hasRemove = changes.some(c => c.type === 'remove');
        if (hasRemove) {
          const { nodes, edges, _history } = get();
          set(s => ({
            edges: applyEdgeChanges(changes, s.edges),
            _history: pushSnapshot(_history, nodes, edges),
            _future: [],
          }));
        } else {
          set(s => ({ edges: applyEdgeChanges(changes, s.edges) }));
        }
      },

      onConnect: (connection) => {
        const { nodes, edges, _history } = get();
        set(s => ({
          edges: addEdge(
            {
              ...connection,
              animated: true,
              style: { stroke: '#22d3ee', strokeWidth: 2 },
              data: { distributionMode: 'auto' } as EdgeData,
            },
            s.edges
          ),
          _history: pushSnapshot(_history, nodes, edges),
          _future: [],
        }));
      },

      setSelectedNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),

      setSelectedEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

      addNode: (node) => {
        const { nodes, edges, _history } = get();
        set(s => ({
          nodes: [...s.nodes, node],
          _history: pushSnapshot(_history, nodes, edges),
          _future: [],
        }));
      },

      updateNodeData: (id, patch) =>
        set(s => ({
          nodes: s.nodes.map(n =>
            n.id === id ? { ...n, data: { ...n.data, ...patch } as NodeData } : n
          ),
        })),

      updateEdgeData: (id, patch) =>
        set(s => ({
          edges: s.edges.map(e => {
            if (e.id !== id) return e;
            const newData = { ...e.data, ...patch } as EdgeData;
            return { ...e, data: newData, label: computeEdgeLabel(newData) || undefined };
          }),
        })),

      runAnalysis: () => {
        const { nodes, edges, analyzeCount } = get();
        const { updatedNodes, results, edgeFlows } = analyzeGraph(nodes, edges);
        const updatedEdges = edges.map(e => {
          const newData: EdgeData = {
            ...(e.data as EdgeData),
            computedQPS: edgeFlows.get(e.id) ?? 0,
          };
          return { ...e, data: newData, label: computeEdgeLabel(newData) || undefined };
        });
        set({ nodes: updatedNodes, edges: updatedEdges, analysisResults: results, analyzeCount: analyzeCount + 1 });
        trackEvent('analyze_click');
      },

      newDiagram: () => {
        const { nodes, edges, _history } = get();
        set({
          nodes: [], edges: [], analysisResults: [],
          selectedNodeId: null, selectedEdgeId: null,
          diagramName: 'Untitled Diagram',
          _history: pushSnapshot(_history, nodes, edges),
          _future: [],
        });
      },

      saveDiagram: (name) => {
        const { nodes, edges, diagramName, savedDiagrams } = get();
        const saveName = name ?? diagramName;
        set({
          diagramName: saveName,
          savedDiagrams: { ...savedDiagrams, [saveName]: { nodes, edges, name: saveName } },
        });
      },

      loadDiagram: (name) => {
        const { savedDiagrams } = get();
        const d = savedDiagrams[name];
        if (d) set({ nodes: d.nodes, edges: d.edges, diagramName: d.name, analysisResults: [], selectedNodeId: null, selectedEdgeId: null });
      },

      deleteDiagram: (name) => {
        const { savedDiagrams } = get();
        const next = { ...savedDiagrams };
        delete next[name];
        set({ savedDiagrams: next });
      },

      loadTemplate: (template) => {
        trackEvent('template_used');
        set({
          nodes: template.nodes as AppNode[],
          edges: applyEdgeLabels(template.edges),
          diagramName: template.name,
          analysisResults: [],
          selectedNodeId: null,
          selectedEdgeId: null,
          _history: [],
          _future: [],
        });
      },

      setDiagramName: (name) => set({ diagramName: name }),

      exportJSON: () => {
        const { nodes, edges, diagramName } = get();
        trackEvent('export_json');
        const blob = new Blob([JSON.stringify({ name: diagramName, nodes, edges }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${diagramName.replace(/\s+/g, '-').toLowerCase()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },

      exportPNG: async () => {
        const { nodes, diagramName } = get();
        trackEvent('export_png');
        const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
        if (!viewport) return;
        const PAD = 48, ZOOM = 1.5;
        const bounds = getNodesBounds(nodes);
        const W = Math.ceil(bounds.width * ZOOM) + PAD * 2;
        const H = Math.ceil(bounds.height * ZOOM) + PAD * 2;
        const tx = -bounds.x * ZOOM + PAD;
        const ty = -bounds.y * ZOOM + PAD;
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-base').trim() || '#0a0f1e';
        const dataUrl = await toPng(viewport, {
          width: W, height: H,
          style: { width: String(W), height: String(H), transform: `translate(${tx}px, ${ty}px) scale(${ZOOM})` },
          backgroundColor: bg,
        });
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${diagramName.replace(/\s+/g, '-').toLowerCase()}.png`;
        a.click();
      },

      exportJPG: async () => {
        const { nodes, diagramName } = get();
        trackEvent('export_jpg');
        const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
        if (!viewport) return;
        const PAD = 48, ZOOM = 1.5;
        const bounds = getNodesBounds(nodes);
        const W = Math.ceil(bounds.width * ZOOM) + PAD * 2;
        const H = Math.ceil(bounds.height * ZOOM) + PAD * 2;
        const tx = -bounds.x * ZOOM + PAD;
        const ty = -bounds.y * ZOOM + PAD;
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-base').trim() || '#0a0f1e';
        const dataUrl = await toJpeg(viewport, {
          width: W, height: H,
          style: { width: String(W), height: String(H), transform: `translate(${tx}px, ${ty}px) scale(${ZOOM})` },
          backgroundColor: bg,
          quality: 0.92,
        });
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${diagramName.replace(/\s+/g, '-').toLowerCase()}.jpg`;
        a.click();
      },

      importJSON: (json) => {
        try {
          const parsed = JSON.parse(json);
          set({
            nodes: parsed.nodes ?? [],
            edges: applyEdgeLabels(parsed.edges ?? []),
            diagramName: parsed.name ?? 'Imported',
            analysisResults: [],
            selectedNodeId: null,
            selectedEdgeId: null,
            _history: [],
            _future: [],
          });
        } catch {
          alert('Invalid JSON file');
        }
      },

      undo: () => {
        const { _history, _future, nodes, edges } = get();
        if (_history.length === 0) return;
        const previous = _history[_history.length - 1];
        set({
          nodes: previous.nodes,
          edges: previous.edges,
          analysisResults: [],
          _history: _history.slice(0, -1),
          _future: [{ nodes, edges }, ..._future.slice(0, 19)],
        });
      },

      redo: () => {
        const { _history, _future, nodes, edges } = get();
        if (_future.length === 0) return;
        const next = _future[0];
        set({
          nodes: next.nodes,
          edges: next.edges,
          analysisResults: [],
          _history: [..._history.slice(-19), { nodes, edges }],
          _future: _future.slice(1),
        });
      },

      getShareURL: () => {
        const { nodes, edges, diagramName } = get();
        const encoded = encodeForURL({ nodes, edges, name: diagramName });
        return `${window.location.origin}/playground?diagram=${encoded}`;
      },
    }),
    {
      name: 'bottlenecker-diagrams',
      partialize: (s) => ({ savedDiagrams: s.savedDiagrams, analyzeCount: s.analyzeCount }),
    }
  )
);
