import type { NodeProps } from '@xyflow/react';
import { NodeBase, Stat, Meter, qpsLabel } from './NodeBase';
import type { DatabaseData } from '../types';

const DB_ICONS: Record<DatabaseData['dbType'], string> = {
  postgres: '🐘', mysql: '🐬', mongodb: '🍃', 'redis-db': '⚡',
};

export function DatabaseNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as DatabaseData;
  const readCap = data.maxReadQPS * (1 + data.readReplicas);
  const capacity = readCap + data.maxWriteQPS;
  const util = data.actualQPS != null ? (data.actualQPS / capacity) * 100 : undefined;
  return (
    <NodeBase data={data} selected={selected} icon={DB_ICONS[data.dbType]} typeLabel="Database" accentColor="#f59e0b">
      <Stat label="Read QPS" value={qpsLabel(data.maxReadQPS)} />
      <Stat label="Write QPS" value={qpsLabel(data.maxWriteQPS)} />
      <Stat label="Replicas" value={data.readReplicas} />
      {data.actualQPS != null && <Stat label="Incoming" value={qpsLabel(data.actualQPS)} />}
      <Meter utilization={util} />
    </NodeBase>
  );
}
