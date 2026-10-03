import type { Node, Edge } from '@xyflow/react';
import type {
  NodeData, AnalysisResult, NodeStatus, EdgeData, AnalysisMeta, AnalysisWarning,
} from '../types';
import { COMPUTED_NODE_KEYS } from '../types';
import { statusOf, formatQPS } from './format';
import {
  capacityOf, configuredErrorOf, baseLatencyOf, dbCapacities, sanitizeNodeData, isKnownKind,
} from './capacity';
import { allocate, expectedAttempts, readOutEdge, type OutEdge } from './allocation';
import { evaluationOrder } from './graph';

/*
 * Flow model (owner decisions, 2026-10-03):
 * - A node serves min(incoming, capacity); configured errors fail a share of what it serves;
 *   the rest of the overload is shed as errors. Only successful requests go downstream (#2, #8).
 * - A queue serves (drains) min(incoming, consumers × throughput); the excess is backlog
 *   growth, not errors. The queue ends the synchronous request: nodes behind it are async and
 *   left out of request latency and success rate (#24).
 * - Retries on an edge multiply its traffic by the expected attempts Σₖ₌₀ʳ eᵏ, where e is the
 *   target's total error rate (configured + overload). Since that rate depends on the traffic,
 *   the whole graph is iterated to a fixed point, with absolute caps applied after retries (#23).
 * - Cycles are iterated the same way, in an order that depends only on the graph (#9).
 */

/** Rounds before the solver gives up and reports a `convergence` warning. */
export const MAX_ROUNDS = 500;
const REL_TOL = 1e-9;
/** Rounds after which error-rate updates are damped, to settle oscillating retry loops. */
const DAMP_AFTER = 40;
/** Unallocated output below this is floating-point noise, not a modelling gap. */
const UNALLOCATED_EPS = 1e-6;

interface Prepared {
  node: Node<NodeData>;
  data: NodeData;
  known: boolean;
  capacity: number;
  configuredError: number;
  baseLatency: number;
  inEdges: string[];
  outEdges: OutEdge[];
}

interface NodeFlow {
  incoming: number;
  served: number;
  errorQPS: number;
  forwarded: number;
  unallocated: number;
  backlog: number;
  /** Requests that finish at this node (terminal success, cache hits, unallocated, enqueued). */
  completed: number;
}

export interface AnalyzeOutput {
  updatedNodes: Node<NodeData>[];
  results: AnalysisResult[];
  edgeFlows: Map<string, number>;
  meta: AnalysisMeta;
}

const STATUS_RANK: Record<NodeStatus, number> = { critical: 0, near: 1, warning: 2, healthy: 3 };

function utilizationOf(p: Prepared, incoming: number): number {
  if (p.data.kind === 'loadGenerator') return 0;
  if (incoming <= 0) return 0;
  if (!(p.capacity > 0)) return Infinity;
  return (incoming / p.capacity) * 100;
}

/** M/M/1 mean latency; unbounded at or past saturation. A queue's publish latency does not inflate. */
function latencyOf(p: Prepared, utilization: number): number {
  if (p.data.kind === 'loadGenerator') return 0;
  if (p.data.kind === 'queue' || !p.known) return p.baseLatency;
  const rho = utilization / 100;
  if (rho >= 1) return Infinity;
  return p.baseLatency / (1 - rho);
}

