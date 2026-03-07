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
            const newData = { ...e.data, ...patch };
            return { ...e, data: newData, label: (newData as EdgeData).label || undefined };
          }),
        })),

      runAnalysis: () => {
        const { nodes, edges } = get();
        const { updatedNodes, results } = analyzeGraph(nodes, edges);
        set({ nodes: updatedNodes, analysisResults: results });
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
          edges: template.edges,
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
          set({ nodes: parsed.nodes ?? [], edges: parsed.edges ?? [], diagramName: parsed.name ?? 'Imported', analysisResults: [], selectedNodeId: null, selectedEdgeId: null });
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
