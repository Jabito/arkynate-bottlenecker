import type { NodeData, NodeKind, DatabaseData } from '../types';
import { NODE_FIELD_LIMITS, clampField } from './limits';
import { NODE_DEFAULTS } from '../data/nodeDefaults';

/** Base latency used when a node leaves `baseLatencyMs` empty. */
export const DEFAULT_LATENCY_MS: Record<NodeKind, number> = {
  loadGenerator: 0,
  loadBalancer:  2,
  server:        50,
  database:      15,
  cache:         1,
  queue:         5,
};

/** Fields a node may leave empty; the engine substitutes 0 / DEFAULT_LATENCY_MS. */
const OPTIONAL_FIELDS = new Set(['errorRate', 'baseLatencyMs']);

export function isKnownKind(kind: unknown): kind is NodeKind {
  return typeof kind === 'string' && Object.prototype.hasOwnProperty.call(NODE_FIELD_LIMITS, kind);
}

/**
 * Clamp every numeric field of a node to NODE_FIELD_LIMITS. A missing or non-numeric
 * required field falls back to the palette default. Returns the clean data plus the
 * names of fields that had to be changed (reported as `invalid` warnings).
 */
export function sanitizeNodeData(data: NodeData): { data: NodeData; invalid: string[] } {
  const limits = NODE_FIELD_LIMITS[data.kind];
  const defaults = NODE_DEFAULTS[data.kind]() as Record<string, unknown>;
  const out: Record<string, unknown> = { ...data };
  const invalid: string[] = [];
  for (const [field, limit] of Object.entries(limits)) {
    const raw = out[field];
    if (raw === undefined && OPTIONAL_FIELDS.has(field)) continue;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      const fallback = defaults[field];
      out[field] = typeof fallback === 'number' ? fallback : OPTIONAL_FIELDS.has(field) ? undefined : limit.min;
      invalid.push(field);
      continue;
    }
    const clamped = clampField(raw, limit);
    if (clamped !== raw) invalid.push(field);
    out[field] = clamped;
  }
  return { data: out as NodeData, invalid };
}

/** Database read capacity (primary + replicas), write capacity (primary only) and read share 0-1. */
export function dbCapacities(data: DatabaseData): { readCap: number; writeCap: number; readShare: number } {
  return {
    readCap:   data.maxReadQPS * (1 + data.readReplicas),
    writeCap:  data.maxWriteQPS,
    readShare: (data.readRatio ?? 70) / 100,
  };
}

/**
 * Requests per second a node can serve. One formula per kind, used everywhere.
 * - server: maxQPS is per instance, so capacity = maxQPS × instances
 * - database: the incoming rate at which the busier of the read path
 *   (maxRead × (1 + replicas)) and the write path (maxWrite) reaches 100%
 * - queue: drain rate = consumers × maxThroughput
 * - load generator: a source, it has no capacity (Infinity)
 */
export function capacityOf(data: NodeData): number {
  switch (data.kind) {
    case 'loadGenerator': return Infinity;
    case 'loadBalancer':  return data.maxQPS;
    case 'server':        return data.maxQPS * data.instances;
    case 'cache':         return data.maxQPS;
    case 'queue':         return data.maxThroughput * data.consumers;
    case 'database': {
      const { readCap, writeCap, readShare } = dbCapacities(data);
      const byRead  = readShare > 0 ? readCap / readShare : Infinity;
      const byWrite = readShare < 1 ? writeCap / (1 - readShare) : Infinity;
      return Math.min(byRead, byWrite);
    }
  }
}

/** Configured error rate as a fraction 0-1. */
export function configuredErrorOf(data: NodeData): number {
  if (data.kind === 'loadGenerator') return 0;
  return (data.errorRate ?? 0) / 100;
}

export function baseLatencyOf(data: NodeData): number {
  if (data.kind === 'loadGenerator') return 0;
  return data.baseLatencyMs ?? DEFAULT_LATENCY_MS[data.kind];
}
