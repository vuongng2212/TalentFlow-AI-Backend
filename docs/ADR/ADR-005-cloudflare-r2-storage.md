# ADR-005: Cloudflare R2 Storage

**Status:** Accepted  
**Decision date:** 2026-02-02  
**Last verified against code:** 2026-05-11  
**Scope:** api-gateway, cv-parser, local infrastructure

## Summary

Cloudflare R2 is the production object storage target, and MinIO is the local development equivalent. Both are accessed through an S3-compatible client contract.

## Decision

Use S3-compatible object storage with the following rule set:

- Production: Cloudflare R2
- Local development: MinIO
- Message payloads carry `bucket` and `fileKey`, not direct file URLs

This keeps the CV parsing flow SSRF-safe and storage-portable.

## Code Evidence

- [api-gateway/src/storage/storage.service.ts](../../api-gateway/src/storage/storage.service.ts) uploads and signs objects through an S3 client.
- [api-gateway/src/common/config/config.schema.ts](../../api-gateway/src/common/config/config.schema.ts) defines the R2 and storage environment contract.
- [cv-parser/src/main/java/com/talentflow/cvparser/shared/config/S3Config.java](../../cv-parser/src/main/java/com/talentflow/cvparser/shared/config/S3Config.java) configures the Java S3-compatible client.
- [cv-parser/src/main/java/com/talentflow/cvparser/storage/S3StorageService.java](../../cv-parser/src/main/java/com/talentflow/cvparser/storage/S3StorageService.java) downloads files using bucket plus object key.
- [docker-compose.yml](../../docker-compose.yml) provides the MinIO service used in local development.
- [cv-parser/src/main/java/com/talentflow/cvparser/shared/dto/CvUploadedEvent.java](../../cv-parser/src/main/java/com/talentflow/cvparser/shared/dto/CvUploadedEvent.java) documents the bucket + fileKey contract.

## Consequences

- The same object-storage contract works locally and in production.
- Queue payloads remain object-key based rather than URL based.
- Endpoint validation and bucket validation are part of the runtime contract, not optional documentation.

## Related ADRs

- [ADR-002: Containerized Deployment Strategy](./ADR-002-deployment-strategy.md)
- [ADR-004: Hybrid Microservices](./ADR-004-hybrid-microservices.md)
- [ADR-006: RabbitMQ Polyglot Messaging](./ADR-006-rabbitmq-polyglot-messaging.md)
