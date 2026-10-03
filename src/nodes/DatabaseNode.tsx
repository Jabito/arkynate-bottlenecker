import type { NodeProps } from '@xyflow/react';
import { NodeBase, Stat, Meter } from './NodeBase';
import { qps } from './status';
import type { DatabaseData } from '../types';

const DB_ICONS: Record<DatabaseData['dbType'], string> = {
  postgres: '🐘', mysql: '🐬', mongodb: '🍃', 'redis-db': '⚡',
};

const pct = (v?: number) => (v == null ? undefined : `${Math.round(v)}%`);

export function DatabaseNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as DatabaseData;
  return (
    <NodeBase data={data} selected={selected} icon={DB_ICONS[data.dbType]} typeLabel="Database" accentColor="#f59e0b">
      <Stat label="Max read" value={qps(data.maxReadQPS)} />
      <Stat label="Max write" value={qps(data.maxWriteQPS)} />
      <Stat label="Replicas" value={data.readReplicas} />
      <Stat label="Reads" value={`${data.readRatio}%`} />
      {data.actualQPS != null && <Stat label="Incoming" value={qps(data.actualQPS)} />}
      {data.readUtilization != null && <Stat label="Read path" value={pct(data.readUtilization)} />}
      {data.writeUtilization != null && <Stat label="Write path" value={pct(data.writeUtilization)} />}
      <Meter utilization={data.utilization} />
    </NodeBase>
  );
}
