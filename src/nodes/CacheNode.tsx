import type { NodeProps } from '@xyflow/react';
import { NodeBase, Stat, Meter } from './NodeBase';
import { qps } from './status';
import type { CacheData } from '../types';

// Not 🔴/🟡: those read as the critical and warning statuses (#64).
const CACHE_ICONS: Record<CacheData['cacheType'], string> = {
  redis: '🗃️', memcached: '📇', cdn: '🌐',
};

export function CacheNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as CacheData;
  return (
    <NodeBase data={data} selected={selected} icon={CACHE_ICONS[data.cacheType]} typeLabel="Cache" accentColor="#22d3ee">
      <Stat label="Max QPS" value={qps(data.maxQPS)} />
      <Stat label="Hit rate" value={`${data.hitRate}%`} />
      {data.actualQPS != null && <Stat label="Incoming" value={qps(data.actualQPS)} />}
      {(data.forwardedQPS ?? 0) > 0 && <Stat label="→ Misses" value={qps(data.forwardedQPS)} />}
      <Meter utilization={data.utilization} />
    </NodeBase>
  );
}
