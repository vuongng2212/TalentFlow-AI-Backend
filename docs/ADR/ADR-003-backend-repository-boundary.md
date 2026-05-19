# ADR-003: Backend Repository Boundary

**Status:** Accepted  
**Decision date:** 2026-02-01  
**Last verified against code:** 2026-05-11  
**Scope:** backend repository boundaries

## Summary

The active workspace is a backend-only source tree. Frontend code is out of scope for this repository, so integration with any frontend remains external to this workspace.

## Decision

Keep the backend service code and runtime contract in this repository. Treat any frontend implementation as external, and communicate through API and event contracts rather than shared source.

## Code Evidence

- [docker-compose.yml](../../docker-compose.yml) defines the backend runtime and infrastructure services that this repository owns.
- [api-gateway/Dockerfile](../../api-gateway/Dockerfile), [cv-parser/Dockerfile](../../cv-parser/Dockerfile), and [notification/Dockerfile](../../notification/Dockerfile) package the active backend services.
- [docs/new/README.md](./README.md) is the canonical index for the backend decision set in this workspace.

## Consequences

- Cross-boundary changes should be handled as API contract changes, not shared source edits.
- OpenAPI-generated clients or a shared contract package remain the preferred type-sharing strategy.
- This repo stays focused on backend runtime and backend docs only.
- Frontend-specific implementation details must not be treated as source of truth here.

## Related ADRs

- [ADR-001: Prisma ORM](./ADR-001-prisma-orm.md)
- [ADR-002: Containerized Deployment Strategy](./ADR-002-deployment-strategy.md)
- [ADR-004: Hybrid Microservices](./ADR-004-hybrid-microservices.md)
