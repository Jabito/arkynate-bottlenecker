import type { NodeProps } from '@xyflow/react';
import { NodeBase, Stat, Meter, qpsLabel } from './NodeBase';
import type { LoadGeneratorData } from '../types';

export function LoadGeneratorNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as LoadGeneratorData;
  const util = data.actualQPS != null ? (data.actualQPS / data.outputQPS) * 100 : undefined;
  return (
    <NodeBase data={data} selected={selected} icon="⚡" typeLabel="Load Generator" hasInput={false} accentColor="#a855f7">
      <Stat label="Output QPS" value={qpsLabel(data.outputQPS)} />
      {data.actualQPS != null && <Stat label="Active" value={qpsLabel(data.actualQPS)} />}
      <Meter utilization={util} />
    </NodeBase>
  );
}
