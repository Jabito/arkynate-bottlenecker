import type { Node, Edge } from '@xyflow/react';
import type { NodeData } from '../types';

const edgeStyle = { stroke: '#22d3ee', strokeWidth: 2 };
const edgeBase = { animated: true, style: edgeStyle, data: { distributionMode: 'auto' } };

export interface Template {
  name: string;
  description: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
}

export const TEMPLATES: Template[] = [
  {
    name: 'Simple Web App',
    description: 'Load Generator → Server → PostgreSQL',
    nodes: [
      { id: 'lg1',  type: 'loadGenerator', position: { x: 100, y: 200 }, data: { kind: 'loadGenerator', label: 'Load Generator', outputQPS: 1000 } },
      { id: 'srv1', type: 'server',         position: { x: 400, y: 200 }, data: { kind: 'server',         label: 'API Server',     maxQPS: 800,  instances: 2 } },
      { id: 'db1',  type: 'database',       position: { x: 700, y: 200 }, data: { kind: 'database',       label: 'PostgreSQL',     dbType: 'postgres', maxReadQPS: 1000, maxWriteQPS: 300, readReplicas: 0, readRatio: 70 } },
    ],
    edges: [
      { id: 'e1', source: 'lg1',  target: 'srv1', ...edgeBase },
      { id: 'e2', source: 'srv1', target: 'db1',  ...edgeBase },
    ],
  },
  {
    name: 'Cached API',
    description: '5k QPS → Load Balancer → 2× API Server → Redis (80% hit) → PostgreSQL',
    nodes: [
      { id: 'lg1',    type: 'loadGenerator', position: { x: 50,  y: 200 }, data: { kind: 'loadGenerator', label: 'Load Generator', outputQPS: 5000 } },
      { id: 'lb1',    type: 'loadBalancer',  position: { x: 280, y: 200 }, data: { kind: 'loadBalancer',  label: 'Load Balancer',  maxQPS: 6000, strategy: 'round-robin' } },
      { id: 'srv1',   type: 'server',        position: { x: 510, y: 80  }, data: { kind: 'server',        label: 'API Server 1',   maxQPS: 3000, instances: 1 } },
      { id: 'srv2',   type: 'server',        position: { x: 510, y: 310 }, data: { kind: 'server',        label: 'API Server 2',   maxQPS: 3000, instances: 1 } },
      { id: 'cache1', type: 'cache',         position: { x: 740, y: 200 }, data: { kind: 'cache',         label: 'Redis Cache',    cacheType: 'redis', hitRate: 80, maxQPS: 50000 } },
      { id: 'db1',    type: 'database',      position: { x: 970, y: 200 }, data: { kind: 'database',      label: 'PostgreSQL',     dbType: 'postgres', maxReadQPS: 1000, maxWriteQPS: 300, readReplicas: 0, readRatio: 70 } },
    ],
    edges: [
      { id: 'e1', source: 'lg1',    target: 'lb1',    ...edgeBase },
      { id: 'e2', source: 'lb1',    target: 'srv1',   ...edgeBase },
      { id: 'e3', source: 'lb1',    target: 'srv2',   ...edgeBase },
      { id: 'e4', source: 'srv1',   target: 'cache1', ...edgeBase },
      { id: 'e5', source: 'srv2',   target: 'cache1', ...edgeBase },
      { id: 'e6', source: 'cache1', target: 'db1',    ...edgeBase },
    ],
  },
  {
    name: 'Microservices',
    description: '3k QPS → Load Balancer → Auth & Data APIs → separate databases',
    nodes: [
      { id: 'lg1',    type: 'loadGenerator', position: { x: 50,  y: 270 }, data: { kind: 'loadGenerator', label: 'Load Generator', outputQPS: 3000 } },
      { id: 'lb1',    type: 'loadBalancer',  position: { x: 280, y: 270 }, data: { kind: 'loadBalancer',  label: 'Load Balancer',  maxQPS: 4000, strategy: 'round-robin' } },
      { id: 'auth1',  type: 'server',        position: { x: 510, y: 120 }, data: { kind: 'server',        label: 'Auth API',       maxQPS: 2000, instances: 1 } },
      { id: 'data1',  type: 'server',        position: { x: 510, y: 420 }, data: { kind: 'server',        label: 'Data API',       maxQPS: 2000, instances: 1 } },
      { id: 'userdb', type: 'database',      position: { x: 740, y: 120 }, data: { kind: 'database',      label: 'User DB',        dbType: 'postgres', maxReadQPS: 1500, maxWriteQPS: 500, readReplicas: 0, readRatio: 80 } },
      { id: 'appdb',  type: 'database',      position: { x: 740, y: 420 }, data: { kind: 'database',      label: 'App DB',         dbType: 'postgres', maxReadQPS: 1500, maxWriteQPS: 500, readReplicas: 0, readRatio: 70 } },
    ],
    edges: [
      { id: 'e1', source: 'lg1',   target: 'lb1',    ...edgeBase },
      { id: 'e2', source: 'lb1',   target: 'auth1',  ...edgeBase },
      { id: 'e3', source: 'lb1',   target: 'data1',  ...edgeBase },
      { id: 'e4', source: 'auth1', target: 'userdb', ...edgeBase },
      { id: 'e5', source: 'data1', target: 'appdb',  ...edgeBase },
    ],
  },
  {
    name: 'Event-Driven Pipeline',
    description: '10k QPS → LB → API → Kafka Queue → 3× Consumers → MongoDB',
    nodes: [
      { id: 'lg1', type: 'loadGenerator', position: { x: 50,   y: 300 }, data: { kind: 'loadGenerator', label: 'Load Generator', outputQPS: 10000 } },
      { id: 'lb1', type: 'loadBalancer',  position: { x: 280,  y: 300 }, data: { kind: 'loadBalancer',  label: 'Load Balancer',  maxQPS: 12000, strategy: 'round-robin' } },
      { id: 'api', type: 'server',        position: { x: 510,  y: 300 }, data: { kind: 'server',        label: 'API Server',     maxQPS: 12000, instances: 1 } },
      { id: 'q1',  type: 'queue',         position: { x: 740,  y: 300 }, data: { kind: 'queue',         label: 'Kafka Queue',    queueType: 'kafka', maxThroughput: 4000, consumers: 3 } },
      { id: 'c1',  type: 'server',        position: { x: 970,  y: 150 }, data: { kind: 'server',        label: 'Consumer 1',     maxQPS: 4000, instances: 1 } },
      { id: 'c2',  type: 'server',        position: { x: 970,  y: 300 }, data: { kind: 'server',        label: 'Consumer 2',     maxQPS: 4000, instances: 1 } },
      { id: 'c3',  type: 'server',        position: { x: 970,  y: 450 }, data: { kind: 'server',        label: 'Consumer 3',     maxQPS: 4000, instances: 1 } },
      { id: 'mdb', type: 'database',      position: { x: 1200, y: 300 }, data: { kind: 'database',      label: 'MongoDB',        dbType: 'mongodb', maxReadQPS: 5000, maxWriteQPS: 5000, readReplicas: 0, readRatio: 50 } },
    ],
    edges: [
      { id: 'e1', source: 'lg1', target: 'lb1', ...edgeBase },
      { id: 'e2', source: 'lb1', target: 'api', ...edgeBase },
      { id: 'e3', source: 'api', target: 'q1',  ...edgeBase },
      { id: 'e4', source: 'q1',  target: 'c1',  ...edgeBase },
      { id: 'e5', source: 'q1',  target: 'c2',  ...edgeBase },
      { id: 'e6', source: 'q1',  target: 'c3',  ...edgeBase },
      { id: 'e7', source: 'c1',  target: 'mdb', ...edgeBase },
      { id: 'e8', source: 'c2',  target: 'mdb', ...edgeBase },
      { id: 'e9', source: 'c3',  target: 'mdb', ...edgeBase },
    ],
  },
];
