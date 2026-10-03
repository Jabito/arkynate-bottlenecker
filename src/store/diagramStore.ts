import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react';
import type { NodeData, EdgeData, AnalysisResult, AnalysisMeta } from '../types';
import { COMPUTED_NODE_KEYS } from '../types';
import type { Template } from '../data/templates';
import { analyzeGraph } from '../engine/analyze';
import { formatQPS } from '../engine/format';
import { trackEvent } from '../lib/analytics';
import { createDebouncedStorage } from '../lib/persistStorage';
import { stripComputed, toPortable } from '../lib/portable';
import { validateDiagram, cleanName } from '../lib/validateDiagram';
import { encodeShareFragment, decodeShareToken } from '../lib/shareCodec';
import type { ShareLocation } from '../lib/shareCodec';
import { renderViewport, downloadHref, fileSlug } from '../lib/exportImage';

type AppNode = Node<NodeData>;
type Snapshot = { nodes: AppNode[]; edges: Edge[]; name: string };

export interface SavedDiagram { nodes: AppNode[]; edges: Edge[]; name: string; savedAt: number }
export type ImportResult = { ok: true } | { ok: false; error: string };
export interface Notice { id: number; text: string }

const COMPUTED = new Set<string>(COMPUTED_NODE_KEYS);
const DEFAULT_NAME = 'Untitled Diagram';
const HISTORY_LIMIT = 50;
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const UNDO_HINT = `press ${isMac ? '⌘Z' : 'Ctrl+Z'} to undo`;

// Edge line label: endpoint label (if any), then the traffic rule and the flow from the analysis.
// percent → "80% · 4.0k/s", absolute → "≤500/s · 480/s", auto → "1.2k/s".
function computeEdgeLabel(d: EdgeData | undefined): string | undefined {
  if (!d) return undefined;
  const v = d.distributionValue ?? 0;
  const flow = (d.computedQPS ?? 0) > 0 ? formatQPS(d.computedQPS ?? 0) : undefined;
  let rule: string | undefined;
  if (d.distributionMode === 'percent' && v > 0) rule = `${+v.toFixed(1)}%`;
  else if (d.distributionMode === 'absolute' && v > 0) rule = `≤${formatQPS(v)}`;
  const traffic = [rule, flow].filter(Boolean).join(' · ') || undefined;
  if (d.label && traffic) return `${d.label} · ${traffic}`;
  return d.label || traffic;
}

function withFlow(e: Edge, qps: number): Edge {
  const data: EdgeData = { ...((e.data ?? { distributionMode: 'auto' }) as EdgeData), computedQPS: qps };
  return { ...e, data, label: computeEdgeLabel(data) };
}

/**
 * Re-runs the engine. It is synchronous (≈1–2 ms at 500 nodes), so every content change
 * shows fresh results in the same frame and nothing on screen can be stale.
 */
function analyzed(nodes: AppNode[], edges: Edge[]) {
  const clean = nodes.map(n => ({ ...n, data: stripComputed(n.data) }));
  const empty = { nodes: clean, edges: edges.map(e => withFlow(e, 0)), analysisResults: [] as AnalysisResult[], analysisMeta: null };
  if (clean.length === 0) return empty;
  try {
    const { updatedNodes, results, edgeFlows, meta } = analyzeGraph(clean, edges);
    return {
      nodes: updatedNodes,
      edges: edges.map(e => withFlow(e, edgeFlows.get(e.id) ?? 0)),
      analysisResults: results,
      analysisMeta: meta as AnalysisMeta | null,
    };
  } catch (err) {
    console.error('Analysis failed', err);
    return empty;
  }
}

// ── Undo granularity ─────────────────────────────────────────────
// One snapshot per user action: a delete (xyflow removes edges, then nodes) collapses into
// one step, a drag snapshots the pre-drag state once at drag end, and repeated edits to the
// same field coalesce while the user keeps typing.
let lastAction: { key: string; at: number } | null = null;
let dragOrigin: Snapshot | null = null;

function isNewAction(key: string, windowMs: number): boolean {
  const now = Date.now();
  const fresh = !lastAction || lastAction.key !== key || now - lastAction.at > windowMs;
  lastAction = { key, at: now };
  return fresh;
}

