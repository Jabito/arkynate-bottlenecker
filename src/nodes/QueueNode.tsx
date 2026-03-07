import type { NodeProps } from '@xyflow/react';
import { NodeBase, Stat, Meter, qpsLabel } from './NodeBase';
import type { QueueData } from '../types';

const QUEUE_ICONS: Record<QueueData['queueType'], string> = {
  kafka: '📨', rabbitmq: '🐰', sqs: '☁️',
};

export function QueueNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as QueueData;
  const capacity = data.maxThroughput * data.consumers;
  const util = data.actualQPS != null ? (data.actualQPS / capacity) * 100 : undefined;
  return (
    <NodeBase data={data} selected={selected} icon={QUEUE_ICONS[data.queueType]} typeLabel="Queue" accentColor="#8b5cf6">
      <Stat label="Throughput" value={qpsLabel(data.maxThroughput)} />
      <Stat label="Consumers" value={`×${data.consumers}`} />
      <Stat label="Capacity" value={qpsLabel(capacity)} />
      {data.actualQPS != null && <Stat label="Incoming" value={qpsLabel(data.actualQPS)} />}
      <Meter utilization={util} />
    </NodeBase>
  );
}
