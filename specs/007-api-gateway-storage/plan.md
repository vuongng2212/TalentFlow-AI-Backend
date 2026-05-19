# Implementation Plan: API Gateway Storage

**Branch**: `007-api-gateway-storage` | **Date**: 2026-05-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-api-gateway-storage/spec.md`

## Summary

Reverse-engineer the existing API Gateway storage boundary into a migrated Spec Kit artifact set. The feature already exists in `api-gateway/src/storage/**`; the plan captures the upload, signed-URL, delete, and initialization rules that underpin the CV upload pipeline.

## Technical Context

**Primary Runtime**: api-gateway  
**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: NestJS, AWS SDK S3 client, signed URL presigner, ConfigService, Jest  
**Storage**: Object storage files plus bucket configuration  
**Testing**: `cd api-gateway && npm test`, focused storage specs, `npm run build`  
**Target Platform**: Local development and Linux containers  
**Project Type**: Polyglot backend services  
**Performance Goals**: Keep upload and signing operations bounded by the object-storage client and configured timeout  
**Constraints**: Preserve URL-building fallback order, production credential validation, and bucket-based references  
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
specs/007-api-gateway-storage/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
api-gateway/
├── src/
│   ├── storage/
│   │   ├── storage.module.ts
│   │   ├── storage.service.ts
│   │   └── index.ts
│   ├── applications/
│   ├── queue/
│   ├── common/
│   └── config/
├── prisma/
├── test/
└── package.json
```

**Structure Decision**: The API Gateway owns the feature entirely. The storage module is a global utility under `api-gateway/src/storage/`, applications consume it for file uploads, and queue producers depend on its bucket name. No schema migration is required.

## Delivery Phases

### Phase 0: Discovery And Contract Check

- Confirm the storage module is global and its service is the only implementation.
- Confirm upload URL construction uses the public URL, endpoint/account id, or localhost fallback in that order.
- Confirm production config checks are enforced during service construction.

### Phase 1: Design And Data Shape

- Capture the object upload, signed URL, delete, and bucket-name APIs.
- Capture the runtime config dependencies and production safety requirements.
- Capture the failure behavior so uploads and signing do not silently degrade.

### Phase 2: Implementation By Service

- Keep all runtime code in `api-gateway/src/storage/` and the shared config boundary.
- Preserve the current fallback order and signing behavior.
- Avoid any schema changes because persistence is external object storage, not Prisma.

### Phase 3: Verification And Hardening

- Run the focused storage unit tests first.
- Verify upload URL generation, signed URL creation, delete behavior, and production config guards.
- Confirm the build still passes after the storage module is loaded.

## Validation Commands

- API Gateway storage slice: `cd api-gateway && npm test -- storage`
- API Gateway build: `cd api-gateway && npm run build`
- Full gateway test suite if needed: `cd api-gateway && npm test`

## Complexity Tracking

Use this table only if the plan needs a justified exception to the normal brownfield guardrails.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | No exception is required for this migrated storage slice | The existing runtime implementation already fits the service boundary |