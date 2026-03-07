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
  actualQPS?: number;
  status?: NodeStatus;
}

export interface ServerData extends Record<string, unknown> {
  kind: 'server';
  label: string;
  maxQPS: number;
  instances: number;
  actualQPS?: number;
  status?: NodeStatus;
}

export interface DatabaseData extends Record<string, unknown> {
  kind: 'database';
  label: string;
  dbType: 'postgres' | 'mysql' | 'mongodb' | 'redis-db';
  maxReadQPS: number;
  maxWriteQPS: number;
  readReplicas: number;
  readRatio: number;
  actualQPS?: number;
  status?: NodeStatus;
}

export interface CacheData extends Record<string, unknown> {
  kind: 'cache';
  label: string;
  cacheType: 'redis' | 'memcached' | 'cdn';
  hitRate: number;
  maxQPS: number;
  actualQPS?: number;
  status?: NodeStatus;
}

export interface QueueData extends Record<string, unknown> {
  kind: 'queue';
  label: string;
  queueType: 'kafka' | 'rabbitmq' | 'sqs';
  maxThroughput: number;
  consumers: number;
  actualQPS?: number;
  status?: NodeStatus;
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
}

export interface EdgeData extends Record<string, unknown> {
  label?: string;
  distributionMode: 'auto' | 'percent' | 'absolute';
  distributionValue?: number;
}
