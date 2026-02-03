# ADR-007: Use BullMQ Instead of Apache Kafka

**Status:** Accepted
**Date:** 2026-02-02
**Deciders:** Team (3 developers)
**Supersedes:** [ADR-002: Apache Kafka](./ADR-002-kafka-message-queue.md)

---

## Context

Original ADR-002 recommended Apache Kafka for message queue, citing:
- Event streaming capabilities
- High throughput
- Event replay support
- Future-proof for Phase 2 AI features

However, after analyzing **actual MVP requirements** and **team constraints**, we identified critical issues:

### MVP Reality:
- **Expected volume:** < 1000 CV uploads/day
- **Team size:** 3 developers (no Kafka expertise)
- **Timeline:** 2 months MVP
- **Infrastructure:** Docker Compose + Railway
- **Learning curve:** Kafka requires 6+ hours to learn basics

### The Kafka Overkill Problem:
```
Kafka can handle: 1,000,000+ messages/second
MVP needs:        ~10 messages/second (at peak)

That's like using a freight train to deliver a pizza! 🚂🍕
```

---

## Decision

We will use **BullMQ (Redis-based queue)** instead of Apache Kafka for MVP.

**Migration path:** BullMQ → Kafka later if needed (3-5 days effort)

---

## Rationale

### Comparison Matrix

| Criterion | Apache Kafka | BullMQ (Redis) | Winner |
|-----------|--------------|----------------|--------|
| **Setup Time** | 2-4 hours (Kafka + Zookeeper/KRaft) | 15 minutes (just Redis) | 🏆 BullMQ |
| **Learning Curve** | High (6+ hours) | Low (< 2 hours) | 🏆 BullMQ |
| **Throughput** | 1M+ msg/s | 10k msg/s | Kafka (but we need 10/s) |
| **Latency** | ~5-10ms | ~1-5ms | 🏆 BullMQ |
| **Memory Usage** | 512MB+ | 50MB+ | 🏆 BullMQ |
| **Dashboard** | Complex (Kafka Manager) | Simple (Bull Board) | 🏆 BullMQ |
| **Retry Logic** | Manual implementation | Built-in | 🏆 BullMQ |
| **Priority Queues** | Manual | Built-in | 🏆 BullMQ |
| **Delayed Jobs** | Manual | Built-in | 🏆 BullMQ |
| **Event Replay** | Built-in | Not available | 🏆 Kafka |
| **Event Sourcing** | Native support | Not designed for it | 🏆 Kafka |
| **Multi-Consumer** | Native | Possible but hacky | 🏆 Kafka |

### For MVP (< 1000 CVs/day):
**Winner:** 🏆 **BullMQ** (9 vs 3)

### For Phase 2 (> 100k events/day):
**Winner:** 🏆 **Kafka** (3 vs 9)

---

## Why BullMQ for MVP?

### ✅ **Pros:**

**1. Simplicity**
```yaml
# Kafka setup (3 services!)
services:
  zookeeper:
    image: confluentinc/cp-zookeeper
    # 100 lines of config...

  kafka:
    image: confluentinc/cp-kafka
    # 200 lines of config...
    depends_on: [zookeeper]

  kafka-ui:
    image: provectuslabs/kafka-ui
    # 50 lines of config...

# BullMQ setup (1 service!)
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

**2. Built-in Features**
```typescript
// Retry with exponential backoff (built-in!)
queue.add('parse-cv', data, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000  // 2s, 4s, 8s
  }
});

// Priority queues
queue.add('urgent-cv', data, { priority: 1 });
queue.add('normal-cv', data, { priority: 10 });

// Delayed jobs
queue.add('retry-later', data, {
  delay: 60000  // 1 minute
});
```

**3. Beautiful Dashboard**
```typescript
// Bull Board - Web UI
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

createBullBoard({
  queues: [
    new BullMQAdapter(cvQueue),
    new BullMQAdapter(notificationQueue),
  ],
});

// Access at: http://localhost:3000/admin/queues
// See: Jobs, Retries, Failed, Completed
```

**4. Redis Dual Purpose**
```typescript
// Same Redis for:
// 1. BullMQ queues
// 2. Session cache
// 3. Rate limiting
// 4. WebSocket pub/sub

// Cost: 1 Redis instance instead of Kafka + Zookeeper
```

**5. TypeScript-First**
```typescript
// Type-safe queue interfaces
interface CvUploadedPayload {
  candidateId: string;
  fileUrl: string;
  jobId: string;
}

// Producer
await cvQueue.add('process', {
  candidateId: '123',
  fileUrl: 'https://...',
  jobId: '456',
} as CvUploadedPayload);

