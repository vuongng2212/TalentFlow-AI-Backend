# ADR-009: Use RabbitMQ for Polyglot Inter-Service Communication

**Status:** Accepted
**Date:** 2026-02-18
**Updated:** 2026-02-25
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

```
Exchange: talentflow.events (type: topic, durable: true)

Queues:
┌─────────────────────────────────────────────────────────────────┐
│ cv_parser.jobs                                                   │
│   - Binding: cv.uploaded                                         │
│   - Consumer: CV Parser Service (Spring Boot)                   │
│   - DLQ: cv_parser.jobs.dlq                                      │
│   - TTL: 24 hours                                                │
├─────────────────────────────────────────────────────────────────┤
│ notification.events                                              │
│   - Bindings: cv.parsed, cv.failed, application.created,        │
│               notification.send                                  │
│   - Consumer: Notification Service (ASP.NET Core)               │
│   - DLQ: notification.events.dlq                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Event Types

| Event | Routing Key | Producer | Consumer | Description |
|-------|-------------|----------|----------|-------------|
| CV Uploaded | `cv.uploaded` | API Gateway | CV Parser | Trigger CV processing |
| CV Parsed | `cv.parsed` | CV Parser | Notification | CV processed successfully |
| CV Failed | `cv.failed` | CV Parser | Notification | CV processing failed |
| Application Created | `application.created` | API Gateway | Notification | New application submitted |
| Send Notification | `notification.send` | API Gateway | Notification | Direct notification request |

### Client Libraries

| Service | Language | Library | Queue |
|---------|----------|---------|-------|
| API Gateway | Node.js | amqplib | Producer only |
| CV Parser | Java | spring-boot-starter-amqp | cv_parser.jobs |
| Notification | C# | RabbitMQ.Client | notification.events |

### Message Payload Examples

**CvUploadedEvent (API Gateway → CV Parser):**
```json
{
  "candidateId": "uuid",
  "applicationId": "uuid",
  "jobId": "uuid",
  "bucket": "talentflow-cvs",
  "fileKey": "cvs/2026/02/uuid.pdf",
  "mimeType": "application/pdf",
  "uploadedAt": "2026-02-25T10:30:00Z"
}
```

> **SECURITY NOTE:** Do NOT include `fileUrl` in message. Consumer MUST use S3 client with credentials to download file using `bucket` + `fileKey`. This prevents SSRF attacks.

**CvParsedEvent (CV Parser → Notification):**
```json
{
  "candidateId": "uuid",
  "applicationId": "uuid",
  "jobId": "uuid",
  "aiScore": 85,
  "parsedData": {
    "fullName": "Nguyen Van A",
    "email": "nguyen.van.a@example.com",
    "skills": ["Java", "Spring Boot"]
  },
  "scoringReasoning": "Strong skills match...",
  "parsedAt": "2026-02-25T10:30:15Z"
}
```

**CvFailedEvent (CV Parser → Notification):**
```json
{
  "candidateId": "uuid",
  "applicationId": "uuid",
  "jobId": "uuid",
  "errorCode": "PARSING_FAILED",
  "errorMessage": "Unable to extract text from PDF",
  "retryable": false,
  "failedAt": "2026-02-25T10:30:15Z"
}
```

### Docker Compose

```yaml
rabbitmq:
  image: rabbitmq:3-management-alpine
  ports:
    - "5672:5672"   # AMQP
    - "15672:15672" # Management UI
  environment:
    RABBITMQ_DEFAULT_USER: rabbitmq
    RABBITMQ_DEFAULT_PASS: rabbitmq
  volumes:
    - rabbitmq_data:/var/lib/rabbitmq
```

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

**Last Updated:** 2026-02-25
**Next Review:** After CV Parser implementation
