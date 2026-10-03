import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import type { NodeData } from '../types';
import { encodeShareFragment, decodeShareToken, readShareLocation } from './shareCodec';
import { validateDiagram } from './validateDiagram';

type AppNode = Node<NodeData>;

function bigDiagram(n: number): { nodes: AppNode[]; edges: Edge[] } {
  const nodes: AppNode[] = [];
  const edges: Edge[] = [];
  for (let i = 0; i < n; i++) {
    nodes.push({
      id: `server-${1700000000000 + i}-${i}`, type: 'server', position: { x: i * 260.123, y: (i % 5) * 180.456 },
      measured: { width: 190, height: 120 }, selected: i === 0,
      data: { kind: 'server', label: `API Server ${i}`, maxQPS: 500 + i, instances: 2, errorRate: 1, baseLatencyMs: 50, actualQPS: 1234.5678, status: 'warning', estimatedLatencyMs: 49999.99 },
    });
  }
  for (let i = 1; i < n; i++) {
    edges.push({ id: `xy-edge__${nodes[i - 1].id}-${nodes[i].id}`, source: nodes[i - 1].id, target: nodes[i].id, animated: true, style: { stroke: '#22d3ee', strokeWidth: 2 }, data: { distributionMode: 'auto', computedQPS: 1000 } });
    if (i > 1) edges.push({ id: `x${i}`, source: nodes[i - 2].id, target: nodes[i].id, data: { distributionMode: 'percent', distributionValue: 30 } });
  }
  return { nodes, edges };
}

async function roundTrip(name: string, nodes: AppNode[], edges: Edge[]) {
  const frag = await encodeShareFragment(name, nodes, edges);
  const loc = readShareLocation({ hash: `#${frag}`, search: '' });
  expect(loc).not.toBeNull();
  return { frag, payload: await decodeShareToken(loc!) as { name: string; nodes: AppNode[]; edges: Edge[] } };
}

describe('share codec', () => {
  it('round-trips unicode names and labels', async () => {
    const { nodes, edges } = bigDiagram(3);
    nodes[0].data.label = 'Café ☕ — 東京 >>??';
    const { frag, payload } = await roundTrip('Diagrama “ñ” 🚀', nodes, edges);
    expect(frag).toMatch(/^d=[A-Za-z0-9_-]+$/); // base64url: no + / =
    expect(payload.name).toBe('Diagrama “ñ” 🚀');
    expect(payload.nodes[0].data.label).toBe('Café ☕ — 東京 >>??');
  });

  it('strips computed and transient fields', async () => {
    const { nodes, edges } = bigDiagram(3);
    const { payload } = await roundTrip('x', nodes, edges);
    const n = payload.nodes[0] as unknown as Record<string, unknown>;
    expect(n).not.toHaveProperty('measured');
    expect(n).not.toHaveProperty('selected');
    expect(n.data).not.toHaveProperty('status');
    expect(n.data).not.toHaveProperty('actualQPS');
    expect(payload.edges[0]).not.toHaveProperty('style');
    expect(payload.edges[0].data).not.toHaveProperty('computedQPS');
    expect(validateDiagram(payload).nodes).toHaveLength(3);
  });

  it('keeps a 40-node / 77-edge diagram well under 8 KB', async () => {
    const { nodes, edges } = bigDiagram(40);
    const { frag, payload } = await roundTrip('Big', nodes, edges);
    expect(frag.length).toBeLessThan(4000);
    expect(payload.nodes).toHaveLength(40);
    expect(payload.edges).toHaveLength(edges.length);
  });

  it('decodes legacy ?diagram= links, including + and / bytes turned into spaces', async () => {
    // Old encoder: standard base64 of UTF-8 JSON. This payload contains '+' and '/'.
    const json = JSON.stringify({ name: 'API Server >>??2 ~~~', nodes: [{ id: 'a', type: 'server', position: { x: 0, y: 0 }, data: { kind: 'server', label: '>>>???', maxQPS: 1, instances: 1 } }], edges: [] });
    const b64 = Buffer.from(json, 'utf-8').toString('base64');
    expect(b64).toMatch(/[+/]/);
    for (const search of [`?diagram=${b64}`, `?diagram=${b64.replace(/\+/g, ' ')}`, `?x=1&diagram=${encodeURIComponent(b64)}`]) {
      const loc = readShareLocation({ hash: '', search });
      expect(loc?.kind).toBe('legacy');
      const payload = await decodeShareToken(loc!) as { name: string };
      expect(payload.name).toBe('API Server >>??2 ~~~');
    }
  });

  it('rejects damaged tokens', async () => {
    const { nodes, edges } = bigDiagram(5);
    const frag = await encodeShareFragment('x', nodes, edges);
    const truncated = frag.slice(0, Math.floor(frag.length / 2));
    await expect(decodeShareToken(readShareLocation({ hash: `#${truncated}`, search: '' })!)).rejects.toThrow();
    await expect(decodeShareToken({ kind: 'd', token: '!!!' })).rejects.toThrow();
  });

  it('finds no payload in an ordinary URL', () => {
    expect(readShareLocation({ hash: '', search: '?template=cached-api' })).toBeNull();
    expect(readShareLocation({ hash: '#top', search: '' })).toBeNull();
  });
});
