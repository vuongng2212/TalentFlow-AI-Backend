# ADR-004: Hybrid Microservices

**Status:** Accepted  
**Decision date:** 2026-02-02  
**Last verified against code:** 2026-05-11  
**Scope:** api-gateway, cv-parser, notification

## Summary

The active backend architecture is a polyglot 3-service layout in a single repository: NestJS for the API gateway, Spring Boot for the CV parser, and NestJS for notification delivery.

## Decision

Use a hybrid microservice split with clear service ownership:

- API Gateway: NestJS, authentication, CRUD, upload, queue publishing
- CV Parser: Java/Spring Boot, RabbitMQ consumer, parsing, OCR, scoring
- Notification: NestJS, RabbitMQ consumer, email and status delivery

The services communicate asynchronously through RabbitMQ and share PostgreSQL plus S3-compatible object storage.

## Code Evidence

- [README.md](../../README.md) describes the active polyglot 3-service architecture.
- [docker-compose.yml](../../docker-compose.yml) wires the services and infrastructure together.
- [api-gateway/src/queue/queue.service.ts](../../api-gateway/src/queue/queue.service.ts) is the RabbitMQ publisher.
- [cv-parser/src/main/java/com/talentflow/cvparser/shared/config/RabbitMqConfig.java](../../cv-parser/src/main/java/com/talentflow/cvparser/shared/config/RabbitMqConfig.java) defines the Java RabbitMQ topology.
- [notification/src/rabbitmq/rabbitmq.service.ts](../../notification/src/rabbitmq/rabbitmq.service.ts) and [notification/src/rabbitmq/notification.consumer.ts](../../notification/src/rabbitmq/notification.consumer.ts) implement the NestJS consumer.
- [cv-parser/src/main/java/com/talentflow/cvparser/shared/config/S3Config.java](../../cv-parser/src/main/java/com/talentflow/cvparser/shared/config/S3Config.java) shows the S3-compatible storage contract.

## Consequences

- CPU-heavy CV parsing stays out of the Node.js event loop.
- Each service can evolve and scale independently.
- The service contract must stay explicit in ADR-005 and ADR-006.

## Related ADRs

- [ADR-002: Containerized Deployment Strategy](./ADR-002-deployment-strategy.md)
- [ADR-005: Cloudflare R2 Storage](./ADR-005-cloudflare-r2-storage.md)
- [ADR-006: RabbitMQ Polyglot Messaging](./ADR-006-rabbitmq-polyglot-messaging.md)
