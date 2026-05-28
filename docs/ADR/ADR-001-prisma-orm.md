# ADR-001: Prisma ORM

**Status:** Accepted  
**Decision date:** 2026-02-01  
**Last verified against code:** 2026-05-11  
**Scope:** api-gateway, notification

## Summary

Prisma is the active ORM source of truth for the backend services that persist to PostgreSQL.

## Decision

Use Prisma as the ORM layer and keep schema-first models in `schema.prisma`. Service code should depend on generated Prisma clients and service-local Prisma wrappers.

## Code Evidence

- [api-gateway/prisma/schema.prisma](../../api-gateway/prisma/schema.prisma) defines the main business schema.
- [notification/prisma/schema.prisma](../../notification/prisma/schema.prisma) defines the notification persistence schema.
- [api-gateway/src/prisma](../../api-gateway/src/prisma) contains the Prisma service wiring.
- [notification/prisma/prisma.module.ts](../../notification/prisma/prisma.module.ts) and [notification/prisma/prisma.service.ts](../../notification/prisma/prisma.service.ts) provide the notification Prisma integration.

## Consequences

- Schema changes must be made in Prisma first, then migrated.
- Use generated types instead of handwritten database models.
- No active TypeORM or Sequelize path exists in the current codebase.

## Related ADRs

- [ADR-003: Backend Repository Boundary](./ADR-003-backend-repository-boundary.md)
- [ADR-004: Hybrid Microservices](./ADR-004-hybrid-microservices.md)
- [ADR-005: Cloudflare R2 Storage](./ADR-005-cloudflare-r2-storage.md)
