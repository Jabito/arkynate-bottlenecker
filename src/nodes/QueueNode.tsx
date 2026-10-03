import type { NodeProps } from '@xyflow/react';
import { NodeBase, Stat, Meter } from './NodeBase';
import { qps } from './status';
import type { QueueData } from '../types';

const QUEUE_ICONS: Record<QueueData['queueType'], string> = {
  kafka: '📨', rabbitmq: '🐰', sqs: '☁️',
};

export function QueueNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as QueueData;
  return (
    <NodeBase data={data} selected={selected} icon={QUEUE_ICONS[data.queueType]} typeLabel="Queue" accentColor="#8b5cf6">
      <Stat label="Per consumer" value={qps(data.maxThroughput)} />
      <Stat label="Consumers" value={`×${data.consumers}`} />
      {data.capacity != null && <Stat label="Drain rate" value={qps(data.capacity)} />}
      {data.actualQPS != null && <Stat label="Incoming" value={qps(data.actualQPS)} />}
      {(data.backlogQPS ?? 0) > 0 && (
        <div style={{ fontSize: 10, color: 'var(--st-critical)', marginTop: 4 }} title="Messages arriving faster than consumers drain them">
          Backlog +{qps(data.backlogQPS)?.replace('/s', ' msg/s')}
        </div>
      )}
      <Meter utilization={data.utilization} />
    </NodeBase>
  );
}
