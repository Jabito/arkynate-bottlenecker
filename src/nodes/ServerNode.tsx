import type { NodeProps } from '@xyflow/react';
import { NodeBase, Stat, Meter } from './NodeBase';
import { qps } from './status';
import type { ServerData } from '../types';

export function ServerNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as ServerData;
  return (
    <NodeBase data={data} selected={selected} icon="🖥️" typeLabel="Server / API" accentColor="#22d3ee">
      <Stat label="Max / instance" value={qps(data.maxQPS)} />
      <Stat label="Instances" value={`×${data.instances}`} />
      {data.capacity != null && <Stat label="Capacity" value={qps(data.capacity)} />}
      {data.actualQPS != null && <Stat label="Incoming" value={qps(data.actualQPS)} />}
      <Meter utilization={data.utilization} />
    </NodeBase>
  );
}