// Consumer
cvQueue.process('process', async (job: Job<CvUploadedPayload>) => {
  const { candidateId, fileUrl } = job.data;
  // TypeScript auto-complete! ✨
});
```

### ❌ **Cons:**

**1. No Event Replay**
- Messages deleted after processing
- Cannot replay events from specific timestamp
- **Mitigation:** Audit logs in PostgreSQL

**2. Not Designed for Event Sourcing**
- Queues are ephemeral
- Cannot rebuild state from events
- **Mitigation:** Database is source of truth (not queue)

**3. Single Consumer Pattern**
- Each job consumed by one worker
- Multiple consumers need separate queues
- **Mitigation:** Fan-out pattern if needed

---

## Why NOT Kafka for MVP?

### ❌ **Problems:**

**1. Complexity Overhead**
```bash
# Kafka basics - 6 hours learning:
- Brokers, Partitions, Topics
- Consumer Groups, Offsets
- Rebalancing, ISR
- Zookeeper (or KRaft mode in 3.x)
- ACLs, SASL authentication

# BullMQ basics - 1 hour learning:
- Queue, Job, Worker
- Done. That's it. ✨
```

**2. Infrastructure Burden**
```yaml
# Kafka resource requirements (minimum):
- Kafka broker: 512MB RAM
- Zookeeper: 256MB RAM
- Kafka UI: 128MB RAM
Total: ~900MB RAM

# BullMQ resource requirements:
- Redis: 50MB RAM
Total: 50MB RAM

# For MVP with 1000 CVs/day: Kafka is 18x overkill
```

**3. Debugging Difficulty**
```typescript
// Kafka: Check multiple places
// 1. Is broker running?
// 2. Is Zookeeper running?
// 3. Consumer group status?
// 4. Topic partitions assigned?
// 5. Offset committed?

// BullMQ: One place
// 1. Open Bull Board dashboard
// 2. See jobs (waiting, active, failed)
// 3. Done. ✨
```

**4. Premature Optimization**
```
YAGNI Principle: "You Ain't Gonna Need It"

Kafka features we DON'T need for MVP:
- Event replay (no time-travel requirements)
- Event sourcing (database is source of truth)
- Millions of messages/day (we have < 1000)
- Multiple consumers (only 1 CV parser)
- Partitioning (volume too low)
- Exactly-once semantics (at-least-once is fine)
```

---

## Technical Implementation

### Queue Topics

**MVP Queues:**
```typescript
// Queue 1: CV Processing
const cvQueue = new Queue('cv-processing', {
  connection: {
    host: 'localhost',
    port: 6379,
  },
});

// Queue 2: Notifications
const notificationQueue = new Queue('notifications', {
  connection: {
    host: 'localhost',
    port: 6379,
  },
});
```

**Event Payloads:**
```typescript
// cv-processing queue
interface CvUploadedEvent {
  candidateId: string;
  fileUrl: string;
  jobId: string;
  timestamp: Date;
}

// notifications queue
interface CvProcessedEvent {
  candidateId: string;
  aiScore: number;
  status: 'success' | 'failed';
  extractedData: {
    skills: string[];
    experience: string;
  };
}
```

### Producer Pattern (API Gateway)

```typescript
// src/queue/queue.service.ts
import { Queue } from 'bullmq';

@Injectable()
export class QueueService {
  private cvQueue: Queue;

  constructor() {
    this.cvQueue = new Queue('cv-processing', {
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
      },
    });
  }

  async emitCvUploaded(data: CvUploadedEvent): Promise<void> {
    await this.cvQueue.add('parse-cv', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,  // Keep last 100 successful jobs
      removeOnFail: 500,      // Keep last 500 failed jobs
    });
  }
}
```

### Consumer Pattern (CV Parser Service)

```typescript
// CV Parser Service (Spring Boot or ASP.NET)
// Using Node.js example for clarity

import { Worker } from 'bullmq';

const worker = new Worker('cv-processing', async (job) => {
  const { candidateId, fileUrl, jobId } = job.data;

  // Update progress
  await job.updateProgress(25);
  console.log(`Downloading CV: ${fileUrl}`);

  // Download file
  const buffer = await downloadFile(fileUrl);
  await job.updateProgress(50);

  // Parse PDF/DOCX
  const text = await parseDocument(buffer);
  await job.updateProgress(75);

  // Extract skills & calculate score
  const skills = extractSkills(text);
  const score = calculateAIScore(skills, jobId);
  await job.updateProgress(100);

  // Update database
  await updateCandidate(candidateId, { skills, score });

  // Emit next event
  await notificationQueue.add('cv-processed', {
    candidateId,
    aiScore: score,
    status: 'success',
    extractedData: { skills, experience: '5 years' },
  });

  return { success: true };
}, {
  connection: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
  },
  concurrency: 5,  // Process 5 CVs simultaneously
  limiter: {
    max: 10,       // Max 10 jobs
    duration: 1000, // Per second
  },
});

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});
```

---

## Migration Path: BullMQ → Kafka

**When to migrate:**
- Throughput > 100,000 events/day
- Need event sourcing & replay
- Multiple services need same events
- Analytics requires historical data

**Migration effort:** 3-5 days

**Steps:**
```typescript
// 1. Create Kafka adapter (abstraction layer)
interface QueueService {
  add(topic: string, data: any): Promise<void>;
  process(topic: string, handler: Function): void;
}

