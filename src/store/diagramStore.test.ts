import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagramStore } from './diagramStore';
import { TEMPLATES } from '../data/templates';
import { LESSONS } from '../data/lessons';

const initial = useDiagramStore.getState();
const st = () => useDiagramStore.getState();

beforeEach(() => {
  useDiagramStore.setState({ ...initial, savedDiagrams: {}, _history: [], _future: [] }, true);
});

const simple = TEMPLATES[0];
const cached = TEMPLATES[1];

describe('diagram store', () => {
  it('auto-runs analysis on load and after edits, and strips nothing the engine needs', () => {
    st().loadTemplate(simple);
    const srv = st().nodes.find(n => n.data.kind === 'server')!;
    expect(st().analysisResults.some(r => r.nodeId === srv.id)).toBe(true);
    expect(st().analysisMeta).not.toBeNull();
    st().updateNodeData(srv.id, { label: 'Renamed' });
    expect(st().analysisResults.find(r => r.nodeId === srv.id)?.label).toBe('Renamed');
  });

  it('undo after loading a saved diagram restores the previous canvas and its name (#4)', () => {
    st().loadTemplate(simple);
    st().saveDiagram('A');
    st().loadTemplate(cached);
    st().loadDiagram('A');
    expect(st().diagramName).toBe('A');
    st().undo();
    expect(st().diagramName).toBe(cached.name);
    expect(st().nodes).toHaveLength(cached.nodes.length);
  });

  it('replace paths are undoable, announce themselves and reset isDirty (#10)', () => {
    st().loadTemplate(simple);
    const id = st().nodes[0].id;
    st().updateNodeData(id, { label: 'mine' });
    expect(st().isDirty).toBe(true);
    st().loadTemplate(cached);
    expect(st().isDirty).toBe(false);
    expect(st().notice?.text).toMatch(/Loaded “Cached API”.*undo/);
    st().undo();
    expect(st().nodes.find(n => n.id === id)?.data.label).toBe('mine');
  });

  it('importJSON rejects non-diagrams without touching the canvas', () => {
    st().loadTemplate(simple);
    const before = st().nodes;
    expect(st().importJSON('{"name":"package"}')).toEqual({ ok: false, error: expect.any(String) });
    expect(st().importJSON('not json')).toMatchObject({ ok: false });
    expect(st().importJSON('{"nodes":[{"id":"x","data":{"kind":"gateway"}}]}')).toMatchObject({ ok: false });
    expect(st().nodes).toBe(before);
  });

  it('importJSON validates and loads, dropping hostile fields', () => {
    const json = JSON.stringify({
      name: 'Evil',
      nodes: [{ id: 's', type: 'server', position: { x: 0, y: 0 }, style: { position: 'fixed' }, className: 'x', data: { kind: 'server', label: 'S', maxQPS: 100, instances: 1 } }],
      edges: [{ id: 'e', source: 's', target: 'ghost' }],
    });
    expect(st().importJSON(json)).toEqual({ ok: true });
    expect(st().nodes[0]).not.toHaveProperty('style');
    expect(st().edges).toHaveLength(0);
    expect(st().notice?.text).toMatch(/1 invalid item skipped/);
  });

  it('deleting a connected node is one undo step (#44)', () => {
    st().loadTemplate(simple);
    const node = st().nodes[1];
    const connected = st().edges.filter(e => e.source === node.id || e.target === node.id);
    // xyflow order: edge removals first, then the node removal.
    st().onEdgesChange(connected.map(e => ({ type: 'remove', id: e.id })));
    st().onNodesChange([{ type: 'remove', id: node.id }]);
    expect(st().analysisResults.some(r => r.nodeId === node.id)).toBe(false);
    st().undo();
    expect(st().nodes).toHaveLength(simple.nodes.length);
    expect(st().edges).toHaveLength(simple.edges.length);
  });

  it('rapid edits to one field coalesce into one undo step, a drag is one step', () => {
    st().loadTemplate(simple);
    const id = st().nodes[1].id;
    const original = st().nodes[1].data.label;
    st().updateNodeData(id, { label: 'a' });
    st().updateNodeData(id, { label: 'ab' });
    st().updateNodeData(id, { label: 'abc' });
    st().undo();
    expect(st().nodes[1].data.label).toBe(original);

    const pos = st().nodes[1].position;
    st().onNodesChange([{ type: 'position', id, position: { x: pos.x + 5, y: pos.y }, dragging: true }]);
    st().onNodesChange([{ type: 'position', id, position: { x: pos.x + 50, y: pos.y }, dragging: true }]);
    st().onNodesChange([{ type: 'position', id, position: { x: pos.x + 50, y: pos.y }, dragging: false }]);
    expect(st().nodes[1].position.x).toBe(pos.x + 50);
    st().undo();
    expect(st().nodes[1].position).toEqual(pos);
  });

  it('labels percent edges with the flow they carry (#89)', () => {
    st().loadTemplate(simple);
    const e = st().edges[0];
    st().updateEdgeData(e.id, { distributionMode: 'percent', distributionValue: 80 });
    expect(st().edges[0].label).toMatch(/^80% · [\d.]+k?\/s$/);
  });

  it('rejects connections into a load generator', () => {
    st().loadTemplate(simple);
    const lg = st().nodes.find(n => n.data.kind === 'loadGenerator')!;
    const srv = st().nodes.find(n => n.data.kind === 'server')!;
    const before = st().edges.length;
    st().onConnect({ source: srv.id, target: lg.id, sourceHandle: null, targetHandle: null });
    expect(st().edges).toHaveLength(before);
  });

  it('saved diagrams carry savedAt and no computed keys', () => {
    st().loadTemplate(simple);
    st().saveDiagram('S');
    const saved = st().savedDiagrams.S;
    expect(saved.savedAt).toBeGreaterThan(0);
    expect(saved.nodes.every(n => !('status' in n.data) && !('actualQPS' in n.data))).toBe(true);
  });

  it('share URL round-trips through openShareLink', async () => {
    st().loadTemplate(cached);
    const url = await st().getShareURL();
    const hash = url.slice(url.indexOf('#'));
    st().newDiagram();
    const { readShareLocation } = await import('../lib/shareCodec');
    const res = await st().openShareLink(readShareLocation({ hash, search: '' })!);
    expect(res).toEqual({ ok: true });
    expect(st().diagramName).toBe(cached.name);
    expect(st().nodes).toHaveLength(cached.nodes.length);
  });

  it('a damaged share link leaves the canvas and explains why', async () => {
    st().loadTemplate(simple);
    const res = await st().openShareLink({ kind: 'd', token: 'AAAA' });
    expect(res.ok).toBe(false);
    expect(st().nodes).toHaveLength(simple.nodes.length);
    expect(st().notice?.text).toMatch(/damaged or incomplete/);
  });

  it('migrates v0 saves and validates everything restored from storage (#80)', async () => {
    const { migrate, merge } = useDiagramStore.persist.getOptions();
    const v0 = { analyzeCount: 7, savedDiagrams: { Old: { name: 'Old', nodes: [{ id: 'lb', type: 'loadBalancer', position: { x: 0, y: 0 }, style: { position: 'fixed' }, data: { kind: 'loadBalancer', label: 'LB', maxQPS: 900, strategy: 'weighted', status: 'critical' } }], edges: [] } } };
    const migrated = await migrate!(v0, 0);
    const state = merge!(migrated, st());
    expect(state).not.toHaveProperty('analyzeCount');
    expect(state.nodes).toEqual([]);
    const old = state.savedDiagrams.Old;
    expect(old.savedAt).toBeGreaterThan(0);
    expect(old.nodes[0]).not.toHaveProperty('style');
    expect(old.nodes[0].data).toMatchObject({ kind: 'loadBalancer', label: 'LB', maxQPS: 900, strategy: 'weighted' });
    expect(old.nodes[0].data).not.toHaveProperty('status');

    const restored = merge!({ nodes: simple.nodes, edges: simple.edges, diagramName: 'Mine', savedDiagrams: 'junk', isDirty: true }, st());
    expect(restored.diagramName).toBe('Mine');
    expect(restored.isDirty).toBe(true);
    expect(restored.savedDiagrams).toEqual({});
    expect(restored.analysisResults.length).toBeGreaterThan(0);
  });

  describe('lessons (#100)', () => {
    const [first, second] = LESSONS;

    it('loadLesson opens the diagram and starts the lesson; any other replacement ends it', () => {
      st().loadLesson(first);
      expect(st().activeLessonId).toBe(first.id);
      expect(st().diagramName).toBe(first.diagram.name);
      expect(st().isDirty).toBe(false);
      st().updateNodeData(st().nodes[1].id, { label: 'edited' });
      expect(st().activeLessonId).toBe(first.id);
      st().loadTemplate(simple);
      expect(st().activeLessonId).toBeNull();
      st().loadLesson(second);
      st().newDiagram();
      expect(st().activeLessonId).toBeNull();
    });

    it('undoing the load that started a lesson ends it; redo brings it back', () => {
      st().loadTemplate(simple);
      st().loadLesson(first);
      st().undo();
      expect(st().activeLessonId).toBeNull();
      expect(st().diagramName).toBe(simple.name);
      st().redo();
      expect(st().activeLessonId).toBe(first.id);
    });

    it('endLesson keeps the canvas, and undo/redo never reopen the closed lesson', () => {
      st().loadLesson(first);
      const id = st().nodes[1].id;
      st().updateNodeData(id, { label: 'edited' });
      st().endLesson();
      expect(st().activeLessonId).toBeNull();
      expect(st().nodes.find(n => n.id === id)?.data.label).toBe('edited');
      st().undo();
      expect(st().activeLessonId).toBeNull();
      st().redo();
      expect(st().activeLessonId).toBeNull();
    });

    it('persists the active lesson and validates it on restore', () => {
      const { partialize, merge } = useDiagramStore.persist.getOptions();
      st().loadLesson(first);
      expect(partialize!(st())).toMatchObject({ activeLessonId: first.id });
      const base = { nodes: first.diagram.nodes, edges: first.diagram.edges, diagramName: 'L', savedDiagrams: {}, isDirty: true };
      expect(merge!({ ...base, activeLessonId: first.id }, st()).activeLessonId).toBe(first.id);
      expect(merge!({ ...base, activeLessonId: '<script>' }, st()).activeLessonId).toBeNull();
      expect(merge!({ ...base, activeLessonId: 42 }, st()).activeLessonId).toBeNull();
      expect(merge!({ ...base, nodes: [], activeLessonId: first.id }, st()).activeLessonId).toBeNull();
    });
  });
});
