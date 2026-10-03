import type { Node, Edge } from '@xyflow/react';
import type { NodeData, NodeKind, EdgeData } from '../types';
import { NODE_DEFAULTS } from '../data/nodeDefaults';
import { NODE_FIELD_LIMITS, EDGE_FIELD_LIMITS, clampField } from '../engine/limits';

type AppNode = Node<NodeData>;

export interface ValidatedDiagram {
  nodes: AppNode[];
  edges: Edge[];
  /** Human-readable notes for everything that was dropped or reset. */
  dropped: string[];
}

const MAX_NODES = 500;
const MAX_EDGES = 2000;
const MAX_ID = 100;
const MAX_LABEL = 80;
const MAX_COORD = 1_000_000;

/** String fields with a closed set of values. `strategy` is kept only for back-compat of old saves. */
const ENUM_FIELDS: Record<string, readonly string[]> = {
  dbType:    ['postgres', 'mysql', 'mongodb', 'redis-db'],
  cacheType: ['redis', 'memcached', 'cdn'],
  queueType: ['kafka', 'rabbitmq', 'sqs'],
  strategy:  ['round-robin', 'weighted', 'least-conn'],
};

const OPTIONAL_STRING_FIELDS: Partial<Record<NodeKind, string[]>> = {
  loadBalancer: ['strategy'],
};

