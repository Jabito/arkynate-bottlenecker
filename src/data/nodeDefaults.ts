import type { NodeKind, NodeData } from '../types';

/** Default data for a freshly added node of each kind (palette click and drag-drop). */
export const NODE_DEFAULTS: Record<NodeKind, () => NodeData> = {
  loadGenerator: () => ({ kind: 'loadGenerator', label: 'Load Generator', outputQPS: 1000 }),
  loadBalancer:  () => ({ kind: 'loadBalancer', label: 'Load Balancer', maxQPS: 5000, strategy: 'round-robin' }),
  server:        () => ({ kind: 'server', label: 'API Server', maxQPS: 500, instances: 1 }),
  database:      () => ({ kind: 'database', label: 'Database', dbType: 'postgres', maxReadQPS: 1000, maxWriteQPS: 300, readReplicas: 0, readRatio: 70 }),
  cache:         () => ({ kind: 'cache', label: 'Redis Cache', cacheType: 'redis', hitRate: 80, maxQPS: 50000 }),
  queue:         () => ({ kind: 'queue', label: 'Message Queue', queueType: 'kafka', maxThroughput: 1000, consumers: 3 }),
};
