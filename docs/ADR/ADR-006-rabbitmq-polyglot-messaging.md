# ADR-006: RabbitMQ Polyglot Messaging

**Status:** Accepted  
**Decision date:** 2026-02-18  
**Last verified against code:** 2026-05-11  
**Scope:** api-gateway, cv-parser, notification

## Summary

RabbitMQ is the active inter-service broker for the polyglot backend. It is used by the API gateway, the Java CV parser, and the NestJS notification service.

## Decision

Use RabbitMQ as the message broker and keep the routing contract explicit in code and ADRs. The active topology is:

- Exchange: `talentflow.events`
- CV parser queue: `cv_parser.jobs`
- CV parser DLQ: `cv_parser.jobs.dlq`
- Notification queue: `notification_queue` by default, configurable via `RABBITMQ_QUEUE`
- Notification DLQ: `notification.dlq`

Routing keys in active code:

- `cv.uploaded`
- `cv.parsed`
- `cv.failed`
- `application.created`
- `notification.send`

The CV upload payload must use `bucket` plus `fileKey`, not `fileUrl`.

## Code Evidence

- [api-gateway/src/queue/queue.service.ts](../../api-gateway/src/queue/queue.service.ts) publishes RabbitMQ events from the gateway.
- [api-gateway/src/queue/constants/queue.constants.ts](../../api-gateway/src/queue/constants/queue.constants.ts) defines the shared exchange and routing keys.
- [api-gateway/src/queue/interfaces/cv-uploaded-event.interface.ts](../../api-gateway/src/queue/interfaces/cv-uploaded-event.interface.ts) shows the bucket + fileKey payload contract.
- [cv-parser/src/main/java/com/talentflow/cvparser/shared/config/RabbitMqConfig.java](../../cv-parser/src/main/java/com/talentflow/cvparser/shared/config/RabbitMqConfig.java) defines the Java exchange, queue, and DLQ setup.
- [cv-parser/src/main/java/com/talentflow/cvparser/shared/dto/CvUploadedEvent.java](../../cv-parser/src/main/java/com/talentflow/cvparser/shared/dto/CvUploadedEvent.java) mirrors the upload event contract.
- [notification/src/rabbitmq/rabbitmq.service.ts](../../notification/src/rabbitmq/rabbitmq.service.ts) defines the runtime RabbitMQ queue and exchange defaults.
- [notification/src/rabbitmq/notification.consumer.ts](../../notification/src/rabbitmq/notification.consumer.ts) binds the notification consumer to the active routing keys.

## Consequences

- Polyglot services can communicate through a broker with native clients in each runtime.
- DLQ handling is part of the runtime contract.
- Queue names and routing keys must stay aligned between producer and consumer code.
- RabbitMQ is the source of truth for inter-service messaging in this repository.

## Related ADRs

- [ADR-004: Hybrid Microservices](./ADR-004-hybrid-microservices.md)
- [ADR-005: Cloudflare R2 Storage](./ADR-005-cloudflare-r2-storage.md)