function resetActions() {
  lastAction = null;
  dragOrigin = null;
}

function pushSnapshot(history: Snapshot[], snap: Snapshot): Snapshot[] {
  return [...history.slice(-(HISTORY_LIMIT - 1)), snap];
}

let noticeSeq = 0;
const makeNotice = (text: string): Notice => ({ id: ++noticeSeq, text });

interface DiagramState {
  nodes: AppNode[];
  edges: Edge[];
  analysisResults: AnalysisResult[];
  analysisMeta: AnalysisMeta | null;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  diagramName: string;
  savedDiagrams: Record<string, SavedDiagram>;
  /** True once the canvas differs from the last load, template, import or save. */
  isDirty: boolean;
  notice: Notice | null;
  /** Increments each time the whole canvas is replaced (the playground re-fits the view). */
  loadId: number;
  _history: Snapshot[];
  _future: Snapshot[];

  onNodesChange: (changes: NodeChange<AppNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setSelection: (nodeIds: string[], edgeIds: string[]) => void;
  setSelectedNode: (id: string | null) => void;
  setSelectedEdge: (id: string | null) => void;
  addNode: (node: AppNode) => void;
  updateNodeData: (id: string, data: Partial<NodeData>) => void;
  updateEdgeData: (id: string, patch: Partial<EdgeData>) => void;
  runAnalysis: (opts?: { explicit?: boolean }) => void;
  newDiagram: () => void;
  saveDiagram: (name?: string) => void;
  loadDiagram: (name: string) => void;
  deleteDiagram: (name: string) => void;
  loadTemplate: (template: Template) => void;
  openShareLink: (loc: ShareLocation) => Promise<ImportResult>;
  setDiagramName: (name: string) => void;
  notify: (text: string) => void;
  exportJSON: () => void;
  exportPNG: () => Promise<void>;
  exportJPG: () => Promise<void>;
  importJSON: (json: string) => ImportResult;
  undo: () => void;
  redo: () => void;
  getShareURL: () => Promise<string>;
}

type Persisted = Pick<DiagramState, 'nodes' | 'edges' | 'diagramName' | 'savedDiagrams' | 'isDirty'>;

let storageErrorShown = false;
const storage = createDebouncedStorage<Persisted>({
  serialize: s => ({ ...s, ...toPortable(s.nodes, s.edges) }),
  onError: () => {
    if (storageErrorShown) return;
    storageErrorShown = true;
    useDiagramStore.getState().notify('Could not save to browser storage (it may be full or blocked). Export JSON to keep your work.');
  },
});

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validSaved(raw: unknown, key: string): SavedDiagram | null {
  if (!isObject(raw)) return null;
  const { nodes, edges } = validateDiagram(raw);
  const savedAt = typeof raw.savedAt === 'number' && Number.isFinite(raw.savedAt) ? raw.savedAt : Date.now();
  return { nodes, edges, name: cleanName(raw.name, key), savedAt };
}

export const useDiagramStore = create<DiagramState>()(
  persist(
    (set, get) => {
      const snap = (): Snapshot => {
        const { nodes, edges, diagramName } = get();
        return { nodes, edges, name: diagramName };
      };

      /** Every whole-canvas replacement: undoable, clean, re-fitted, announced. */
      const replaceCanvas = (nodes: AppNode[], edges: Edge[], name: string, verb: string, skipped = 0) => {
        const before = get();
        const undoable = before.nodes.length > 0;
        const extra = skipped > 0 ? ` · ${skipped} invalid item${skipped === 1 ? '' : 's'} skipped` : '';
        resetActions();
        set(s => ({
          ...analyzed(nodes, edges),
          diagramName: name,
          selectedNodeId: null,
          selectedEdgeId: null,
          isDirty: false,
          loadId: s.loadId + 1,
          _history: pushSnapshot(s._history, snap()),
          _future: [],
          notice: makeNotice(`${verb} “${name}”${extra}${undoable ? ` — ${UNDO_HINT}` : ''}`),
        }));
      };

      /** Untrusted diagram object (import file, share link) → canvas. */
      const loadUntrusted = (input: unknown, fallbackName: string, verb: string): ImportResult => {
        if (!isObject(input) || !Array.isArray(input.nodes)) {
          return { ok: false, error: 'This is not a Bottlenecker diagram (it has no nodes list).' };
        }
        const v = validateDiagram(input);
        if (v.nodes.length === 0) {
          return { ok: false, error: input.nodes.length ? 'None of the nodes in this diagram are valid.' : 'This diagram is empty.' };
        }
        if (v.dropped.length) console.warn('Diagram validation:', v.dropped);
        replaceCanvas(v.nodes, v.edges, cleanName(input.name, fallbackName), verb, v.dropped.length);
        return { ok: true };
      };

      /** A content edit: optional undo snapshot, fresh analysis, dirty. */
      const commit = (nodes: AppNode[], edges: Edge[], snapshot: Snapshot | null, extra: Partial<DiagramState> = {}) => {
        set(s => ({
          ...analyzed(nodes, edges),
          isDirty: true,
          ...(snapshot ? { _history: pushSnapshot(s._history, snapshot), _future: [] } : {}),
          ...extra,
        }));
      };

      const restore = (target: Snapshot, history: Snapshot[], future: Snapshot[]) => {
        resetActions();
        set({
          ...analyzed(target.nodes, target.edges),
          diagramName: target.name,
          selectedNodeId: null,
          selectedEdgeId: null,
          isDirty: true,
          _history: history,
          _future: future,
        });
      };

      return {
        nodes: [],
        edges: [],
        analysisResults: [],
        analysisMeta: null,
        selectedNodeId: null,
        selectedEdgeId: null,
        diagramName: DEFAULT_NAME,
        savedDiagrams: {},
        isDirty: false,
        notice: null,
        loadId: 0,
        _history: [],
        _future: [],

        onNodesChange: (changes) => {
          const s = get();
          let snapshot: Snapshot | null = null;
          let content = false;
          let moved = false;
          for (const c of changes) {
            if (c.type === 'remove') {
              content = true;
              if (isNewAction('remove', 150)) snapshot = snap();
            } else if (c.type === 'add' || c.type === 'replace') {
              content = true;
            } else if (c.type === 'position') {
              if (c.dragging) {
                if (!dragOrigin) dragOrigin = snap();
              } else if (c.position) {
                moved = true;
                if (dragOrigin) {
                  snapshot = dragOrigin;
                  dragOrigin = null;
                  lastAction = null;
                } else if (isNewAction('move', 600)) {
                  snapshot = snapshot ?? snap();
                }
              }
            }
          }
          const nodes = applyNodeChanges(changes, s.nodes);
          if (content) {
            const ids = new Set(nodes.map(n => n.id));
            commit(nodes, s.edges.filter(e => ids.has(e.source) && ids.has(e.target)), snapshot);
          } else if (moved) {
            set(st => ({ nodes, isDirty: true, ...(snapshot ? { _history: pushSnapshot(st._history, snapshot), _future: [] } : {}) }));
          } else {
            set({ nodes });
          }
        },

        onEdgesChange: (changes) => {
          const s = get();
          const content = changes.some(c => c.type === 'remove' || c.type === 'add' || c.type === 'replace');
          const edges = applyEdgeChanges(changes, s.edges);
          if (!content) {
            set({ edges });
            return;
          }
          const removal = changes.some(c => c.type === 'remove');
          const snapshot = !removal || isNewAction('remove', 150) ? snap() : null;
          commit(s.nodes, edges, snapshot);
        },

        onConnect: (connection) => {
          const s = get();
          const target = s.nodes.find(n => n.id === connection.target);
          if (target?.data.kind === 'loadGenerator') {
            set({ notice: makeNotice('A load generator only sends traffic; it cannot receive it.') });
            return;
          }
          isNewAction('connect', 0);
          const edges = addEdge(
            { ...connection, animated: true, data: { distributionMode: 'auto' } as EdgeData },
            s.edges,
          );
          commit(s.nodes, edges, snap());
        },

        setSelection: (nodeIds, edgeIds) => {
          const selectedNodeId = nodeIds.length === 1 && edgeIds.length === 0 ? nodeIds[0] : null;
          const selectedEdgeId = edgeIds.length === 1 && nodeIds.length === 0 ? edgeIds[0] : null;
          const s = get();
          if (s.selectedNodeId !== selectedNodeId || s.selectedEdgeId !== selectedEdgeId) {
            set({ selectedNodeId, selectedEdgeId });
          }
        },

        // Programmatic selection (e.g. a result chip): also marks the element selected on the canvas.
        setSelectedNode: (id) => set(s => ({
          selectedNodeId: id,
          selectedEdgeId: null,
          nodes: s.nodes.map(n => (!!n.selected === (n.id === id) ? n : { ...n, selected: n.id === id })),
          edges: s.edges.map(e => (e.selected ? { ...e, selected: false } : e)),
        })),

        setSelectedEdge: (id) => set(s => ({
          selectedEdgeId: id,
          selectedNodeId: null,
          edges: s.edges.map(e => (!!e.selected === (e.id === id) ? e : { ...e, selected: e.id === id })),
          nodes: s.nodes.map(n => (n.selected ? { ...n, selected: false } : n)),
        })),

        addNode: (node) => {
          isNewAction('add', 0);
          const s = get();
          commit([...s.nodes, { ...node, data: stripComputed(node.data) }], s.edges, snap());
        },

        updateNodeData: (id, patch) => {
          const s = get();
          // Keep explicit undefined (clearing an optional field); drop engine-owned keys.
          const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => !COMPUTED.has(k)));
          const key = `node:${id}:${Object.keys(clean).sort().join(',')}`;
          const snapshot = isNewAction(key, 1000) ? snap() : null;
          const nodes = s.nodes.map(n => (n.id === id ? { ...n, data: { ...n.data, ...clean } as NodeData } : n));
          commit(nodes, s.edges, snapshot);
        },

        updateEdgeData: (id, patch) => {
          const s = get();
          const { computedQPS: _computed, ...clean } = patch;
          void _computed;
          const key = `edge:${id}:${Object.keys(clean).sort().join(',')}`;
          const snapshot = isNewAction(key, 1000) ? snap() : null;
          const edges = s.edges.map(e => (e.id === id ? { ...e, data: { ...(e.data as EdgeData), ...clean } } : e));
          commit(s.nodes, edges, snapshot);
        },

        runAnalysis: (opts) => {
          const { nodes, edges } = get();
          set(analyzed(nodes, edges));
          if (opts?.explicit === true && nodes.length > 0) trackEvent('analyze_click');
        },

        newDiagram: () => {
          const before = get();
          resetActions();
          set(s => ({
            nodes: [], edges: [], analysisResults: [], analysisMeta: null,
            selectedNodeId: null, selectedEdgeId: null,
            diagramName: DEFAULT_NAME,
            isDirty: false,
            loadId: s.loadId + 1,
            _history: pushSnapshot(s._history, snap()),
            _future: [],
            notice: before.nodes.length > 0 ? makeNotice(`New diagram — ${UNDO_HINT}`) : s.notice,
          }));
        },

        saveDiagram: (name) => {
          const { nodes, edges, diagramName, savedDiagrams } = get();
          const saveName = cleanName(name ?? diagramName, DEFAULT_NAME);
          const portable = toPortable(nodes, edges);
          set({
            diagramName: saveName,
            isDirty: false,
            savedDiagrams: {
              ...savedDiagrams,
              [saveName]: { nodes: portable.nodes, edges: portable.edges, name: saveName, savedAt: Date.now() },
            },
          });
        },

        loadDiagram: (name) => {
          const d = get().savedDiagrams[name];
          if (!d) return;
          const v = validateDiagram(d);
          replaceCanvas(v.nodes, v.edges, d.name, 'Loaded');
        },

        deleteDiagram: (name) => {
          const next = { ...get().savedDiagrams };
          delete next[name];
          set({ savedDiagrams: next });
        },

        loadTemplate: (template) => {
          trackEvent('template_used');
          const v = validateDiagram(template);
          replaceCanvas(v.nodes, v.edges, template.name, 'Loaded');
        },

        openShareLink: async (loc) => {
          let payload: unknown;
          try {
            payload = await decodeShareToken(loc);
          } catch {
            const error = 'This share link is damaged or incomplete. Ask the sender to copy it again.';
            set({ notice: makeNotice(error) });
            return { ok: false, error };
          }
          const result = loadUntrusted(payload, 'Shared diagram', 'Opened shared diagram');
          if (!result.ok) set({ notice: makeNotice(`This share link could not be opened: ${result.error}`) });
          return result;
        },

        setDiagramName: (name) => {
          const snapshot = isNewAction('rename', 1000) ? snap() : null;
          set(s => ({
            diagramName: name,
            isDirty: true,
            ...(snapshot ? { _history: pushSnapshot(s._history, snapshot), _future: [] } : {}),
          }));
        },

        notify: (text) => set({ notice: makeNotice(text) }),

        exportJSON: () => {
          const { nodes, edges, diagramName } = get();
          trackEvent('export_json');
          const body = { app: 'bottlenecker', v: 1, name: diagramName, ...toPortable(nodes, edges) };
          const blob = new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' });
          downloadHref(URL.createObjectURL(blob), `${fileSlug(diagramName)}.json`, true);
        },

        exportPNG: async () => {
          const { nodes, diagramName } = get();
          await renderViewport('png', nodes, diagramName);
          trackEvent('export_png');
        },

        exportJPG: async () => {
          const { nodes, diagramName } = get();
          await renderViewport('jpeg', nodes, diagramName);
          trackEvent('export_jpg');
        },

        importJSON: (json) => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(json);
          } catch {
            return { ok: false, error: 'This file is not valid JSON.' };
          }
          return loadUntrusted(parsed, 'Imported', 'Imported');
        },

