# Implementation Plan: API Gateway Candidates

**Branch**: `005-api-gateway-candidates` | **Date**: 2026-05-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-api-gateway-candidates/spec.md`

## Summary

Reverse-engineer the existing API Gateway candidate boundary into a migrated Spec Kit artifact set. The feature already exists in `api-gateway/src/candidates/**`; the plan captures the searchable list, candidate detail with applications, update flow, and admin-only hard delete behavior.

## Technical Context

**Primary Runtime**: api-gateway  
**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: NestJS, Prisma, class-validator, Swagger, Jest, existing JWT auth and role guards  
**Storage**: PostgreSQL candidate records plus related application rows  
**Testing**: `cd api-gateway && npm test`, focused candidates specs, `npm run build`  
**Target Platform**: Local development and Linux containers  
**Project Type**: Polyglot backend services  
**Performance Goals**: Keep candidate browsing bounded by the existing Prisma pagination and search paths  
**Constraints**: Preserve search and pagination semantics, hard-delete behavior, and role-based access control  
**Scale/Scope**: One HTTP module with controller, service, DTOs, and unit tests; no migrations required

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
specs/005-api-gateway-candidates/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
api-gateway/
├── src/
│   ├── candidates/
│   │   ├── candidates.controller.ts
│   │   ├── candidates.service.ts
│   │   ├── candidates.module.ts
│   │   └── dto/
│   ├── applications/
│   ├── auth/
│   ├── prisma/
│   └── common/
├── prisma/
├── test/
└── package.json
```

**Structure Decision**: The API Gateway owns the feature entirely. The candidates HTTP boundary lives under `api-gateway/src/candidates/`, the application history relationship is owned by Prisma, and auth/role enforcement comes from the existing gateway guard stack. No schema migration is required.

## Delivery Phases

### Phase 0: Discovery And Contract Check

- Confirm the controller exposes list, detail, update, and delete routes.
- Confirm candidate detail includes related application history and job summaries.
- Confirm delete is a hard delete that cascades to related applications.

### Phase 1: Design And Data Shape

- Capture the candidate list, detail, update, and response DTOs.
- Capture the role rules for browse, update, and delete operations.
- Capture the hard-delete and cascade-delete behavior so it is not lost in migration.

### Phase 2: Implementation By Service

- Keep all runtime code in `api-gateway/src/candidates/` and the shared auth/Prisma boundary.
- Preserve the current search, pagination, and application-history query behavior.
- Avoid any schema changes because persistence already exists in Prisma.

### Phase 3: Verification And Hardening

- Run the focused candidates unit tests first.
- Verify browse, update, and delete authorization paths.
- Confirm the build still passes after the candidates module wiring is loaded.

## Validation Commands

- API Gateway candidates slice: `cd api-gateway && npm test -- candidates`
- API Gateway build: `cd api-gateway && npm run build`
- Full gateway test suite if needed: `cd api-gateway && npm test`

## Complexity Tracking

Use this table only if the plan needs a justified exception to the normal brownfield guardrails.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | No exception is required for this migrated candidates slice | The existing runtime implementation already fits the service boundary |