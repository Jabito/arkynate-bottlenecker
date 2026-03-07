import type { NodeProps } from '@xyflow/react';
import { NodeBase, Stat, Meter, qpsLabel } from './NodeBase';
import type { ServerData } from '../types';

export function ServerNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as ServerData;
  const util = data.actualQPS != null ? (data.actualQPS / data.maxQPS) * 100 : undefined;
  return (
    <NodeBase data={data} selected={selected} icon="🖥️" typeLabel="Server / API" accentColor="#22d3ee">
      <Stat label="Max QPS" value={qpsLabel(data.maxQPS)} />
      <Stat label="Instances" value={`×${data.instances}`} />
      {data.actualQPS != null && <Stat label="Incoming" value={qpsLabel(data.actualQPS)} />}
      <Meter utilization={util} />
    </NodeBase>
  );
}