// 2. BullMQ implementation (current)
class BullMQService implements QueueService { ... }

// 3. Kafka implementation (future)
class KafkaService implements QueueService { ... }

// 4. Swap at runtime
const queue: QueueService = process.env.USE_KAFKA
  ? new KafkaService()
  : new BullMQService();

// Application code unchanged! ✨
```

**Data migration:**
- None needed (queues are ephemeral)
- Historical data in PostgreSQL (not queue)
- Kafka starts fresh with new events

---

## Consequences

### Positive:

✅ **Fast MVP Development:**
- Setup in 15 minutes vs 2-4 hours
- Learn in 2 hours vs 6+ hours
- Debug in 1 click (Bull Board) vs multiple tools

✅ **Cost Efficient:**
- 1 Redis instance (50MB RAM)
- vs Kafka + Zookeeper (900MB RAM)
- **18x less memory for MVP scale**

✅ **Developer Experience:**
- Beautiful dashboard (Bull Board)
- TypeScript-first
- Built-in retry, priority, delays
- Easy to reason about

✅ **Operational Simplicity:**
- Single Redis service to monitor
- Fewer moving parts
- Easier troubleshooting

### Negative:

⚠️ **No Event Replay:**
- Cannot replay events from past
- **Mitigation:** Audit logs in PostgreSQL

⚠️ **Limited Throughput:**
- Max ~10k jobs/minute (still 100x more than MVP needs)
- **Mitigation:** Migrate to Kafka when needed

⚠️ **Ephemeral Queue:**
- Redis restart = messages lost (if not persisted)
- **Mitigation:** Redis persistence (RDB/AOF)

### Mitigation Strategies:

**Persistence:**
```yaml
# docker-compose.yml
redis:
  image: redis:7-alpine
  command: redis-server --appendonly yes
  volumes:
    - redis_data:/data
```

**Monitoring:**
```typescript
// Health check endpoint
@Get('health/queue')
async queueHealth() {
  const waiting = await cvQueue.getWaitingCount();
  const active = await cvQueue.getActiveCount();
  const failed = await cvQueue.getFailedCount();

  return {
    status: waiting < 100 ? 'healthy' : 'degraded',
    waiting,
    active,
    failed,
  };
}
```

**Alerting:**
```typescript
// Alert if queue backlog > 100
if (waiting > 100) {
  await sendAlert({
    message: 'CV queue backlog high',
    severity: 'warning',
  });
}
```

---

## Real-World Examples

### Companies Using BullMQ at Scale:

- **Vercel**: Background job processing
- **Prisma**: Database migration jobs
- **Strapi**: CMS background tasks
- **Many startups**: MVP → Scale with BullMQ

### When They Migrate to Kafka:

- **After 100k+ events/day**
- **After Series A/B funding**
- **When analytics team needs event replay**
- **Not before!**

---

## Success Metrics

### BullMQ will be considered successful if:

**MVP (Week 8):**
- [ ] CV processing time < 10s (p95)
- [ ] Queue lag < 10 jobs (p95)
- [ ] Zero message loss
- [ ] < 1% failed jobs (after retries)
- [ ] Team can debug issues in < 5 minutes

**Post-MVP (Month 3-6):**
- [ ] Handle 1000+ CVs/day
- [ ] < 0.1% message loss
- [ ] No performance issues
- [ ] Team still happy with BullMQ 😊

### When to consider Kafka migration:

- [ ] Throughput > 100,000 events/day
- [ ] Event replay requested by business
- [ ] Multiple services need same events
- [ ] Analytics team needs historical data
- [ ] Performance issues with BullMQ

---

## Related Decisions

- [ADR-002: Apache Kafka](./ADR-002-kafka-message-queue.md) - **Superseded**
- [ADR-006: Hybrid Microservices](./ADR-006-hybrid-microservices.md) - Architecture
- [ADR-008: Cloudflare R2](./ADR-008-cloudflare-r2.md) - Storage

---

## References

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Bull Board Dashboard](https://github.com/felixmosh/bull-board)
- [When to Use Kafka vs RabbitMQ vs BullMQ](https://stackshare.io/stackups/apache-kafka-vs-rabbitmq)
- [The Problem with Kafka (for small teams)](https://materializedview.io/p/the-problem-with-kafka)

---

**Last Updated:** 2026-02-02
**Next Review:** Week 8 (MVP launch) - Assess if BullMQ meets needs
