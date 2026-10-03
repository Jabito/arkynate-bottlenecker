import type { Node, Edge } from '@xyflow/react';
import type { NodeData, EdgeData, AnalysisResult } from '../types';
import { analyzeGraph } from './analyze';

/** Tiny builders for engine tests (not shipped: only *.test.ts import this). */
type N = Node<NodeData>;
const at = { x: 0, y: 0 };

export const lg = (id: string, outputQPS: number): N =>
  ({ id, type: 'loadGenerator', position: at, data: { kind: 'loadGenerator', label: id, outputQPS } });
export const lb = (id: string, maxQPS: number, extra: Record<string, unknown> = {}): N =>
  ({ id, type: 'loadBalancer', position: at, data: { kind: 'loadBalancer', label: id, maxQPS, ...extra } as NodeData });
export const srv = (id: string, maxQPS: number, extra: Record<string, unknown> = {}): N =>
  ({ id, type: 'server', position: at, data: { kind: 'server', label: id, maxQPS, instances: 1, ...extra } as NodeData });
export const db = (id: string, maxReadQPS: number, maxWriteQPS: number, extra: Record<string, unknown> = {}): N =>
  ({ id, type: 'database', position: at, data: { kind: 'database', label: id, dbType: 'postgres', maxReadQPS, maxWriteQPS, readReplicas: 0, readRatio: 70, ...extra } as NodeData });
export const cache = (id: string, hitRate: number, extra: Record<string, unknown> = {}): N =>
  ({ id, type: 'cache', position: at, data: { kind: 'cache', label: id, cacheType: 'redis', hitRate, maxQPS: 50000, ...extra } as NodeData });
export const queue = (id: string, maxThroughput: number, consumers: number, extra: Record<string, unknown> = {}): N =>
  ({ id, type: 'queue', position: at, data: { kind: 'queue', label: id, queueType: 'kafka', maxThroughput, consumers, ...extra } as NodeData });

export const edge = (source: string, target: string, data: Partial<EdgeData> = {}): Edge =>
  ({ id: `${source}->${target}`, source, target, data: { distributionMode: 'auto', ...data } });

export function run(nodes: N[], edges: Edge[], multiplier = 1) {
  const out = analyzeGraph(nodes, edges, multiplier);
  const r = (id: string): AnalysisResult => {
    const found = out.results.find(x => x.nodeId === id);
    if (!found) throw new Error(`no result for ${id}`);
    return found;
  };
  const flow = (source: string, target: string) => out.edgeFlows.get(`${source}->${target}`) ?? NaN;
  const data = (id: string) => out.updatedNodes.find(n => n.id === id)!.data as Record<string, unknown>;
  return { ...out, r, flow, data };
}

/** Return a copy of a diagram with one node's data patched. */
export function patch<T extends { nodes: N[] }>(diagram: T, id: string, change: Record<string, unknown>): T {
  return {
    ...diagram,
    nodes: diagram.nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...change } as NodeData } : n),
  };
}
