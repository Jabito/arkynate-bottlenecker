import type { NodeKind, NodeData } from '../types';

/**
 * Default data for a freshly added node of each kind (palette click and drag-drop).
 * Sized so a first diagram built from defaults (LG → LB → Server → DB) is healthy on the
 * first Analyze (#97): server 1,000 of 1,500 (67%), database 700 reads of 2,000 and
 * 300 writes of 500 (60%). Guarded by analyze.test.ts.
 */
export const NODE_DEFAULTS: Record<NodeKind, () => NodeData> = {
  loadGenerator: () => ({ kind: 'loadGenerator', label: 'Load Generator', outputQPS: 1000 }),
  loadBalancer:  () => ({ kind: 'loadBalancer', label: 'Load Balancer', maxQPS: 5000 }),
  server:        () => ({ kind: 'server', label: 'API Server', maxQPS: 1500, instances: 1 }),
  database:      () => ({ kind: 'database', label: 'Database', dbType: 'postgres', maxReadQPS: 2000, maxWriteQPS: 500, readReplicas: 0, readRatio: 70 }),
  cache:         () => ({ kind: 'cache', label: 'Redis Cache', cacheType: 'redis', hitRate: 80, maxQPS: 50000 }),
  queue:         () => ({ kind: 'queue', label: 'Message Queue', queueType: 'kafka', maxThroughput: 1000, consumers: 3 }),
};