export function analyzeGraph(
  nodes: Node<NodeData>[],
  edges: Edge[],
  qpsMultiplier = 1,
): AnalyzeOutput {
  const warnings: AnalysisWarning[] = [];
  const prepared = new Map<string, Prepared>();

  for (const node of nodes) {
    const raw = node.data;
    const known = isKnownKind(raw?.kind);
    let data = raw;
    if (known) {
      const clean = sanitizeNodeData(raw);
      data = clean.data;
      if (clean.invalid.length > 0) {
        warnings.push({
          kind: 'invalid', nodeId: node.id,
          message: `${raw.label ?? node.id}: ${clean.invalid.join(', ')} out of range — clamped to valid values.`,
        });
      }
    } else {
      const name = (raw as { label?: string } | undefined)?.label ?? node.id;
      warnings.push({ kind: 'invalid', nodeId: node.id, message: `${name}: unknown component type — passed through without a capacity.` });
    }
    prepared.set(node.id, {
      node, data, known,
      capacity: known ? capacityOf(data) : Infinity,
      configuredError: known ? configuredErrorOf(data) : 0,
      baseLatency: known ? baseLatencyOf(data) : 0,
      inEdges: [], outEdges: [],
    });
  }

  const label = (id: string) => prepared.get(id)?.data.label ?? id;
  const edgeTarget = new Map<string, string>();
  const edgeSource = new Map<string, string>();
  const successors = new Map<string, string[]>();
  for (const id of prepared.keys()) successors.set(id, []);

  for (const e of edges) {
    const src = prepared.get(e.source);
    const tgt = prepared.get(e.target);
    if (!src || !tgt) {
      warnings.push({ kind: 'invalid', edgeId: e.id, message: `Connection ${e.id} points to a missing component — ignored.` });
      continue;
    }
    if (tgt.data.kind === 'loadGenerator') {
      warnings.push({ kind: 'invalid', edgeId: e.id, nodeId: e.target, message: `${label(e.source)} → ${label(e.target)}: load generators ignore incoming traffic — connection ignored.` });
      continue;
    }
    src.outEdges.push(readOutEdge(e.id, e.data as EdgeData | undefined));
    tgt.inEdges.push(e.id);
    edgeSource.set(e.id, e.source);
    edgeTarget.set(e.id, e.target);
    successors.get(e.source)!.push(e.target);
  }
  for (const list of successors.values()) list.sort();

  const { order, cycles, position } = evaluationOrder([...prepared.keys()], successors);

  // ── Fixed-point iteration ────────────────────────────────────────────────
  const edgeFlow = new Map<string, number>();
  for (const id of edgeTarget.keys()) edgeFlow.set(id, 0);
  /** Error rate (0-1) each node presents to retrying callers; starts at the configured rate. */
  const retryError = new Map<string, number>();
  for (const [id, p] of prepared) retryError.set(id, p.configuredError);
  const flows = new Map<string, NodeFlow>();

  const evaluate = (id: string): NodeFlow => {
    const p = prepared.get(id)!;
    const d = p.data;
    let incoming = 0;
    if (d.kind === 'loadGenerator') incoming = d.outputQPS * qpsMultiplier;
    else for (const eid of p.inEdges) incoming += edgeFlow.get(eid) ?? 0;

    let served: number, errorQPS: number, output: number, backlog = 0, terminalShare = 0;
    if (d.kind === 'loadGenerator') {
      served = incoming; errorQPS = 0; output = incoming;
    } else if (d.kind === 'queue') {
      served = Math.min(incoming, p.capacity);
      errorQPS = served * p.configuredError;
      output = served - errorQPS;
      backlog = incoming - served;
    } else {
      served = Math.min(incoming, p.capacity);
      const success = served * (1 - p.configuredError);
      errorQPS = incoming - success;
      const hit = d.kind === 'cache' ? d.hitRate / 100 : 0;
      output = success * (1 - hit);
      terminalShare = success * hit;
    }

    const plan = allocate(output, p.outEdges);
    for (const oe of p.outEdges) {
      const target = edgeTarget.get(oe.id)!;
      let flow = (plan.base.get(oe.id) ?? 0) * expectedAttempts(retryError.get(target) ?? 0, oe.retryCount);
      if (oe.mode === 'absolute') flow = Math.min(flow, oe.value);
      edgeFlow.set(oe.id, flow);
    }

    // A sink's output simply ends there; only a node with edges can leave traffic unallocated.
    const sink = p.outEdges.length === 0;
    const unallocated = sink ? 0 : plan.unallocated;
    const forwarded = sink ? 0 : output - unallocated;
    let completed: number;
    if (d.kind === 'loadGenerator') completed = 0;
    else if (d.kind === 'queue') completed = incoming - errorQPS; // enqueued = done, for the caller
    else completed = terminalShare + (sink ? output : unallocated);

    return { incoming, served, errorQPS, forwarded, unallocated, backlog, completed };
  };

  let converged = false;
  let rounds = 0;
  while (rounds < MAX_ROUNDS) {
    rounds++;
    const before = new Map(edgeFlow);
    let delta = 0;
    for (const id of order) {
      const f = evaluate(id);
      flows.set(id, f);
      const p = prepared.get(id)!;
      if (p.data.kind === 'loadGenerator') continue;
      const observed = f.incoming > 0 ? f.errorQPS / f.incoming : p.configuredError;
      const prev = retryError.get(id) ?? 0;
      const next = rounds > DAMP_AFTER ? (prev + observed) / 2 : observed;
      delta = Math.max(delta, Math.abs(next - prev));
      retryError.set(id, next);
    }
    for (const [eid, v] of edgeFlow) {
      const old = before.get(eid) ?? 0;
      delta = Math.max(delta, Math.abs(v - old) / Math.max(1, Math.abs(v)));
    }
    if (delta <= REL_TOL) { converged = true; break; }
  }

  if (!converged) {
    warnings.push({
      kind: 'convergence',
      message: `Retries or a cycle did not settle after ${MAX_ROUNDS} rounds — numbers show the last round.`,
    });
  }

  // ── Cycle warnings ───────────────────────────────────────────────────────
  for (const comp of cycles) {
    const members = new Set(comp);
    let feedback: string | undefined;
    for (const [eid, src] of [...edgeSource].sort((a, b) => a[0].localeCompare(b[0]))) {
      const tgt = edgeTarget.get(eid)!;
      if (members.has(src) && members.has(tgt) && position.get(tgt)! <= position.get(src)!) { feedback = eid; break; }
    }
    const src = feedback ? edgeSource.get(feedback)! : comp[0];
    const tgt = feedback ? edgeTarget.get(feedback)! : comp[0];
    warnings.push({
      kind: 'cycle', edgeId: feedback, nodeId: src,
      message: `Cycle: ${label(src)} → ${label(tgt)} sends traffic back upstream. ${converged ? 'Results show its steady state.' : 'It did not settle.'}`,
    });
  }

  // ── Synchronous share: traffic behind a queue is async ──────────────────
  const syncShare = new Map<string, number>();
  for (let pass = 0; pass < Math.max(1, cycles.length > 0 ? 50 : 1); pass++) {
    let changed = false;
    for (const id of order) {
      const p = prepared.get(id)!;
      let share: number;
      if (p.data.kind === 'loadGenerator') share = 1;
      else {
        const incoming = flows.get(id)!.incoming;
        let syncIn = 0;
        for (const eid of p.inEdges) {
          const src = edgeSource.get(eid)!;
          const srcKind = prepared.get(src)!.data.kind;
          const out = srcKind === 'queue' ? 0 : (syncShare.get(src) ?? 0);
          syncIn += (edgeFlow.get(eid) ?? 0) * out;
        }
        share = incoming > 0 ? Math.min(1, syncIn / incoming) : 0;
      }
      if (Math.abs(share - (syncShare.get(id) ?? 0)) > 1e-12) changed = true;
      syncShare.set(id, share);
    }
    if (!changed) break;
  }

  // ── Per-node results ─────────────────────────────────────────────────────
  const utilization = new Map<string, number>();
  const latency = new Map<string, number>();
  for (const id of order) {
    const p = prepared.get(id)!;
    const u = utilizationOf(p, flows.get(id)!.incoming);
    utilization.set(id, u);
    latency.set(id, latencyOf(p, u));
  }

  // Critical path: slowest synchronous chain over traffic-carrying edges, back edges excluded.
  const cumulative = new Map<string, number>();
  const predecessor = new Map<string, string>();
  for (const id of order) {
    const p = prepared.get(id)!;
    if (p.data.kind === 'loadGenerator') { cumulative.set(id, 0); continue; }
    if ((syncShare.get(id) ?? 0) <= 0) continue;
    let best = -1, bestPred: string | undefined;
    for (const eid of p.inEdges) {
      const src = edgeSource.get(eid)!;
      if ((edgeFlow.get(eid) ?? 0) <= 0) continue;
      if (position.get(src)! >= position.get(id)!) continue;
      if (prepared.get(src)!.data.kind === 'queue') continue;
      const c = cumulative.get(src);
      if (c === undefined) continue;
      if (c > best || (c === best && bestPred !== undefined && src < bestPred)) { best = c; bestPred = src; }
    }
    if (bestPred === undefined) continue;
    cumulative.set(id, best + latency.get(id)!);
    predecessor.set(id, bestPred);
  }
  let pathEnd: string | undefined;
  let pathLatency = -1;
  for (const id of order) {
    if (prepared.get(id)!.data.kind === 'loadGenerator') continue;
    const c = cumulative.get(id);
    // >= : on a tie (e.g. both ∞ behind a saturated node) prefer the downstream end.
    if (c !== undefined && c >= pathLatency) { pathLatency = c; pathEnd = id; }
  }
  const criticalPath: string[] = [];
  for (let cur = pathEnd; cur !== undefined; cur = predecessor.get(cur)) criticalPath.unshift(cur);

  // Generated traffic, completions, mean latency (visits × latency per generated request).
  let generated = 0, completed = 0, timeSum = 0;
  for (const id of order) {
    const p = prepared.get(id)!;
    const f = flows.get(id)!;
    if (p.data.kind === 'loadGenerator') { generated += f.forwarded; continue; }
    const share = syncShare.get(id) ?? 0;
    if (share <= 0 || f.incoming <= 0) continue;
    completed += f.completed * share;
    const visits = f.incoming * share;
    const w = latency.get(id)!;
    timeSum += w === Infinity ? Infinity : visits * w;
  }
  const endToEndLatencyMs = generated > 0 ? timeSum / generated : null;
  const successRatePct = generated > 0 ? Math.max(0, Math.min(100, (completed / generated) * 100)) : 100;

  // ── Allocation and backlog warnings ──────────────────────────────────────
  for (const id of order) {
    const p = prepared.get(id)!;
    const f = flows.get(id)!;
    if (p.outEdges.length > 0) {
      const percentSum = p.outEdges.filter(e => e.mode === 'percent').reduce((s, e) => s + e.value, 0);
      if (percentSum > 100) {
        warnings.push({ kind: 'overallocated', nodeId: id, message: `${label(id)}: percent connections add up to ${+percentSum.toFixed(1)}% — scaled down to 100%.` });
      }
      if (f.unallocated > UNALLOCATED_EPS * Math.max(1, f.forwarded + f.unallocated)) {
        warnings.push({ kind: 'unallocated', nodeId: id, message: `${label(id)}: ${formatQPS(f.unallocated)} is not sent on any connection. Add an auto connection to carry the rest, or it ends here.` });
      }
    }
    if (p.data.kind === 'queue' && f.backlog > 0) {
      warnings.push({ kind: 'backlog', nodeId: id, message: `${label(id)}: backlog grows by ${formatQPS(f.backlog).replace('/s', ' msg/s')} — consumers drain ${formatQPS(f.served)} of ${formatQPS(f.incoming)}.` });
    }
  }

  // ── Output ───────────────────────────────────────────────────────────────
  const results: AnalysisResult[] = [];
  let saturated = false;
  const updatedNodes = nodes.map(n => {
    const p = prepared.get(n.id)!;
    const f = flows.get(n.id) ?? { incoming: 0, served: 0, errorQPS: 0, forwarded: 0, unallocated: 0, backlog: 0, completed: 0 };
    const base: Record<string, unknown> = { ...n.data };
    for (const k of COMPUTED_NODE_KEYS) delete base[k];

    if (p.data.kind === 'loadGenerator') {
      return { ...n, data: { ...base, actualQPS: f.incoming, forwardedQPS: f.forwarded, unallocatedQPS: f.unallocated } as NodeData };
    }

    const util = utilization.get(n.id) ?? 0;
    const status = statusOf(util);
    const errorRatePct = f.incoming > 0 ? (f.errorQPS / f.incoming) * 100 : 0;
    const estimatedLatencyMs = latency.get(n.id) ?? 0;
    const isAsync = f.incoming > 0 && (syncShare.get(n.id) ?? 0) <= 0;
    if (status === 'critical' && f.incoming > 0) saturated = true;

    const extra: Record<string, unknown> = {};
    if (p.data.kind === 'database') {
      const { readCap, writeCap, readShare } = dbCapacities(p.data);
      extra.readUtilization  = (f.incoming * readShare / readCap) * 100;
      extra.writeUtilization = (f.incoming * (1 - readShare) / writeCap) * 100;
    }
    if (p.data.kind === 'queue') extra.backlogQPS = f.backlog;

    results.push({
      nodeId: n.id, label: p.data.label, kind: p.data.kind,
      actualQPS: f.incoming, capacity: p.capacity, utilization: util, status,
      errorQPS: f.errorQPS, errorRatePct, estimatedLatencyMs,
      cumulativeLatencyMs: cumulative.get(n.id) ?? 0,
      servedQPS: f.served, forwardedQPS: f.forwarded, unallocatedQPS: f.unallocated, backlogQPS: f.backlog,
      headroom: f.incoming > 0 ? p.capacity / f.incoming : Infinity,
      async: isAsync,
    });

    return {
      ...n,
      data: {
        ...base,
        actualQPS: f.incoming,
        status,
        errorRatePct,
        estimatedLatencyMs,
        utilization: util,
        capacity: p.capacity,
        forwardedQPS: f.forwarded,
        unallocatedQPS: f.unallocated,
        ...extra,
      } as NodeData,
    };
  });

  results.sort((a, b) =>
    STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.utilization - a.utilization || a.nodeId.localeCompare(b.nodeId));

  const meta: AnalysisMeta = {
    warnings,
    criticalPath,
    endToEndLatencyMs,
    saturated,
    successRatePct,
    generatedQPS: generated,
    converged,
  };
  return { updatedNodes, results, edgeFlows: edgeFlow, meta };
}
