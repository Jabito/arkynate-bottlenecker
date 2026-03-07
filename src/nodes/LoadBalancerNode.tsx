import type { NodeProps } from '@xyflow/react';
import { NodeBase, Stat, Meter, qpsLabel } from './NodeBase';
import type { LoadBalancerData } from '../types';

export function LoadBalancerNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as LoadBalancerData;
  const util = data.actualQPS != null ? (data.actualQPS / data.maxQPS) * 100 : undefined;
  return (
    <NodeBase data={data} selected={selected} icon="⚖️" typeLabel="Load Balancer" accentColor="#22d3ee">
      <Stat label="Max QPS" value={qpsLabel(data.maxQPS)} />
      <Stat label="Strategy" value={data.strategy} />
      {data.actualQPS != null && <Stat label="Incoming" value={qpsLabel(data.actualQPS)} />}
      <Meter utilization={util} />
    </NodeBase>
  );
}
