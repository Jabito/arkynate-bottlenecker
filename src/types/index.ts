export type NodeKind =
  | 'loadGenerator'
  | 'loadBalancer'
  | 'server'
  | 'database'
  | 'cache'
  | 'queue';

export type NodeStatus = 'healthy' | 'warning' | 'near' | 'critical';

// Index signature required by @xyflow/react's Node<T extends Record<string, unknown>>
export interface LoadGeneratorData extends Record<string, unknown> {
  kind: 'loadGenerator';
  label: string;
  outputQPS: number;
  // engine output (COMPUTED_NODE_KEYS)
  actualQPS?: number;
  /** Always undefined: a source has no capacity, so no status. */
  status?: NodeStatus;
  forwardedQPS?: number;
  unallocatedQPS?: number;
}

export interface LoadBalancerData extends Record<string, unknown> {
  kind: 'loadBalancer';
  label: string;
  maxQPS: number;
  /** Legacy (pre-2026-10): kept so old saves load; the engine ignores it. Weight with per-edge percent instead. */
  strategy?: 'round-robin' | 'weighted' | 'least-conn';
  errorRate?: number;
  baseLatencyMs?: number;
  // engine output (COMPUTED_NODE_KEYS)
  actualQPS?: number;
  status?: NodeStatus;
  errorRatePct?: number;
  estimatedLatencyMs?: number;
  utilization?: number;
  capacity?: number;
  forwardedQPS?: number;
  unallocatedQPS?: number;
}

export interface ServerData extends Record<string, unknown> {
  kind: 'server';
  label: string;
  maxQPS: number;
  instances: number;
  errorRate?: number;
  baseLatencyMs?: number;
  // engine output (COMPUTED_NODE_KEYS)
  actualQPS?: number;
  status?: NodeStatus;
  errorRatePct?: number;
  estimatedLatencyMs?: number;
  utilization?: number;
  capacity?: number;
  forwardedQPS?: number;
  unallocatedQPS?: number;
}

export interface DatabaseData extends Record<string, unknown> {
  kind: 'database';
  label: string;
  dbType: 'postgres' | 'mysql' | 'mongodb' | 'redis-db';
  maxReadQPS: number;
  maxWriteQPS: number;
  readReplicas: number;
  /** Share of incoming requests that are reads, 0-100. */
  readRatio: number;
  errorRate?: number;
  baseLatencyMs?: number;
  // engine output (COMPUTED_NODE_KEYS)
  actualQPS?: number;
  status?: NodeStatus;
  errorRatePct?: number;
  estimatedLatencyMs?: number;
  utilization?: number;
  capacity?: number;
  forwardedQPS?: number;
  unallocatedQPS?: number;
  readUtilization?: number;
  writeUtilization?: number;
}

export interface CacheData extends Record<string, unknown> {
  kind: 'cache';
  label: string;
  cacheType: 'redis' | 'memcached' | 'cdn';
  hitRate: number;
  maxQPS: number;
  errorRate?: number;
  baseLatencyMs?: number;
  // engine output (COMPUTED_NODE_KEYS)
  actualQPS?: number;
  status?: NodeStatus;
  errorRatePct?: number;
  estimatedLatencyMs?: number;
  utilization?: number;
  capacity?: number;
  forwardedQPS?: number;
  unallocatedQPS?: number;
}

export interface QueueData extends Record<string, unknown> {
  kind: 'queue';
  label: string;
  queueType: 'kafka' | 'rabbitmq' | 'sqs';
  maxThroughput: number;
  consumers: number;
  errorRate?: number;
  baseLatencyMs?: number;
  // engine output (COMPUTED_NODE_KEYS)
  actualQPS?: number;
  status?: NodeStatus;
  errorRatePct?: number;
  estimatedLatencyMs?: number;
  utilization?: number;
  capacity?: number;
  forwardedQPS?: number;
  unallocatedQPS?: number;
  backlogQPS?: number;
}

export type NodeData =
  | LoadGeneratorData
  | LoadBalancerData
  | ServerData
  | DatabaseData
  | CacheData
  | QueueData;

export interface AnalysisResult {
  nodeId: string;
  label: string;
  kind: NodeKind;
  actualQPS: number;
  capacity: number;
  utilization: number;
  status: NodeStatus;
  errorQPS: number;
  errorRatePct: number;
  /** M/M/1 mean latency at this node; Infinity when utilisation ≥ 100%. */
  estimatedLatencyMs: number;
  /** Slowest synchronous path latency up to and including this node (0 off the request path). */
  cumulativeLatencyMs: number;
  /** Requests actually served: min(incoming, capacity). */
  servedQPS: number;
  /** Successful output sent downstream (after errors, cache hits, queue drain). */
  forwardedQPS: number;
  /** Output not carried by any edge (percent/absolute edges leave a remainder and there is no auto edge). */
  unallocatedQPS: number;
  /** Queues only: backlog growth in msg/s (incoming − drain rate). */
  backlogQPS: number;
  /** Capacity ÷ incoming (Infinity when idle). */
  headroom: number;
  /** True when this node only sees traffic behind a queue (async, outside request latency). */
  async: boolean;
}

export interface EdgeData extends Record<string, unknown> {
  label?: string;
  distributionMode: 'auto' | 'percent' | 'absolute';
  distributionValue?: number;
  retryCount?: number;
  computedQPS?: number;
}

/** Node-data keys written by the engine. Stripped before save / export / share. Engine owns this list. */
export const COMPUTED_NODE_KEYS = [
  'actualQPS', 'status', 'errorRatePct', 'estimatedLatencyMs', 'utilization', 'capacity',
  'forwardedQPS', 'unallocatedQPS', 'backlogQPS', 'readUtilization', 'writeUtilization',
] as const;

export interface AnalysisWarning {
  kind: 'cycle' | 'unallocated' | 'overallocated' | 'backlog' | 'convergence' | 'invalid';
  message: string;
  nodeId?: string;
  edgeId?: string;
}

/** Whole-graph facts from one analysis run (alongside the per-node AnalysisResult[]). */
export interface AnalysisMeta {
  warnings: AnalysisWarning[];
  /** Node ids along the slowest traffic-carrying path, source first. */
  criticalPath: string[];
  /** Traffic-weighted end-to-end latency; null when nothing flows, Infinity when saturated. */
  endToEndLatencyMs: number | null;
  /** True when any traffic-carrying node is over capacity. */
  saturated: boolean;
  /** Share of generated requests that complete successfully end to end (0-100). Requests end at a queue once enqueued. */
  successRatePct: number;
  /** Requests per second entering the system from load generators (allocated to edges). */
  generatedQPS: number;
  /** False when retries or a cycle did not settle within the round limit (a `convergence` warning is also emitted). */
  converged: boolean;
}