const DISTRIBUTION_MODES = ['auto', 'percent', 'absolute'] as const;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isKind(v: unknown): v is NodeKind {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(NODE_DEFAULTS, v);
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function cleanId(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s && s.length <= MAX_ID ? s : undefined;
}

function cleanLabel(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().slice(0, MAX_LABEL);
  return s || undefined;
}

/** Diagram names from files and links: trimmed, bounded, never empty. */
export function cleanName(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback;
  const s = v.trim().slice(0, 100);
  return s || fallback;
}

function validateNodeData(kind: NodeKind, raw: Record<string, unknown>, where: string, notes: string[]): NodeData {
  const defaults = NODE_DEFAULTS[kind]() as Record<string, unknown>;
  const limits = NODE_FIELD_LIMITS[kind];
  const out: Record<string, unknown> = { kind };

  const stringKeys = new Set([
    ...Object.keys(defaults).filter(k => typeof defaults[k] === 'string' && k !== 'kind'),
    ...(OPTIONAL_STRING_FIELDS[kind] ?? []),
  ]);
  const numberKeys = new Set([
    ...Object.keys(defaults).filter(k => typeof defaults[k] === 'number'),
    ...Object.keys(limits),
  ]);

  for (const key of stringKeys) {
    const v = raw[key];
    const allowed = ENUM_FIELDS[key];
    if (key === 'label') {
      out.label = cleanLabel(v) ?? defaults.label;
    } else if (allowed) {
      if (typeof v === 'string' && allowed.includes(v)) out[key] = v;
      else if (key in defaults) out[key] = defaults[key];
    } else if (typeof v === 'string') {
      out[key] = v.slice(0, MAX_LABEL);
    } else if (key in defaults) {
      out[key] = defaults[key];
    }
  }

  for (const key of numberKeys) {
    const present = key in raw && raw[key] !== undefined && raw[key] !== null;
    const n = toNumber(raw[key]);
    const limit = limits[key];
    if (n !== undefined) {
      const clamped = limit ? clampField(n, limit) : n;
      if (clamped !== n) notes.push(`${where}: ${key} ${n} clamped to ${clamped}`);
      out[key] = clamped;
    } else {
      if (present) notes.push(`${where}: ${key} was not a number, reset`);
      if (key in defaults) out[key] = defaults[key];
    }
  }

  return out as NodeData;
}

function validateNode(raw: unknown, index: number, notes: string[]): AppNode | null {
  if (!isObject(raw)) {
    notes.push(`node #${index + 1}: not an object`);
    return null;
  }
  const id = cleanId(raw.id);
  if (!id) {
    notes.push(`node #${index + 1}: missing id`);
    return null;
  }
  const data = isObject(raw.data) ? raw.data : {};
  const kind = isKind(data.kind) ? data.kind : isKind(raw.type) ? raw.type : undefined;
  if (!kind) {
    const k = typeof data.kind === 'string' ? data.kind : typeof raw.type === 'string' ? raw.type : '?';
    notes.push(`node "${id}": unknown kind "${String(k).slice(0, 30)}"`);
    return null;
  }

  const pos = isObject(raw.position) ? raw.position : {};
  const coord = (v: unknown) => {
    const n = toNumber(v) ?? 0;
    return Math.min(MAX_COORD, Math.max(-MAX_COORD, n));
  };

  return {
    id,
    type: kind,
    position: { x: coord(pos.x), y: coord(pos.y) },
    data: validateNodeData(kind, data, `node "${id}"`, notes),
  };
}

function validateEdge(
  raw: unknown,
  index: number,
  kinds: Map<string, NodeKind>,
  notes: string[],
): Edge | null {
  if (!isObject(raw)) {
    notes.push(`edge #${index + 1}: not an object`);
    return null;
  }
  const id = cleanId(raw.id);
  const source = cleanId(raw.source);
  const target = cleanId(raw.target);
  const name = id ?? `#${index + 1}`;
  if (!id || !source || !target) {
    notes.push(`edge ${name}: missing id, source or target`);
    return null;
  }
  if (!kinds.has(source) || !kinds.has(target)) {
    notes.push(`edge ${name}: connects to a node that does not exist`);
    return null;
  }
  if (kinds.get(target) === 'loadGenerator') {
    notes.push(`edge ${name}: load generators cannot receive traffic`);
    return null;
  }

  const d = isObject(raw.data) ? raw.data : {};
  const mode = DISTRIBUTION_MODES.find(m => m === d.distributionMode) ?? 'auto';
  const data: EdgeData = { distributionMode: mode };
  if (mode !== 'auto') {
    const v = toNumber(d.distributionValue);
    if (v !== undefined) data.distributionValue = clampField(v, EDGE_FIELD_LIMITS[mode]);
  }
  const retry = toNumber(d.retryCount);
  if (retry !== undefined) data.retryCount = clampField(retry, EDGE_FIELD_LIMITS.retryCount);
  const label = cleanLabel(d.label);
  if (label) data.label = label;

  const edge: Edge = { id, source, target, animated: true, data };
  const sh = cleanId(raw.sourceHandle);
  const th = cleanId(raw.targetHandle);
  if (sh) edge.sourceHandle = sh;
  if (th) edge.targetHandle = th;
  return edge;
}

/**
 * Turns untrusted diagram input (import file, share link, localStorage) into nodes and edges
 * the app can render: allow-listed fields per kind, numbers clamped to NODE_FIELD_LIMITS,
 * unknown kinds, style/className and dangling edges dropped. Computed analysis keys are
 * dropped too; the store re-runs the analysis. Never throws.
 */
export function validateDiagram(input: unknown): ValidatedDiagram {
  const dropped: string[] = [];
  const src = isObject(input) ? input : {};
  const rawNodes = Array.isArray(src.nodes) ? src.nodes : [];
  const rawEdges = Array.isArray(src.edges) ? src.edges : [];

  if (rawNodes.length > MAX_NODES) dropped.push(`only the first ${MAX_NODES} of ${rawNodes.length} nodes were kept`);
  if (rawEdges.length > MAX_EDGES) dropped.push(`only the first ${MAX_EDGES} of ${rawEdges.length} edges were kept`);

  const nodes: AppNode[] = [];
  const kinds = new Map<string, NodeKind>();
  rawNodes.slice(0, MAX_NODES).forEach((raw, i) => {
    const node = validateNode(raw, i, dropped);
    if (!node) return;
    if (kinds.has(node.id)) {
      dropped.push(`node "${node.id}": duplicate id`);
      return;
    }
    kinds.set(node.id, node.data.kind);
    nodes.push(node);
  });

  const edges: Edge[] = [];
  const edgeIds = new Set<string>();
  rawEdges.slice(0, MAX_EDGES).forEach((raw, i) => {
    const edge = validateEdge(raw, i, kinds, dropped);
    if (!edge) return;
    if (edgeIds.has(edge.id)) {
      dropped.push(`edge ${edge.id}: duplicate id`);
      return;
    }
    edgeIds.add(edge.id);
    edges.push(edge);
  });

  return { nodes, edges, dropped };
}
