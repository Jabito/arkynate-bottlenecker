import { useCallback, useRef } from 'react';
import { useReactFlow, type Node } from '@xyflow/react';
import type { NodeKind, NodeData } from '../types';
import { NODE_DEFAULTS } from '../data/nodeDefaults';
import { useDiagramStore } from '../store/diagramStore';
import { AdBanner, AD_SIZES, PLAYGROUND_ADS_ENABLED } from './AdBanner';

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
    kind: 'cache', icon: '🗃️', label: 'Cache', color: '#22d3ee',
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

// Approximate rendered node size (flow units), used to centre the new node.
const NODE_W = 190;
const NODE_H = 120;
const CASCADE_STEP = 28;
const CASCADE_LEN = 6;

export function ComponentPalette() {
  const addNode = useDiagramStore(s => s.addNode);
  const { screenToFlowPosition, getZoom } = useReactFlow();
  const cascade = useRef(0);

  /** Click-to-add: drop at the centre of the visible canvas, cascading repeated adds (#49). */
  const handleAdd = useCallback((item: PaletteItem) => {
    const pane = document.querySelector('.react-flow')?.getBoundingClientRect();
    const centre = pane
      ? screenToFlowPosition({ x: pane.left + pane.width / 2, y: pane.top + pane.height / 2 })
      : { x: 400, y: 250 };
    const step = (cascade.current++ % CASCADE_LEN) * CASCADE_STEP / getZoom();
    const id = `${item.kind}-${Date.now()}-${idCounter++}`;
    const node: Node<NodeData> = {
      id,
      type: item.kind,
      position: { x: centre.x - NODE_W / 2 + step, y: centre.y - NODE_H / 2 + step },
      data: item.defaultData(),
    };
    addNode(node);
  }, [addNode, screenToFlowPosition, getZoom]);

  return (
    <aside aria-label="Component palette" style={{
      width: 210, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Components
        </h2>
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
            title={`Add ${item.label} to the centre of the canvas, or drag it into place`}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', marginBottom: 4,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
              cursor: 'grab', textAlign: 'left',
              transition: 'all 0.15s', color: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = item.color; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 600, color: 'var(--text-strong)', lineHeight: 1.3 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{item.description}</div>
            </div>
          </button>
        ))}
      </div>
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
        Click to add · Drag onto canvas · Delete to remove
      </div>
      {PLAYGROUND_ADS_ENABLED && <AdBanner
        slot="6844543977"
        size={AD_SIZES.smallSquare}
        style={{ width: '100%', padding: '4px 0', background: 'var(--bg-nav)', borderTop: '1px solid var(--border)', marginTop: 16 }}
      />}
    </aside>
  );
}
