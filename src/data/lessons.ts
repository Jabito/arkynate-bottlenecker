import type { Template } from './templates';
import type { EdgeData } from '../types';

// Edge colour comes from the theme tokens (--edge), so no inline stroke here.
const edgeBase = { animated: true, data: { distributionMode: 'auto' as const } };

/**
 * A condition on the live analysis, evaluated by `src/lib/lessonChecks.ts` after every auto-analysis.
 * `below` needs the node to exist and carry traffic, so deleting the bottleneck never passes.
 */
export type LessonCondition =
  | { kind: 'below'; nodeId: string; pct: number; metric?: 'utilization' | 'readUtilization' | 'writeUtilization' }
  | { kind: 'noCritical' }
  | { kind: 'successAtLeast'; pct: number }
  | { kind: 'loadAtLeast'; qps: number };

export interface LessonStep {
  text: string;
  /** Ticks the step when it holds. Observation steps have none. */
  check?: LessonCondition;
}

export interface LessonCheck {
  label: string;
  when: LessonCondition;
}

/** One config change of the documented fix. Tests apply these; the steps describe them. */
export type LessonPatch =
  | { nodeId: string; data: Record<string, unknown> }
  | { edgeId: string; data: Partial<EdgeData> };

export interface Lesson {
  id: string;
  title: string;
  subtitle: string;
  component: string;
  icon: string;
  badgeColor: string;
  problem: string;
  symptoms: string[];
  rootCause: string;
  mitigations: string[];
  /** "Why this breaks", shown at the top of the playground lesson panel. */
  goal: string;
  /** 2–4 things the learner does in the playground. */
  steps: LessonStep[];
  /** All must hold for the lesson to be complete. False on `diagram`, true once `solution` is applied. */
  checks: LessonCheck[];
  solution: LessonPatch[];
  diagram: Template;
}

