# ADR-009: Use RabbitMQ for Polyglot Inter-Service Communication

**Status:** Accepted
**Date:** 2026-02-18
**Deciders:** Team (3 developers)
**Supersedes:** [ADR-007: BullMQ over Kafka](./ADR-007-bullmq-over-kafka.md) for polyglot services

---

## Context

After finalizing the technology stack decisions for the polyglot architecture:
- **API Gateway:** NestJS (TypeScript)
- **CV Parser:** Spring Boot (Java)
- **Notification Service:** ASP.NET Core (C#)

We discovered that **BullMQ** (chosen in ADR-007) has a critical limitation: BullMQ is a Node.js-only library with no official clients for Java or C#.

## Decision

We will use **RabbitMQ** as the message broker for inter-service communication in our polyglot architecture.

**Note:** ADR-007 (BullMQ over Kafka) remains valid for **Node.js-only** projects. This ADR supersedes it specifically for **polyglot architectures**.

## Rationale

### Why RabbitMQ Won

1. **Native Polyglot Support:** Spring AMQP (Java) and RabbitMQ.Client (C#) are mature
2. **Built-in DLQ:** Critical for CV processing retries
3. **Excellent Management UI:** Visual queue monitoring at port 15672
4. **Flexible Routing:** Topic exchange for cv.* pattern matching
5. **Industry Standard:** AMQP 0-9-1 protocol

### Comparison Table

| Criterion | RabbitMQ | Redis Streams | BullMQ |
|-----------|----------|---------------|--------|
| Node.js Support | amqplib | ioredis | Native |
| Java/Spring | Spring AMQP | Jedis/Lettuce | None |
| C#/.NET | RabbitMQ.Client | StackExchange.Redis | None |
| DLQ | Built-in | Manual | Built-in |
| Management UI | Built-in | Redis Insight | Bull Board |

### Trade-offs Accepted

1. Additional Service: RabbitMQ adds ~200MB RAM to Docker
2. Learning Curve: AMQP concepts (~2-3 hours)

## Technical Design

### RabbitMQ Topology

Exchange: cv-events (type: topic)
Queues:
- cv-processing (routing key: cv.uploaded) -> CV Parser
- cv-notifications (routing key: cv.*) -> Notification Service
- cv-parsing-dlq (dead letter queue)

### Event Types

| Event | Routing Key | Producer | Consumer |
|-------|-------------|----------|----------|
| CV Uploaded | cv.uploaded | API Gateway | CV Parser |
| CV Parsed | cv.parsed | CV Parser | Notification |
| CV Failed | cv.failed | CV Parser | Notification |

### Client Libraries

| Service | Language | Library |
|---------|----------|---------|
| API Gateway | Node.js | amqplib |
| CV Parser | Java | spring-boot-starter-amqp |
| Notification | C# | RabbitMQ.Client |

### Docker Compose

rabbitmq:
  image: rabbitmq:3-management-alpine
  ports:
    - 5672:5672 (AMQP)
    - 15672:15672 (Management UI)
  environment:
    RABBITMQ_DEFAULT_USER: rabbitmq
    RABBITMQ_DEFAULT_PASS: rabbitmq

## Consequences

### Positive
- True polyglot support with native clients
- Production-ready features (DLQ, priority queues, message TTL)
- Excellent operational tooling (Management UI)
- Flexible routing patterns

### Negative
- Additional infrastructure service (~200MB RAM)
- AMQP learning curve (~2-3 hours)

## Related Decisions

- [ADR-006: Polyglot 3-Service Architecture](./ADR-006-hybrid-microservices.md)
- [ADR-007: BullMQ over Kafka](./ADR-007-bullmq-over-kafka.md) - Superseded for polyglot
- [ADR-008: Cloudflare R2 Storage](./ADR-008-cloudflare-r2.md)

---

**Last Updated:** 2026-02-18
**Next Review:** After Slice 3 implementation
