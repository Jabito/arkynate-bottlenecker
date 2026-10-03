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
  actualQPS?: number;
  status?: NodeStatus;
}

export interface LoadBalancerData extends Record<string, unknown> {
  kind: 'loadBalancer';
  label: string;
  maxQPS: number;
  strategy: 'round-robin' | 'weighted' | 'least-conn';
  errorRate?: number;
  baseLatencyMs?: number;
  actualQPS?: number;
  status?: NodeStatus;
  errorRatePct?: number;
  estimatedLatencyMs?: number;
}

export interface ServerData extends Record<string, unknown> {
  kind: 'server';
  label: string;
  maxQPS: number;
  instances: number;
  errorRate?: number;
  baseLatencyMs?: number;
  actualQPS?: number;
  status?: NodeStatus;
  errorRatePct?: number;
  estimatedLatencyMs?: number;
}

export interface DatabaseData extends Record<string, unknown> {
  kind: 'database';
  label: string;
  dbType: 'postgres' | 'mysql' | 'mongodb' | 'redis-db';
  maxReadQPS: number;
  maxWriteQPS: number;
  readReplicas: number;
  readRatio: number;
  errorRate?: number;
  baseLatencyMs?: number;
  actualQPS?: number;
  status?: NodeStatus;
  errorRatePct?: number;
  estimatedLatencyMs?: number;
}

export interface CacheData extends Record<string, unknown> {
  kind: 'cache';
  label: string;
  cacheType: 'redis' | 'memcached' | 'cdn';
  hitRate: number;
  maxQPS: number;
  errorRate?: number;
  baseLatencyMs?: number;
  actualQPS?: number;
  status?: NodeStatus;
  errorRatePct?: number;
  estimatedLatencyMs?: number;
}

export interface QueueData extends Record<string, unknown> {
  kind: 'queue';
  label: string;
  queueType: 'kafka' | 'rabbitmq' | 'sqs';
  maxThroughput: number;
  consumers: number;
  errorRate?: number;
  baseLatencyMs?: number;
  actualQPS?: number;
  status?: NodeStatus;
  errorRatePct?: number;
  estimatedLatencyMs?: number;
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
  estimatedLatencyMs: number;
  cumulativeLatencyMs: number;
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
] as const;

export interface AnalysisWarning {
  kind: 'cycle' | 'unallocated' | 'overallocated' | 'invalid';
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
  /** Share of generated requests that complete successfully end to end (0-100). */
  successRatePct: number;
}
