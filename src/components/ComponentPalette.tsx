import { useCallback } from 'react';
import type { Node } from '@xyflow/react';
import type { NodeKind, NodeData } from '../types';
import { NODE_DEFAULTS } from '../data/nodeDefaults';
import { useDiagramStore } from '../store/diagramStore';
import { AdBanner } from './AdBanner';

interface PaletteItem {
  kind: NodeKind;
  icon: string;
  label: string;
  description: string;
  color: string;
  defaultData: () => NodeData;
}

const ITEMS: PaletteItem[] = [
  {
    kind: 'loadGenerator', icon: '⚡', label: 'Load Generator', color: '#a855f7',
    description: 'Defines incoming traffic source',
    defaultData: NODE_DEFAULTS.loadGenerator,
  },
  {
    kind: 'loadBalancer', icon: '⚖️', label: 'Load Balancer', color: '#22d3ee',
    description: 'Distributes traffic across targets',
    defaultData: NODE_DEFAULTS.loadBalancer,
  },
  {
    kind: 'server', icon: '🖥️', label: 'Server / API', color: '#22d3ee',
    description: 'API server or microservice',
    defaultData: NODE_DEFAULTS.server,
  },
  {
    kind: 'database', icon: '🗄️', label: 'Database', color: '#f59e0b',
    description: 'Relational or document store',
    defaultData: NODE_DEFAULTS.database,
  },
  {
    kind: 'cache', icon: '🔴', label: 'Cache', color: '#22d3ee',
    description: 'Redis, Memcached, or CDN',
    defaultData: NODE_DEFAULTS.cache,
  },
  {
    kind: 'queue', icon: '📨', label: 'Queue', color: '#8b5cf6',
    description: 'Kafka, RabbitMQ, or SQS',
    defaultData: NODE_DEFAULTS.queue,
  },
];

let idCounter = 1;

export function ComponentPalette() {
  const addNode = useDiagramStore(s => s.addNode);

  const handleAdd = useCallback((item: PaletteItem) => {
    const id = `${item.kind}-${Date.now()}-${idCounter++}`;
    const node: Node<NodeData> = {
      id,
      type: item.kind,
      position: { x: 300 + Math.random() * 200, y: 150 + Math.random() * 200 },
      data: item.defaultData(),
    };
    addNode(node);
  }, [addNode]);

  return (
    <div style={{
      width: 210, background: '#111827', borderRight: '1px solid #1e2d45',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #1e2d45' }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Components
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }} className="scrollbar-thin">
        {ITEMS.map(item => (
          <button
            key={item.kind}
            draggable
            onClick={() => handleAdd(item)}
            onDragStart={e => {
              e.dataTransfer.effectAllowed = 'copy';
              e.dataTransfer.setData('application/bottlenecker', JSON.stringify({ kind: item.kind, defaultData: item.defaultData() }));
            }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', marginBottom: 4,
              background: '#1a2235', border: '1px solid #1e2d45', borderRadius: 8,
              cursor: 'grab', textAlign: 'left',
              transition: 'all 0.15s', color: 'inherit',
            }}
            onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = item.color; b.style.background = '#1e2a40'; }}
            onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = '#1e2d45'; b.style.background = '#1a2235'; }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.3 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{item.description}</div>
            </div>
          </button>
        ))}
      </div>
      <div style={{ padding: '12px 14px', borderTop: '1px solid #1e2d45', fontSize: 10, color: '#4a5568', lineHeight: 1.5 }}>
        Click to add · Drag onto canvas · Delete to remove
      </div>
      <AdBanner
        slot="6844543977"
        format="rectangle"
        style={{ width: '100%', background: '#0d1526', borderTop: '1px solid #1e2d45', marginTop: 8 }}
      />
    </div>
  );
}
