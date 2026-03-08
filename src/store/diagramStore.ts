import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import type {
  Node, Edge, NodeChange, EdgeChange, Connection,
} from '@xyflow/react';
import type { NodeData, EdgeData, AnalysisResult } from '../types';
import type { Template } from '../data/templates';
import { analyzeGraph } from '../engine/analyze';

type AppNode = Node<NodeData>;

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

interface DiagramState {
  nodes: AppNode[];
  edges: Edge[];
  analysisResults: AnalysisResult[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  diagramName: string;
  savedDiagrams: Record<string, { nodes: AppNode[]; edges: Edge[]; name: string }>;

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
  importJSON: (json: string) => void;
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

      onNodesChange: (changes) =>
        set(s => ({ nodes: applyNodeChanges(changes, s.nodes) })),

      onEdgesChange: (changes) =>
        set(s => ({ edges: applyEdgeChanges(changes, s.edges) })),

      onConnect: (connection) =>
        set(s => ({
          edges: addEdge(
            {
              ...connection,
              animated: true,
              style: { stroke: '#22d3ee', strokeWidth: 2 },
              data: { distributionMode: 'auto' } as EdgeData,
              // label is undefined for new auto edges (no QPS computed yet)
            },
            s.edges
          ),
        })),

      setSelectedNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),

      setSelectedEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

      addNode: (node) => set(s => ({ nodes: [...s.nodes, node] })),

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
        const { nodes, edges } = get();
        const { updatedNodes, results, edgeFlows } = analyzeGraph(nodes, edges);
        // Write computed QPS back to each edge and refresh labels
        const updatedEdges = edges.map(e => {
          const newData: EdgeData = {
            ...(e.data as EdgeData),
            computedQPS: edgeFlows.get(e.id) ?? 0,
          };
          return { ...e, data: newData, label: computeEdgeLabel(newData) || undefined };
        });
        set({ nodes: updatedNodes, edges: updatedEdges, analysisResults: results });
      },

      newDiagram: () =>
        set({ nodes: [], edges: [], analysisResults: [], selectedNodeId: null, selectedEdgeId: null, diagramName: 'Untitled Diagram' }),

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

      loadTemplate: (template) =>
        set({
          nodes: template.nodes as AppNode[],
          // Apply config-based labels immediately (percent/absolute show without needing analysis)
          edges: applyEdgeLabels(template.edges),
          diagramName: template.name,
          analysisResults: [],
          selectedNodeId: null,
          selectedEdgeId: null,
        }),

      setDiagramName: (name) => set({ diagramName: name }),

      exportJSON: () => {
        const { nodes, edges, diagramName } = get();
        const blob = new Blob([JSON.stringify({ name: diagramName, nodes, edges }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${diagramName.replace(/\s+/g, '-').toLowerCase()}.json`;
        a.click();
        URL.revokeObjectURL(url);
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
          });
        } catch {
          alert('Invalid JSON file');
        }
      },
    }),
    {
      name: 'bottlenecker-diagrams',
      partialize: (s) => ({ savedDiagrams: s.savedDiagrams }),
    }
  )
);
