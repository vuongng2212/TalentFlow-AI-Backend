# ADR-002: Containerized Deployment Strategy

**Status:** Accepted  
**Decision date:** 2026-02-01  
**Last verified against code:** 2026-05-11  
**Scope:** api-gateway, cv-parser, notification, local infrastructure

## Summary

The active repository deployment contract is container-first. Local development runs through Docker Compose, and each service has its own Dockerfile and runtime config.

## Decision

Use Docker Compose for local infrastructure and service orchestration, with service containers for the API gateway, CV parser, and notification service. Keep cloud-provider choices out of the runtime contract unless they are encoded in active code or manifests.

## Code Evidence

- [docker-compose.yml](../../docker-compose.yml) defines PostgreSQL, Redis, RabbitMQ, and MinIO for local development.
- [api-gateway/Dockerfile](../../api-gateway/Dockerfile) packages the gateway service.
- [cv-parser/Dockerfile](../../cv-parser/Dockerfile) packages the Java parser service.
- [notification/Dockerfile](../../notification/Dockerfile) packages the notification service.
- [k8s/api-gateway](../../k8s/api-gateway) contains the current Kubernetes manifests for the gateway.

## Consequences

- Docker Compose is the reproducible local baseline.
- Service containers are the portable runtime unit.
- Deployment behavior should be environment-driven, not vendor-specific in docs.

## Related ADRs

- [ADR-004: Hybrid Microservices](./ADR-004-hybrid-microservices.md)
- [ADR-005: Cloudflare R2 Storage](./ADR-005-cloudflare-r2-storage.md)
- [ADR-006: RabbitMQ Polyglot Messaging](./ADR-006-rabbitmq-polyglot-messaging.md)