        undo: () => {
          const { _history, _future } = get();
          if (_history.length === 0) return;
          restore(_history[_history.length - 1], _history.slice(0, -1), [snap(), ..._future.slice(0, HISTORY_LIMIT - 1)]);
        },

        redo: () => {
          const { _history, _future } = get();
          if (_future.length === 0) return;
          restore(_future[0], pushSnapshot(_history, snap()), _future.slice(1));
        },

        getShareURL: async () => {
          const { nodes, edges, diagramName } = get();
          const fragment = await encodeShareFragment(diagramName, nodes, edges);
          const origin = typeof window === 'undefined' ? '' : window.location.origin;
          return `${origin}/playground#${fragment}`;
        },
      };
    },
    {
      name: 'bottlenecker-diagrams',
      version: 1,
      storage,
      partialize: (s): Persisted => ({
        nodes: s.nodes,
        edges: s.edges,
        diagramName: s.diagramName,
        savedDiagrams: s.savedDiagrams,
        isDirty: s.isDirty,
      }),
      // v0 persisted only { savedDiagrams, analyzeCount }; the working canvas starts empty.
      migrate: (persisted, version) => {
        const p = isObject(persisted) ? persisted : {};
        if (version === 0) {
          return { nodes: [], edges: [], diagramName: DEFAULT_NAME, savedDiagrams: p.savedDiagrams ?? {}, isDirty: false } as unknown as Persisted;
        }
        return p as unknown as Persisted;
      },
      // Everything from storage is untrusted: validate, then recompute the analysis.
      merge: (persisted, current) => {
        const p = isObject(persisted) ? persisted : {};
        const work = validateDiagram({ nodes: p.nodes, edges: p.edges });
        const savedDiagrams: Record<string, SavedDiagram> = {};
        if (isObject(p.savedDiagrams)) {
          for (const [key, raw] of Object.entries(p.savedDiagrams)) {
            const d = validSaved(raw, key);
            if (d) savedDiagrams[key] = d;
          }
        }
        return {
          ...current,
          ...analyzed(work.nodes, work.edges),
          diagramName: cleanName(p.diagramName, DEFAULT_NAME),
          savedDiagrams,
          isDirty: p.isDirty === true && work.nodes.length > 0,
        };
      },
    },
  ),
);
