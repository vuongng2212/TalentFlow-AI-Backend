# Repository Agent Boundaries

## Global Rules

- Runtime code, schema files, and checked-in service wiring are the source of truth.
- Frozen legacy sources in `_bmad-output/`, `tmp-document/`, and `archive/` are reference-only and must not be indexed as active documentation.
- Keep the active SDD tree clean: `.specify/` and `specs/` are the working documentation surfaces.
- Preserve the current CV upload contract rule: queue events use `bucket` plus `fileKey`, not direct file URLs.
- Cross-service changes must update producer and consumer together.

## API Gateway Boundary

- Own `api-gateway/`, including `src/`, `prisma/`, `test/`, and service-local configuration.
- Prefer NestJS, Prisma, Jest, and the existing HTTP, queue, and storage abstractions already in the gateway.
- Keep schema changes aligned with migrations and the gateway runtime contract.

## CV Parser Boundary

- Own `cv-parser/`, including `src/main/java/com/talentflow/cvparser/`, `src/test/java/com/talentflow/cvparser/`, and Maven configuration.
- Treat the parser as a RabbitMQ-driven worker, not an HTTP service.
- Keep parsing, extraction, OCR, and queue handling changes local to the Java service unless the contract requires coordination.

## Notification Boundary

- Own `notification/`, including `src/`, `prisma/`, and `test/`.
- Treat the service as a NestJS runtime shell with messaging, health, config, and persistence foundations.
- Do not claim feature completeness unless the delivery path actually exists in code.

## Shared Coordination Rules

- If a feature touches a queue message, update the producer interface and the consumer handling in the same change window.
- If a feature touches storage metadata, update the runtime contract and any validation around file keys, buckets, or MIME type checks.
- If a feature touches persistence, update the owning Prisma schema and follow the service's migration path.
- If a feature touches documentation, update only the active SDD artifacts and runtime guidance, not frozen legacy sources.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
