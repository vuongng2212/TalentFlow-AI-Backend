# Implementation Plan: API Gateway Redis

**Branch**: `009-api-gateway-redis` | **Date**: 2026-05-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/009-api-gateway-redis/spec.md`

## Summary

Reverse-engineer the existing API Gateway Redis boundary into a migrated Spec Kit artifact set. The feature already exists in `api-gateway/src/redis/**`; the plan captures the fail-fast initialization, helper operations, and shutdown behavior that support the gateway's auth and stateful workflows.

## Technical Context

**Primary Runtime**: api-gateway  
**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: NestJS, ioredis, ConfigService, Jest  
**Storage**: Redis key-value state  
**Testing**: `cd api-gateway && npm test`, focused redis specs, `npm run build`  
**Target Platform**: Local development and Linux containers  
**Project Type**: Polyglot backend services  
**Performance Goals**: Keep helper calls bounded by the Redis client and avoid additional abstraction overhead  
**Constraints**: Preserve existing Redis semantics, TTL behavior, and fail-fast construction on missing config  
**Scale/Scope**: One global utility module and its service tests; no migrations required

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Runtime code and current Spec Kit artifacts are authoritative.
- Frozen legacy sources are context only and must not be indexed as active requirements.
- Service boundaries must remain explicit.
- Cross-service changes require producer and consumer alignment.
- Schema changes in the gateway require schema and migration updates together.
- Validation, logging, and failure behavior must remain boundary-focused.

## Project Structure

### Documentation (this feature)

```text
specs/009-api-gateway-redis/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
api-gateway/
├── src/
│   ├── redis/
│   │   ├── redis.module.ts
│   │   ├── redis.service.ts
│   │   └── redis.service.spec.ts
│   ├── auth/
│   ├── queue/
│   ├── common/
│   └── config/
├── prisma/
├── test/
└── package.json
```

**Structure Decision**: The API Gateway owns the feature entirely. The Redis module is a global utility under `api-gateway/src/redis/`, auth and queue state rely on it, and no schema migration is required.

## Delivery Phases

### Phase 0: Discovery And Contract Check

- Confirm the Redis module is global and the service is the only implementation.
- Confirm the helper methods mirror the underlying ioredis semantics.
- Confirm construction fails fast when `REDIS_URL` is missing.

### Phase 1: Design And Data Shape

- Capture the key-value helper surface and shutdown behavior.
- Capture the TTL semantics and direct-client exposure expected by dependent services.
- Capture the operational constraints around transient state, not primary persistence.

### Phase 2: Implementation By Service

- Keep all runtime code in `api-gateway/src/redis/` and the shared config boundary.
- Preserve direct Redis return values and TTL behavior.
- Avoid any schema changes because persistence is external Redis, not Prisma.

### Phase 3: Verification And Hardening

- Run the focused redis unit tests first.
- Verify constructor fail-fast behavior, helper methods, ping, and shutdown.
- Confirm the build still passes after the redis module is loaded.

## Validation Commands

- API Gateway redis slice: `cd api-gateway && npm test -- redis`
- API Gateway build: `cd api-gateway && npm run build`
- Full gateway test suite if needed: `cd api-gateway && npm test`

## Complexity Tracking

Use this table only if the plan needs a justified exception to the normal brownfield guardrails.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | No exception is required for this migrated redis slice | The existing runtime implementation already fits the service boundary |