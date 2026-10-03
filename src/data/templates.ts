import type { Node, Edge } from '@xyflow/react';
import type { NodeData } from '../types';

// Edge colour comes from the theme tokens (--edge), so no inline stroke here.
const edgeBase = { animated: true, data: { distributionMode: 'auto' as const } };

export interface Template {
  name: string;
  description: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
}

export const TEMPLATES: Template[] = [
  {
    name: 'Simple Web App',
    description: 'Load Generator → Server → PostgreSQL — with latency & retry modeling',
    nodes: [
      {
        id: 'lg1', type: 'loadGenerator', position: { x: 100, y: 200 },
        data: { kind: 'loadGenerator', label: 'Load Generator', outputQPS: 1000 },
      },
      {
        id: 'srv1', type: 'server', position: { x: 400, y: 200 },
        data: { kind: 'server', label: 'API Server', maxQPS: 800, instances: 2, errorRate: 2, baseLatencyMs: 50 },
      },
      {
        id: 'db1', type: 'database', position: { x: 700, y: 200 },
        data: { kind: 'database', label: 'PostgreSQL', dbType: 'postgres', maxReadQPS: 1000, maxWriteQPS: 400, readReplicas: 0, readRatio: 70, errorRate: 1, baseLatencyMs: 15 },
      },
    ],
    edges: [
      { id: 'e1', source: 'lg1',  target: 'srv1', ...edgeBase },
      { id: 'e2', source: 'srv1', target: 'db1',  ...edgeBase, data: { distributionMode: 'auto' as const, retryCount: 1 } },
    ],
  },
  {
    name: 'Cached API',
    description: '5k QPS → LB → 2× API → Redis (80% hit) → PostgreSQL — with error rates & retries',
    nodes: [
      {
        id: 'lg1', type: 'loadGenerator', position: { x: 50, y: 200 },
        data: { kind: 'loadGenerator', label: 'Load Generator', outputQPS: 5000 },
      },
      {
        id: 'lb1', type: 'loadBalancer', position: { x: 280, y: 200 },
        data: { kind: 'loadBalancer', label: 'Load Balancer', maxQPS: 6000, baseLatencyMs: 2 },
      },
      {
        id: 'srv1', type: 'server', position: { x: 510, y: 80 },
        data: { kind: 'server', label: 'API Server 1', maxQPS: 3000, instances: 1, errorRate: 2, baseLatencyMs: 50 },
      },
      {
        id: 'srv2', type: 'server', position: { x: 510, y: 310 },
        data: { kind: 'server', label: 'API Server 2', maxQPS: 3000, instances: 1, errorRate: 2, baseLatencyMs: 50 },
      },
      {
        id: 'cache1', type: 'cache', position: { x: 740, y: 200 },
        data: { kind: 'cache', label: 'Redis Cache', cacheType: 'redis', hitRate: 80, maxQPS: 50000, baseLatencyMs: 1 },
      },
      {
        id: 'db1', type: 'database', position: { x: 970, y: 200 },
        data: { kind: 'database', label: 'PostgreSQL', dbType: 'postgres', maxReadQPS: 1000, maxWriteQPS: 500, readReplicas: 0, readRatio: 70, errorRate: 5, baseLatencyMs: 20 },
      },
    ],
    edges: [
      { id: 'e1', source: 'lg1',    target: 'lb1',    ...edgeBase },
      { id: 'e2', source: 'lb1',    target: 'srv1',   ...edgeBase },
      { id: 'e3', source: 'lb1',    target: 'srv2',   ...edgeBase },
      { id: 'e4', source: 'srv1',   target: 'cache1', ...edgeBase },
      { id: 'e5', source: 'srv2',   target: 'cache1', ...edgeBase },
      { id: 'e6', source: 'cache1', target: 'db1',    ...edgeBase, data: { distributionMode: 'auto' as const, retryCount: 2 } },
    ],
  },
  {
    name: 'Microservices',
    description: '3k QPS → LB → Auth & Data APIs → separate DBs — with per-service error budgets',
    nodes: [
      {
        id: 'lg1', type: 'loadGenerator', position: { x: 50, y: 270 },
        data: { kind: 'loadGenerator', label: 'Load Generator', outputQPS: 3000 },
      },
      {
        id: 'lb1', type: 'loadBalancer', position: { x: 280, y: 270 },
        data: { kind: 'loadBalancer', label: 'Load Balancer', maxQPS: 4000, baseLatencyMs: 2 },
      },
      {
        id: 'auth1', type: 'server', position: { x: 510, y: 120 },
        data: { kind: 'server', label: 'Auth API', maxQPS: 2000, instances: 1, errorRate: 1, baseLatencyMs: 30 },
      },
      {
        id: 'data1', type: 'server', position: { x: 510, y: 420 },
        data: { kind: 'server', label: 'Data API', maxQPS: 2000, instances: 1, errorRate: 3, baseLatencyMs: 60 },
      },
      {
        id: 'userdb', type: 'database', position: { x: 740, y: 120 },
        data: { kind: 'database', label: 'User DB', dbType: 'postgres', maxReadQPS: 1500, maxWriteQPS: 500, readReplicas: 0, readRatio: 80, errorRate: 1, baseLatencyMs: 10 },
      },
      {
        id: 'appdb', type: 'database', position: { x: 740, y: 420 },
        data: { kind: 'database', label: 'App DB', dbType: 'postgres', maxReadQPS: 1500, maxWriteQPS: 500, readReplicas: 0, readRatio: 70, errorRate: 2, baseLatencyMs: 15 },
      },
    ],
    edges: [
      { id: 'e1', source: 'lg1',   target: 'lb1',    ...edgeBase },
      { id: 'e2', source: 'lb1',   target: 'auth1',  ...edgeBase },
      { id: 'e3', source: 'lb1',   target: 'data1',  ...edgeBase },
      { id: 'e4', source: 'auth1', target: 'userdb', ...edgeBase, data: { distributionMode: 'auto' as const, retryCount: 1 } },
      { id: 'e5', source: 'data1', target: 'appdb',  ...edgeBase, data: { distributionMode: 'auto' as const, retryCount: 1 } },
    ],
  },
  {
    name: 'Event-Driven Pipeline',
    description: '10k QPS → LB → API → Kafka → 3× Consumers → MongoDB — with processing latency',
    nodes: [
      {
        id: 'lg1', type: 'loadGenerator', position: { x: 50, y: 300 },
        data: { kind: 'loadGenerator', label: 'Load Generator', outputQPS: 10000 },
      },
      {
        id: 'lb1', type: 'loadBalancer', position: { x: 280, y: 300 },
        data: { kind: 'loadBalancer', label: 'Load Balancer', maxQPS: 12000, baseLatencyMs: 2 },
      },
      {
        id: 'api', type: 'server', position: { x: 510, y: 300 },
        data: { kind: 'server', label: 'API Server', maxQPS: 12000, instances: 1, errorRate: 1, baseLatencyMs: 40 },
      },
      {
        id: 'q1', type: 'queue', position: { x: 740, y: 300 },
        data: { kind: 'queue', label: 'Kafka Queue', queueType: 'kafka', maxThroughput: 4000, consumers: 3, baseLatencyMs: 5 },
      },
      {
        id: 'c1', type: 'server', position: { x: 970, y: 150 },
        data: { kind: 'server', label: 'Consumer 1', maxQPS: 4000, instances: 1, errorRate: 3, baseLatencyMs: 100 },
      },
      {
        id: 'c2', type: 'server', position: { x: 970, y: 300 },
        data: { kind: 'server', label: 'Consumer 2', maxQPS: 4000, instances: 1, errorRate: 3, baseLatencyMs: 100 },
      },
      {
        id: 'c3', type: 'server', position: { x: 970, y: 450 },
        data: { kind: 'server', label: 'Consumer 3', maxQPS: 4000, instances: 1, errorRate: 3, baseLatencyMs: 100 },
      },
      {
        id: 'mdb', type: 'database', position: { x: 1200, y: 300 },
        data: { kind: 'database', label: 'MongoDB', dbType: 'mongodb', maxReadQPS: 5000, maxWriteQPS: 5000, readReplicas: 0, readRatio: 50, errorRate: 1, baseLatencyMs: 15 },
      },
    ],
    edges: [
      { id: 'e1', source: 'lg1', target: 'lb1', ...edgeBase },
      { id: 'e2', source: 'lb1', target: 'api', ...edgeBase },
      { id: 'e3', source: 'api', target: 'q1',  ...edgeBase },
      { id: 'e4', source: 'q1',  target: 'c1',  ...edgeBase },
      { id: 'e5', source: 'q1',  target: 'c2',  ...edgeBase },
      { id: 'e6', source: 'q1',  target: 'c3',  ...edgeBase },
      { id: 'e7', source: 'c1',  target: 'mdb', ...edgeBase, data: { distributionMode: 'auto' as const, retryCount: 1 } },
      { id: 'e8', source: 'c2',  target: 'mdb', ...edgeBase, data: { distributionMode: 'auto' as const, retryCount: 1 } },
      { id: 'e9', source: 'c3',  target: 'mdb', ...edgeBase, data: { distributionMode: 'auto' as const, retryCount: 1 } },
    ],
  },
  {
    name: 'Retry Storm',
    description: 'A DB at 92% + 3 retries on 15% errors: the retry loop settles at 1.9× load and takes the DB to 178%. Set retries to 0 to compare.',
    nodes: [
      {
        id: 'lg1', type: 'loadGenerator', position: { x: 50, y: 250 },
        data: { kind: 'loadGenerator', label: 'Traffic Spike', outputQPS: 5000 },
      },
      {
        id: 'lb1', type: 'loadBalancer', position: { x: 280, y: 250 },
        data: { kind: 'loadBalancer', label: 'Load Balancer', maxQPS: 6000, baseLatencyMs: 2 },
      },
      {
        id: 'srv1', type: 'server', position: { x: 510, y: 120 },
        data: { kind: 'server', label: 'API Server 1', maxQPS: 3000, instances: 1, errorRate: 2, baseLatencyMs: 45 },
      },
      {
        id: 'srv2', type: 'server', position: { x: 510, y: 380 },
        data: { kind: 'server', label: 'API Server 2', maxQPS: 3000, instances: 1, errorRate: 2, baseLatencyMs: 45 },
      },
      {
        id: 'db1', type: 'database', position: { x: 780, y: 250 },
        data: { kind: 'database', label: 'Primary DB', dbType: 'postgres', maxReadQPS: 5000, maxWriteQPS: 1600, readReplicas: 0, readRatio: 70, errorRate: 15, baseLatencyMs: 20 },
      },
    ],
    edges: [
      { id: 'e1', source: 'lg1',  target: 'lb1',  ...edgeBase },
      { id: 'e2', source: 'lb1',  target: 'srv1', ...edgeBase },
      { id: 'e3', source: 'lb1',  target: 'srv2', ...edgeBase },
      // retryCount 3: each request costs 1 + e + e² + e³ attempts, e = the DB's total error rate.
      // At the configured 15% that is 1.18× (5,762 QPS, 108%); overload raises e, and the
      // solver settles at ~9,500 QPS (1.94× the 4,900 base, 178%). Asserted in lessons.test.ts.
      { id: 'e4', source: 'srv1', target: 'db1',  ...edgeBase, data: { distributionMode: 'auto' as const, retryCount: 3 } },
      { id: 'e5', source: 'srv2', target: 'db1',  ...edgeBase, data: { distributionMode: 'auto' as const, retryCount: 3 } },
    ],
  },
];