export const LESSONS: Lesson[] = [
  {
    id: 'server-cpu-saturation',
    title: 'Server CPU Saturation',
    subtitle: 'When your compute tier can\'t keep up with incoming load',
    component: 'Server',
    icon: '🖥️',
    badgeColor: '#3b82f6',
    problem: 'Two API servers, each provisioned for 2,000 QPS, receive 2,500 QPS apiece from a load balancer handling 5,000 QPS of total traffic. Neither server has any headroom — both run at 125% at the same time. Each completes 2,000 requests per second and sheds the other 500, while its request queue grows without bound and latency spikes across the entire user base.',
    symptoms: [
      'CPU pegged at 95–100% across all instances simultaneously',
      'Latency climbs from ~50 ms without limit as the M/M/1 queue grows (the simulator shows ∞ once a server reaches 100%)',
      'Throughput plateaus even as traffic continues to climb',
      'Load balancer health checks start failing, causing instance flapping',
      'HTTP 5xx error rates rise as servers begin rejecting or timing out requests',
    ],
    rootCause: 'Each server handles 2,500 QPS against a ceiling of 2,000 — 125% utilization. It can complete only 2,000 per second, so 500 per second (20%) are shed; together with the configured 2% errors, 21.6% of requests fail. Under M/M/1 queueing theory, utilization at or above 100% means the queue never drains, so latency is unbounded. With both servers saturated and no autoscaling, there is no path to recovery without intervention.',
    mitigations: [
      'Horizontal scale: add server instances until aggregate capacity exceeds peak QPS by ≥ 30% — set Instances to 2 and each server drops to 62.5%',
      'Autoscaling: configure CPU-based HPA in Kubernetes to scale out before utilization hits 80%',
      'Request shedding: return HTTP 429 at ~75% utilization to signal backpressure upstream',
      'Async offloading: push expensive synchronous work into a background queue so the hot path stays lean',
      'Profiling: identify hot code paths — often a single expensive operation (N+1 query, JSON serialization) drives most CPU usage',
    ],
    goal: 'Both API servers get 2,500 QPS against a 2,000 QPS ceiling (125%). Each sheds 500 requests a second, 21.6% of requests fail and latency is unbounded. Add capacity without dropping any traffic.',
    steps: [
      { text: 'Click API Server 1 and set Instances to 2.', check: { kind: 'below', nodeId: 'srv1', pct: 100 } },
      { text: 'Do the same for API Server 2.', check: { kind: 'below', nodeId: 'srv2', pct: 100 } },
      { text: 'Watch the bar: success climbs from 78.4% to 98% and latency is finite again.' },
    ],
    checks: [
      { label: 'API Server 1 below 100%', when: { kind: 'below', nodeId: 'srv1', pct: 100 } },
      { label: 'API Server 2 below 100%', when: { kind: 'below', nodeId: 'srv2', pct: 100 } },
      { label: 'Success rate ≥ 97%', when: { kind: 'successAtLeast', pct: 97 } },
      { label: 'Still sending the full 5,000 QPS', when: { kind: 'loadAtLeast', qps: 5000 } },
    ],
    solution: [
      { nodeId: 'srv1', data: { instances: 2 } },
      { nodeId: 'srv2', data: { instances: 2 } },
    ],
    diagram: {
      name: 'Server CPU Saturation',
      description: '5k QPS → LB → 2× servers capped at 2k each — both go critical',
      nodes: [
        {
          id: 'lg1', type: 'loadGenerator', position: { x: 80, y: 250 },
          data: { kind: 'loadGenerator', label: 'Load Generator', outputQPS: 5000 },
        },
        {
          id: 'lb1', type: 'loadBalancer', position: { x: 320, y: 250 },
          data: { kind: 'loadBalancer', label: 'Load Balancer', maxQPS: 9000, baseLatencyMs: 2 },
        },
        {
          id: 'srv1', type: 'server', position: { x: 570, y: 110 },
          data: { kind: 'server', label: 'API Server 1', maxQPS: 2000, instances: 1, errorRate: 2, baseLatencyMs: 50 },
        },
        {
          id: 'srv2', type: 'server', position: { x: 570, y: 390 },
          data: { kind: 'server', label: 'API Server 2', maxQPS: 2000, instances: 1, errorRate: 2, baseLatencyMs: 50 },
        },
      ],
      edges: [
        { id: 'e1', source: 'lg1', target: 'lb1', ...edgeBase },
        { id: 'e2', source: 'lb1', target: 'srv1', ...edgeBase },
        { id: 'e3', source: 'lb1', target: 'srv2', ...edgeBase },
      ],
    },
  },
  {
    id: 'database-write-bottleneck',
    title: 'Database Write Bottleneck',
    subtitle: 'Heavy write workloads exposing under-provisioned write capacity',
    component: 'Database',
    icon: '🗄️',
    badgeColor: '#8b5cf6',
    problem: 'An application with an 80% write workload routes 2,000 QPS to a PostgreSQL instance configured with a maxWriteQPS of 400. The read path has comfortable headroom, but the write path faces 1,600 write requests per second against a ceiling of 400 — a 4× overload that causes transaction timeouts and connection pool exhaustion.',
    symptoms: [
      'Write latency spikes dramatically while read latency stays stable',
      'Connection pool exhausted — applications log "too many connections" errors',
      'Replication lag grows on read replicas as the primary falls behind',
      'Disk I/O saturation on WAL (Write-Ahead Log) files',
      'DB CPU high due to lock contention and fsync pressure',
    ],
    rootCause: 'The write capacity (maxWriteQPS: 400) is sized for a read-heavy workload assumption that does not match reality. With 80% of 2,000 incoming QPS being writes, the write path faces 1,600 QPS — 400% of its limit — while the read path is comfortable at 50% (400 reads/s against 800). Read replicas would not help: they add read capacity only, and every write still goes to the primary.',
    mitigations: [
      'Write queuing: buffer writes in Kafka or SQS, letting the DB consume at its own pace',
      'Batch writes: consolidate many small writes into fewer large transactions to reduce per-operation overhead',
      'CQRS: separate write and read models — scale the write store independently from read replicas',
      'Sharding: partition data horizontally so each shard absorbs a fraction of the write load',
      'Right-size the instance: upgrade to an instance class with higher IOPS and more write capacity',
    ],
    goal: '80% of 2,000 QPS are writes: 1,600 writes/s hit a primary that takes 400. The write path runs at 400% while reads sit at 50%. Fix the write path, not the reads.',
    steps: [
      { text: 'Click PostgreSQL. Its card shows the write path at 400% and the read path at 50%.' },
      { text: 'Try Read replicas: 3. The write path does not move, because replicas only add read capacity.' },
      { text: 'Raise Max write QPS (primary) to 2,000: the capacity that batching, sharding or a bigger instance buys.', check: { kind: 'below', nodeId: 'db1', metric: 'writeUtilization', pct: 100 } },
    ],
    checks: [
      { label: 'PostgreSQL write path below 100%', when: { kind: 'below', nodeId: 'db1', metric: 'writeUtilization', pct: 100 } },
      { label: 'No critical components', when: { kind: 'noCritical' } },
      { label: 'Still sending the full 2,000 QPS', when: { kind: 'loadAtLeast', qps: 2000 } },
    ],
    solution: [{ nodeId: 'db1', data: { maxWriteQPS: 2000 } }],
    diagram: {
      name: 'Database Write Bottleneck',
      description: '2k QPS, 80% writes → DB maxWriteQPS 400 → write path crushed',
      nodes: [
        {
          id: 'lg1', type: 'loadGenerator', position: { x: 80, y: 250 },
          data: { kind: 'loadGenerator', label: 'Load Generator', outputQPS: 2000 },
        },
        {
          id: 'srv1', type: 'server', position: { x: 360, y: 250 },
          data: { kind: 'server', label: 'API Server', maxQPS: 3000, instances: 1, errorRate: 0, baseLatencyMs: 40 },
        },
        {
          id: 'db1', type: 'database', position: { x: 650, y: 250 },
          data: { kind: 'database', label: 'PostgreSQL', dbType: 'postgres', maxReadQPS: 800, maxWriteQPS: 400, readReplicas: 0, readRatio: 20, errorRate: 2, baseLatencyMs: 15 },
        },
      ],
      edges: [
        { id: 'e1', source: 'lg1', target: 'srv1', ...edgeBase },
        { id: 'e2', source: 'srv1', target: 'db1', ...edgeBase },
      ],
    },
  },
  {
    id: 'cache-miss-storm',
    title: 'Cache Miss Storm',
    subtitle: 'A cold or misconfigured cache that exposes the database to full traffic',
    component: 'Cache',
    icon: '⚡',
    badgeColor: '#f59e0b',
    problem: 'A Redis cache layer sits between the API servers and the database, but its effective hit rate has collapsed to 5% — caused by a cache flush, a cold restart, or a poorly chosen TTL. 95% of 8,000 QPS (7,600 requests/second) falls through to a database provisioned for 1,500 read QPS, causing immediate saturation.',
    symptoms: [
      'Database CPU spikes suddenly to 100% following a cache flush or deployment',
      'p99 read latency jumps from 1 ms (cache) to 15 ms+ (DB) for all users',
      'Cache hit rate metric drops — visible in Redis INFO stats or CloudWatch',
      'DB connection pool exhaustion as threads pile up waiting for reads',
      'Thundering herd: all cache keys expire simultaneously after a mass invalidation',
    ],
    rootCause: 'With a 5% cache hit rate, only 400 of 8,000 requests are served by Redis. The remaining 7,600 reach the database: 7,220 reads/s against a read ceiling of 1,500 (481%) and 380 writes/s against 300 (127%). The cache was silently absorbing 95% of traffic — at a 95% hit rate the same database sits at 25% — and its absence is catastrophic.',
    mitigations: [
      'Cache warming: pre-populate the cache before going live or after a flush, especially for hot keys',
      'Staggered TTLs: add jitter to expiry times to prevent synchronized mass expiry (thundering herd)',
      'Circuit breaker: detect cache miss rate spikes and shed load before the DB saturates',
      'Read replicas: add database read replicas so that cache misses are absorbed by multiple nodes — 4 replicas cover the 7,220 reads/s, but the 380 writes/s still overload the primary',
      'Local in-process cache: add a small L1 cache (Caffeine, node-lru-cache) to absorb hotspot requests even when Redis misses',
    ],
    goal: 'The cache hit rate collapsed to 5%, so 7,600 of 8,000 requests fall through to PostgreSQL: reads at 481%, writes at 127%. Get the database back under its limits.',
    steps: [
      { text: 'Click PostgreSQL and read its card: reads 481%, writes 127%.' },
      { text: 'Try Read replicas: 4. Reads drop below 100%, but the writes still overload the primary.', check: { kind: 'below', nodeId: 'db1', metric: 'readUtilization', pct: 100 } },
      { text: 'Warm the cache: click Redis Cache and set Hit rate to 95%.', check: { kind: 'below', nodeId: 'db1', pct: 100 } },
    ],
    checks: [
      { label: 'PostgreSQL below 100%', when: { kind: 'below', nodeId: 'db1', pct: 100 } },
      { label: 'No critical components', when: { kind: 'noCritical' } },
      { label: 'Still sending the full 8,000 QPS', when: { kind: 'loadAtLeast', qps: 8000 } },
    ],
    solution: [{ nodeId: 'cache1', data: { hitRate: 95 } }],
    diagram: {
      name: 'Cache Miss Storm',
      description: '8k QPS, cache hitRate 5% → 95% falls through to DB (maxReadQPS 1500)',
      nodes: [
        {
          id: 'lg1', type: 'loadGenerator', position: { x: 60, y: 260 },
          data: { kind: 'loadGenerator', label: 'Load Generator', outputQPS: 8000 },
        },
        {
          id: 'lb1', type: 'loadBalancer', position: { x: 290, y: 260 },
          data: { kind: 'loadBalancer', label: 'Load Balancer', maxQPS: 12000, baseLatencyMs: 2 },
        },
        {
          id: 'srv1', type: 'server', position: { x: 520, y: 120 },
          data: { kind: 'server', label: 'API Server 1', maxQPS: 5000, instances: 1, errorRate: 0, baseLatencyMs: 40 },
        },
        {
          id: 'srv2', type: 'server', position: { x: 520, y: 400 },
          data: { kind: 'server', label: 'API Server 2', maxQPS: 5000, instances: 1, errorRate: 0, baseLatencyMs: 40 },
        },
        {
          id: 'cache1', type: 'cache', position: { x: 760, y: 260 },
          data: { kind: 'cache', label: 'Redis Cache', cacheType: 'redis', hitRate: 5, maxQPS: 50000, baseLatencyMs: 1 },
        },
        {
          id: 'db1', type: 'database', position: { x: 1000, y: 260 },
          data: { kind: 'database', label: 'PostgreSQL', dbType: 'postgres', maxReadQPS: 1500, maxWriteQPS: 300, readReplicas: 0, readRatio: 95, errorRate: 1, baseLatencyMs: 15 },
        },
      ],
      edges: [
        { id: 'e1', source: 'lg1',    target: 'lb1',    ...edgeBase },
        { id: 'e2', source: 'lb1',    target: 'srv1',   ...edgeBase },
        { id: 'e3', source: 'lb1',    target: 'srv2',   ...edgeBase },
        { id: 'e4', source: 'srv1',   target: 'cache1', ...edgeBase },
        { id: 'e5', source: 'srv2',   target: 'cache1', ...edgeBase },
        { id: 'e6', source: 'cache1', target: 'db1',    ...edgeBase },
      ],
    },
  },
  {
    id: 'load-balancer-saturation',
    title: 'Load Balancer Saturation',
    subtitle: 'The traffic distributor itself becoming the single point of constraint',
    component: 'Load Balancer',
    icon: '⚖️',
    badgeColor: '#06b6d4',
    problem: 'A load balancer rated for 6,000 QPS is placed in front of two well-provisioned servers capable of handling the full 10,000 QPS load. Despite having sufficient compute capacity downstream, all traffic is throttled at the ingress tier — the load balancer becomes the sole bottleneck, wasting the server headroom behind it.',
    symptoms: [
      'High connection queue depth at the LB while downstream servers are idle',
      'Uniform latency spike across all endpoints regardless of server load',
      'LB CPU or connection-table saturation visible in cloud provider metrics',
      'Error rate rises at the LB (502/504s) while server error rate stays low',
      'Adding more server instances does not improve performance at all',
    ],
    rootCause: 'The load balancer\'s maxQPS ceiling of 6,000 is 60% of actual traffic (10,000 QPS). It runs at 167%, sheds 4,000 requests per second (40% errors) and passes on only 6,000 — so each server idles at 37.5% (3,000 of 8,000). Unlike server saturation, this bottleneck cannot be resolved by scaling downstream nodes — the constraint sits at the entry point. LB saturation is frequently overlooked because teams focus on server and database metrics.',
    mitigations: [
      'Upgrade or scale the load balancer tier: use a higher-capacity SKU or provision multiple LB instances',
      'DNS-based load balancing: distribute traffic across multiple LBs via weighted DNS or Anycast routing',
      'Connection keep-alive: reduce LB connection churn by enabling HTTP/2 or persistent TCP connections',
      'Offload TLS termination: move TLS to dedicated hardware or CDN to free LB capacity for routing',
      'Layer 4 vs Layer 7: use L4 (TCP) load balancing for high-throughput paths; reserve L7 (HTTP) only where header inspection is required',
    ],
    goal: 'A load balancer rated for 6,000 QPS receives 10,000. It runs at 167% and sheds 40% of requests, while the servers behind it idle at 37.5%.',
    steps: [
      { text: 'Click API Server 1 and set Instances to 4. Nothing improves: the servers were never the problem.' },
      { text: 'Click the Load Balancer and raise Max QPS to 12,000.', check: { kind: 'below', nodeId: 'lb1', pct: 100 } },
    ],
    checks: [
      { label: 'Load balancer below 100%', when: { kind: 'below', nodeId: 'lb1', pct: 100 } },
      { label: 'No critical components', when: { kind: 'noCritical' } },
      { label: 'Success rate ≥ 98%', when: { kind: 'successAtLeast', pct: 98 } },
      { label: 'Still sending the full 10,000 QPS', when: { kind: 'loadAtLeast', qps: 10000 } },
    ],
    solution: [{ nodeId: 'lb1', data: { maxQPS: 12000 } }],
    diagram: {
      name: 'Load Balancer Saturation',
      description: '10k QPS → LB maxQPS 6k → LB is the bottleneck despite healthy servers',
      nodes: [
        {
          id: 'lg1', type: 'loadGenerator', position: { x: 80, y: 250 },
          data: { kind: 'loadGenerator', label: 'Load Generator', outputQPS: 10000 },
        },
        {
          id: 'lb1', type: 'loadBalancer', position: { x: 340, y: 250 },
          data: { kind: 'loadBalancer', label: 'Load Balancer', maxQPS: 6000, baseLatencyMs: 2 },
        },
        {
          id: 'srv1', type: 'server', position: { x: 600, y: 110 },
          data: { kind: 'server', label: 'API Server 1', maxQPS: 8000, instances: 1, errorRate: 1, baseLatencyMs: 50 },
        },
        {
          id: 'srv2', type: 'server', position: { x: 600, y: 390 },
          data: { kind: 'server', label: 'API Server 2', maxQPS: 8000, instances: 1, errorRate: 1, baseLatencyMs: 50 },
        },
      ],
      edges: [
        { id: 'e1', source: 'lg1', target: 'lb1',  ...edgeBase },
        { id: 'e2', source: 'lb1', target: 'srv1', ...edgeBase },
        { id: 'e3', source: 'lb1', target: 'srv2', ...edgeBase },
      ],
    },
  },
  {
    id: 'queue-consumer-lag',
    title: 'Queue Consumer Lag',
    subtitle: 'Insufficient consumers unable to drain a high-throughput queue',
    component: 'Queue',
    icon: '📨',
    badgeColor: '#10b981',
    problem: 'A Kafka queue is receiving 8,000 messages per second, but only 2 consumer instances are running, each capable of processing 2,000 messages/second. Total consumer throughput is 4,000 msg/s — half of the ingestion rate. The queue depth grows at 4,000 msg/s, accumulating hours of backlog within minutes.',
    symptoms: [
      'Consumer lag metric grows continuously — visible in Kafka consumer group offsets',
      'End-to-end processing latency measured from produce to consume increases steadily',
      'Alert fires on consumer lag threshold (e.g., > 100k messages behind)',
      'Downstream systems receive stale data as freshness degrades with lag',
      'Memory pressure on brokers as unread partitions accumulate',
    ],
    rootCause: 'Queue drain rate is maxThroughput × consumers = 2,000 × 2 = 4,000 msg/s. At 8,000 msgs/s ingestion, consumers process only 50% of incoming load: the queue runs at 200%. This is not a spike — it is a sustained 2× overload. Each second, 4,000 messages accumulate as backlog (a queue buffers rather than failing), and the lag compounds faster than it can be recovered during off-peak hours. The consumer servers behind the queue see only the drained 2,000 msg/s each, so they look healthy while the lag grows.',
    mitigations: [
      'Scale consumers horizontally: add more consumer instances up to the partition count (e.g., 8 consumers for 8 partitions) — 4 consumers only match ingestion (100%), so plan for 5 or more, and scale the consumer servers with them',
      'Increase partition count: more partitions enable more parallel consumers — plan partition count for peak load at deployment',
      'Consumer batching: process messages in micro-batches to amortize per-message overhead',
      'Separate fast and slow consumers: use dedicated consumer groups for latency-sensitive vs. bulk processing',
      'Backpressure from producer: implement producer-side rate limiting if downstream can never catch up',
    ],
    goal: '2 consumers × 2,000 msg/s drain 4,000 msg/s, but 8,000 arrive. The queue runs at 200% and the backlog grows by 4,000 messages every second.',
    steps: [
      { text: 'Click Kafka Queue and set Consumers to 5 (a drain rate of 10,000 msg/s).', check: { kind: 'below', nodeId: 'q1', pct: 100 } },
      { text: 'The consumer servers now get 4,000 msg/s each against 2,500. Set Instances to 2 on Consumer 1 and Consumer 2.', check: { kind: 'noCritical' } },
    ],
    checks: [
      { label: 'Kafka Queue drains faster than it fills (below 100%)', when: { kind: 'below', nodeId: 'q1', pct: 100 } },
      { label: 'No critical components, consumers included', when: { kind: 'noCritical' } },
      { label: 'Still sending the full 8,000 msg/s', when: { kind: 'loadAtLeast', qps: 8000 } },
    ],
    solution: [
      { nodeId: 'q1', data: { consumers: 5 } },
      { nodeId: 'c1', data: { instances: 2 } },
      { nodeId: 'c2', data: { instances: 2 } },
    ],
    diagram: {
      name: 'Queue Consumer Lag',
      description: '8k QPS → Queue maxThroughput 2k, 2 consumers → 4k capacity → queue saturated',
      nodes: [
        {
          id: 'lg1', type: 'loadGenerator', position: { x: 80, y: 260 },
          data: { kind: 'loadGenerator', label: 'Load Generator', outputQPS: 8000 },
        },
        {
          id: 'srv1', type: 'server', position: { x: 340, y: 260 },
          data: { kind: 'server', label: 'API Server', maxQPS: 10000, instances: 1, errorRate: 0, baseLatencyMs: 30 },
        },
        {
          id: 'q1', type: 'queue', position: { x: 600, y: 260 },
          data: { kind: 'queue', label: 'Kafka Queue', queueType: 'kafka', maxThroughput: 2000, consumers: 2, baseLatencyMs: 5 },
        },
        {
          id: 'c1', type: 'server', position: { x: 860, y: 140 },
          data: { kind: 'server', label: 'Consumer 1', maxQPS: 2500, instances: 1, errorRate: 1, baseLatencyMs: 80 },
        },
        {
          id: 'c2', type: 'server', position: { x: 860, y: 380 },
          data: { kind: 'server', label: 'Consumer 2', maxQPS: 2500, instances: 1, errorRate: 1, baseLatencyMs: 80 },
        },
      ],
      edges: [
        { id: 'e1', source: 'lg1',  target: 'srv1', ...edgeBase },
        { id: 'e2', source: 'srv1', target: 'q1',   ...edgeBase },
        { id: 'e3', source: 'q1',   target: 'c1',   ...edgeBase },
        { id: 'e4', source: 'q1',   target: 'c2',   ...edgeBase },
      ],
    },
  },
  {
    id: 'retry-storm',
    title: 'Retry Storm',
    subtitle: 'Aggressive client retries amplifying load on an already-struggling database',
    component: 'Retry',
    icon: '🔁',
    badgeColor: '#ef4444',
    problem: 'A PostgreSQL database with a 20% error rate (connection timeouts under load) runs at 92% — 4,900 QPS against a capacity of 5,333 — behind API servers configured with retryCount: 3. Each failed call is retried up to 3 times, so every request costs 1 + 0.2 + 0.2² + 0.2³ ≈ 1.25 attempts. That pushes the database past 100%; once it is overloaded it sheds load, its error rate climbs, and every new error triggers more retries in a reinforcing feedback loop.',
    symptoms: [
      'Database QPS in monitoring is significantly higher than expected given client traffic',
      'Error rate stays elevated even after the initial failure event passes',
      'CPU and connection count on the database oscillate in a sawtooth pattern as retries cause new failures',
      'Client-side timeout metrics show high retry counts — often hidden in SDK/HTTP client logs',
      'Cascading failures: upstream services begin timing out as latency climbs, triggering their own retries',
    ],
    rootCause: 'Expected attempts per request are 1 + e + e² + e³, where e is the database\'s total error rate — configured plus overload. At e = 20% that is 1.25×, which takes the database to 115%. Past 100% it sheds load, e rises, attempts rise, and the loop settles at about 10,700 QPS: 2.2× the 4,900 base load, 200% utilization, 60% of attempts failing and unbounded latency. Without retries the same database runs at 92%. Retries recover some failed requests, but they triple the database\'s error rate. The system is in a positive feedback loop where more retries → more load → more errors → more retries.',
    mitigations: [
      'Exponential backoff with jitter: never retry with a fixed interval — use randomized exponential delays to desynchronize clients',
      'Retry budget: cap total retries per request at the service boundary, not per-hop (e.g., 3 retries total, not 3 per microservice)',
      'Circuit breaker: stop sending requests (and retries) when error rate exceeds a threshold — fail fast and recover',
      'Idempotency: ensure operations are safe to retry by design; use idempotency keys for write operations',
      'Retry only on transient errors: distinguish 503 (retry) from 422 (do not retry) — never retry on non-transient errors',
    ],
    goal: 'Each failed database call is retried up to 3 times. The extra load raises the error rate, which triggers more retries, until the database settles at 200%.',
    steps: [
      { text: 'Click the API Server 1 → Primary DB connection and set Retries on error to 0. Do the same for API Server 2. The database drops to 92%.', check: { kind: 'below', nodeId: 'db1', pct: 100 } },
      { text: 'Notice the success rate falls to 78.4%: the retries were hiding the database\'s 20% error rate.' },
      { text: 'Fix the root cause: click Primary DB and set Error rate to 2%.', check: { kind: 'successAtLeast', pct: 95 } },
    ],
    checks: [
      { label: 'Primary DB below 100%', when: { kind: 'below', nodeId: 'db1', pct: 100 } },
      { label: 'No critical components', when: { kind: 'noCritical' } },
      { label: 'Success rate ≥ 95%', when: { kind: 'successAtLeast', pct: 95 } },
      { label: 'Still sending the full 5,000 QPS', when: { kind: 'loadAtLeast', qps: 5000 } },
    ],
    solution: [
      { edgeId: 'e4', data: { retryCount: 0 } },
      { edgeId: 'e5', data: { retryCount: 0 } },
      { nodeId: 'db1', data: { errorRate: 2 } },
    ],
    diagram: {
      name: 'Retry Storm',
      description: 'DB at 92% with 20% errors + retryCount 3 → retry loop settles at 2.2× load → DB at 200%',
      nodes: [
        {
          id: 'lg1', type: 'loadGenerator', position: { x: 80, y: 260 },
          data: { kind: 'loadGenerator', label: 'Load Generator', outputQPS: 5000 },
        },
        {
          id: 'lb1', type: 'loadBalancer', position: { x: 330, y: 260 },
          data: { kind: 'loadBalancer', label: 'Load Balancer', maxQPS: 8000, baseLatencyMs: 2 },
        },
        {
          id: 'srv1', type: 'server', position: { x: 580, y: 120 },
          data: { kind: 'server', label: 'API Server 1', maxQPS: 3000, instances: 1, errorRate: 2, baseLatencyMs: 45 },
        },
        {
          id: 'srv2', type: 'server', position: { x: 580, y: 400 },
          data: { kind: 'server', label: 'API Server 2', maxQPS: 3000, instances: 1, errorRate: 2, baseLatencyMs: 45 },
        },
        {
          id: 'db1', type: 'database', position: { x: 840, y: 260 },
          data: { kind: 'database', label: 'Primary DB', dbType: 'postgres', maxReadQPS: 5000, maxWriteQPS: 1600, readReplicas: 0, readRatio: 70, errorRate: 20, baseLatencyMs: 20 },
        },
      ],
      edges: [
        { id: 'e1', source: 'lg1',  target: 'lb1',  ...edgeBase },
        { id: 'e2', source: 'lb1',  target: 'srv1', ...edgeBase },
        { id: 'e3', source: 'lb1',  target: 'srv2', ...edgeBase },
        { id: 'e4', source: 'srv1', target: 'db1',  ...edgeBase, data: { distributionMode: 'auto' as const, retryCount: 3 } },
        { id: 'e5', source: 'srv2', target: 'db1',  ...edgeBase, data: { distributionMode: 'auto' as const, retryCount: 3 } },
      ],
    },
  },
];
