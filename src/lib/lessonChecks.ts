import type { Node, Edge } from '@xyflow/react';
import type { NodeData, EdgeData, AnalysisResult, AnalysisMeta } from '../types';
import type { Lesson, LessonCondition, LessonPatch } from '../data/lessons';
import { formatQPS } from '../engine/format';

/** What a lesson check reads: the store's analysed nodes, results and meta (or an engine run in tests). */
export interface LessonSnapshot {
  nodes: Node<NodeData>[];
  results: AnalysisResult[];
  meta: AnalysisMeta | null;
}

export interface ConditionState {
  ok: boolean;
  /** The current value, e.g. "400%", "78.4%", "5.0k/s", "2 critical". */
  now: string;
}

const EPS = 1e-6;
const pct = (n: number) => (Number.isFinite(n) ? `${+n.toFixed(1)}%` : '∞');

export function evaluateCondition(c: LessonCondition, s: LessonSnapshot): ConditionState {
  switch (c.kind) {
    case 'below': {
      const r = s.results.find(x => x.nodeId === c.nodeId);
      if (!r) return { ok: false, now: 'missing' };
      if (!(r.actualQPS > 0)) return { ok: false, now: 'no traffic' };
      const metric = c.metric ?? 'utilization';
      const value = metric === 'utilization'
        ? r.utilization
        : Number((s.nodes.find(n => n.id === c.nodeId)?.data as Record<string, unknown> | undefined)?.[metric] ?? NaN);
      return { ok: value < c.pct, now: Number.isNaN(value) ? '—' : pct(value) };
    }
    case 'noCritical': {
      if (!s.meta || s.results.length === 0) return { ok: false, now: 'no traffic' };
      const critical = s.results.filter(r => r.status === 'critical').length;
      return { ok: critical === 0, now: critical === 0 ? 'none' : `${critical} critical` };
    }
    case 'successAtLeast': {
      if (!s.meta || s.meta.generatedQPS <= 0) return { ok: false, now: 'no traffic' };
      return { ok: s.meta.successRatePct >= c.pct - EPS, now: pct(s.meta.successRatePct) };
    }
    case 'loadAtLeast': {
      const generated = s.meta?.generatedQPS ?? 0;
      return { ok: generated >= c.qps - EPS, now: formatQPS(generated) };
    }
  }
}

/** All of a lesson's success checks hold. */
export function lessonComplete(lesson: Pick<Lesson, 'checks'>, s: LessonSnapshot): boolean {
  return lesson.checks.every(c => evaluateCondition(c.when, s).ok);
}

/** A copy of a diagram with the lesson's documented fix applied (tests; the steps describe the same edits). */
export function applySolution<T extends { nodes: Node<NodeData>[]; edges: Edge[] }>(diagram: T, patches: LessonPatch[]): T {
  let { nodes, edges } = diagram;
  for (const p of patches) {
    if ('nodeId' in p) {
      if (!nodes.some(n => n.id === p.nodeId)) throw new Error(`solution: no node ${p.nodeId}`);
      nodes = nodes.map(n => (n.id === p.nodeId ? { ...n, data: { ...n.data, ...p.data } as NodeData } : n));
    } else {
      if (!edges.some(e => e.id === p.edgeId)) throw new Error(`solution: no edge ${p.edgeId}`);
      edges = edges.map(e => (e.id === p.edgeId ? { ...e, data: { ...(e.data as EdgeData), ...p.data } } : e));
    }
  }
  return { ...diagram, nodes, edges };
}
