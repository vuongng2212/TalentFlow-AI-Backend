# Implementation Plan: API Gateway Interviews

**Branch**: `006-api-gateway-interviews` | **Date**: 2026-05-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-api-gateway-interviews/spec.md`

## Summary

Reverse-engineer the existing API Gateway interviews boundary into a migrated Spec Kit artifact set. The feature already exists in `api-gateway/src/interviews/**`; the plan captures the current scheduling workflow, the filtered browse surface, and the cancel-as-status behavior that the runtime implements today.

## Technical Context

**Primary Runtime**: api-gateway  
**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: NestJS, Prisma, class-validator, Swagger, Jest, existing JWT auth and role guards  
**Storage**: PostgreSQL interview records plus linked application and interviewer references  
**Testing**: `cd api-gateway && npm test`, focused interviews specs, `npm run build`  
**Target Platform**: Local development and Linux containers  
**Project Type**: Polyglot backend services  
**Performance Goals**: Keep interview browsing bounded by the existing Prisma pagination and relation-loading paths  
**Constraints**: Preserve future-date validation, interviewer existence checks, and cancellation-as-status behavior  
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
specs/006-api-gateway-interviews/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
api-gateway/
├── src/
│   ├── interviews/
│   │   ├── interviews.controller.ts
│   │   ├── interviews.service.ts
│   │   ├── interviews.module.ts
│   │   └── dto/
│   ├── applications/
│   ├── auth/
│   ├── prisma/
│   └── common/
├── prisma/
├── test/
└── package.json
```

**Structure Decision**: The API Gateway owns the feature entirely. The interviews HTTP boundary lives under `api-gateway/src/interviews/`, the application and interviewer references remain in Prisma, and auth/role enforcement comes from the existing gateway guard stack. No schema migration is required.

## Delivery Phases

### Phase 0: Discovery And Contract Check

- Confirm the controller exposes create, list, detail, update, and cancel routes.
- Confirm the DTOs enforce future scheduling and interviewer validation.
- Confirm cancellation is implemented as a status update rather than deletion.

### Phase 1: Design And Data Shape

- Capture the interview create/update/query/response DTOs.
- Capture the role rules for browse, create, update, and cancel operations.
- Capture the future-date and interviewer existence checks so they remain explicit.

### Phase 2: Implementation By Service

- Keep all runtime code in `api-gateway/src/interviews/` and the shared auth/Prisma boundary.
- Preserve the current include graph for linked application and interviewer data.
- Avoid any schema changes because persistence already exists in Prisma.

### Phase 3: Verification And Hardening

- Run the focused interviews unit tests first.
- Verify create, browse, update, and cancel authorization and validation paths.
- Confirm the build still passes after the interviews module wiring is loaded.

## Validation Commands

- API Gateway interviews slice: `cd api-gateway && npm test -- interviews`
- API Gateway build: `cd api-gateway && npm run build`
- Full gateway test suite if needed: `cd api-gateway && npm test`

## Complexity Tracking

Use this table only if the plan needs a justified exception to the normal brownfield guardrails.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | No exception is required for this migrated interviews slice | The existing runtime implementation already fits the service boundary |