import type { NodeProps } from '@xyflow/react';
import { NodeBase, Stat, Meter, qpsLabel } from './NodeBase';
import type { CacheData } from '../types';

const CACHE_ICONS: Record<CacheData['cacheType'], string> = {
  redis: '🔴', memcached: '🟡', cdn: '🌐',
};

export function CacheNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as CacheData;
  const util = data.actualQPS != null ? (data.actualQPS / data.maxQPS) * 100 : undefined;
  const missQPS = data.actualQPS != null ? data.actualQPS * (1 - data.hitRate / 100) : undefined;
  return (
    <NodeBase data={data} selected={selected} icon={CACHE_ICONS[data.cacheType]} typeLabel="Cache" accentColor="#22d3ee">
      <Stat label="Max QPS" value={qpsLabel(data.maxQPS)} />
      <Stat label="Hit Rate" value={`${data.hitRate}%`} />
      {data.actualQPS != null && (
        <>
          <Stat label="Incoming" value={qpsLabel(data.actualQPS)} />
          <Stat label="→ Miss" value={qpsLabel(missQPS)} />
        </>
      )}
      <Meter utilization={util} />
    </NodeBase>
  );
}
