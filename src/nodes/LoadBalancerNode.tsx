import type { NodeProps } from '@xyflow/react';
import { NodeBase, Stat, Meter } from './NodeBase';
import { qps } from './status';
import type { LoadBalancerData } from '../types';

export function LoadBalancerNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as LoadBalancerData;
  return (
    <NodeBase data={data} selected={selected} icon="⚖️" typeLabel="Load Balancer" accentColor="#22d3ee">
      <Stat label="Max QPS" value={qps(data.maxQPS)} />
      {data.actualQPS != null && <Stat label="Incoming" value={qps(data.actualQPS)} />}
      <Meter utilization={data.utilization} />
    </NodeBase>
  );
}
