import type { NodeProps } from '@xyflow/react';
import { NodeBase, Stat } from './NodeBase';
import { qps } from './status';
import type { LoadGeneratorData } from '../types';

export function LoadGeneratorNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as LoadGeneratorData;
  // A source has no capacity, so no meter and no status (#12).
  return (
    <NodeBase data={data} selected={selected} icon="⚡" typeLabel="Load Generator" hasInput={false} accentColor="#a855f7">
      <Stat label="Emitting" value={qps(data.outputQPS)} />
    </NodeBase>
  );
}
