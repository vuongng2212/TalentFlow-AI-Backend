# ADR-002: Use Apache Kafka Instead of RabbitMQ

**Status:** Accepted
**Date:** 2026-02-01
**Deciders:** Team (2 developers)

---

## Context

We need a message queue for async communication between services, specifically for CV processing pipeline:

```
API Gateway -> Queue -> AI Worker -> Queue -> Notification Service
```

**Options considered:**
1. **Apache Kafka** - Event streaming platform
2. **RabbitMQ** - Traditional message broker
3. **BullMQ** - Redis-based queue (simpler)
4. **AWS SQS** - Managed queue service

---

## Decision

We will use **Apache Kafka** for message queue.

---

## Rationale

### Why Kafka?

✅ **Pros:**
1. **Event Streaming**: Stores events permanently, supports replay
2. **Scalability**: Handles high throughput (important for future AI matching)
3. **Multi-Consumer**: Multiple services can consume same events
4. **Durability**: Messages are persisted to disk
5. **Future-Proof**: Supports event sourcing and CQRS patterns
6. **Industry Standard**: Used by LinkedIn, Uber, Netflix for similar use cases

❌ **Cons:**
1. **Complexity**: More complex to setup than RabbitMQ or BullMQ
2. **Resource Heavy**: Requires Zookeeper (or KRaft mode in Kafka 3.x)
3. **Overkill for MVP**: Might be overengineered for simple async jobs

### Why NOT RabbitMQ?

- **Traditional message broker**: Messages deleted after consumption
- **Less suitable for event sourcing**: Cannot replay events easily
- **Lower throughput**: Not optimized for high-volume event streaming

### Why NOT BullMQ?

- **Simpler but limited**: Redis-based, not suitable for event streaming
- **Single consumer pattern**: Not ideal for multiple services consuming same events
- **No persistence**: Data lost if Redis crashes

### Why NOT AWS SQS?

- **Vendor Lock-in**: Tied to AWS
- **Local Development**: Harder to develop locally (needs LocalStack)
- **Cost**: Pay per request (can add up quickly)

---

## Trade-offs

### For MVP (Phase 1):
Kafka might be **overkill** for simple CV upload/processing. However:

✅ **Accept complexity now because:**
- Phase 2 will add AI matching, semantic search, analytics
- Event replay will be useful for debugging and reprocessing
- Team decided to invest time in proper architecture upfront

### Alternative considered:
Start with **BullMQ for MVP**, migrate to Kafka in Phase 2:
- ❌ Rejected because migration effort is high
- ✅ Better to build on Kafka from start

---

## Implementation

### Kafka Topics:

```typescript
// Phase 1 (MVP)
cv.uploaded        // Triggered when CV is uploaded
cv.parsed          // CV text extracted
cv.processed       // CV processing complete

// Phase 2 (AI Matching)
cv.embeddings.generated
job.matching.requested
candidate.scored
```

### Technology:
- **Kafka Version**: 3.6+ (KRaft mode, no Zookeeper needed)
- **Client Library**: `kafkajs` (most popular Node.js client)
- **Local Dev**: Docker Compose with single-node Kafka

### Retry Strategy:
- Dead Letter Queue (DLQ) for failed messages
- Exponential backoff for retries
- Max 3 retries before DLQ

---

## Consequences

### Positive:
- Ready for high-volume event processing in Phase 2
- Can replay events for debugging or reprocessing
- Multiple consumers can process same events (e.g., analytics service)
- Industry-proven for similar use cases

### Negative:
- Higher learning curve for team
- More infrastructure to manage (Kafka + Zookeeper/KRaft)
- More complex local development setup

### Mitigation:
- Use Docker Compose for easy local setup
- Implement good monitoring (Kafka lag, consumer errors)
- Document common Kafka operations clearly

---

## Monitoring & Observability

Must track:
- ✅ Kafka consumer lag
- ✅ Message processing time
- ✅ Failed messages in DLQ
- ✅ Topic throughput

Tools:
- Kafka Manager / Redpanda Console
- Prometheus + Grafana for metrics

---

## Related Decisions

- [ADR-001: Use NestJS Monorepo](./ADR-001-nestjs-monorepo.md)
- [ADR-004: Deployment Strategy](./ADR-004-deployment-strategy.md)

---

## References

- [Kafka Use Cases](https://kafka.apache.org/uses)
- [When to use Kafka vs RabbitMQ](https://www.confluent.io/blog/kafka-vs-rabbitmq/)

---

**Last Updated:** 2026-02-01
