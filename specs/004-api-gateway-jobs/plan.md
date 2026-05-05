# Implementation Plan: API Gateway Jobs

**Branch**: `004-api-gateway-jobs` | **Date**: 2026-05-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-api-gateway-jobs/spec.md`

## Summary

Reverse-engineer the existing API Gateway jobs boundary into a migrated Spec Kit artifact set. The feature already exists in `api-gateway/src/jobs/**`; the plan captures the public browse surface, recruiter/admin write surface, and the structured requirements JSON used by application flows.

## Technical Context

**Primary Runtime**: api-gateway  
**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: NestJS, Prisma, class-validator, Swagger, Jest, existing JWT auth and role guards  
**Storage**: PostgreSQL job records  
**Testing**: `cd api-gateway && npm test`, focused jobs specs, `npm run build`  
**Target Platform**: Local development and Linux containers  
**Project Type**: Polyglot backend services  
**Performance Goals**: Keep job browsing bounded by the existing Prisma pagination and filter paths  
**Constraints**: Preserve soft-delete filtering, owner/admin write checks, and structured requirements JSON handling  
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
specs/004-api-gateway-jobs/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
api-gateway/
├── src/
│   ├── jobs/
│   │   ├── jobs.controller.ts
│   │   ├── jobs.service.ts
│   │   ├── jobs.module.ts
│   │   └── dto/
│   ├── applications/
│   ├── auth/
│   ├── prisma/
│   └── common/
├── prisma/
├── test/
└── package.json
```

**Structure Decision**: The API Gateway owns the feature entirely. The jobs HTTP boundary lives under `api-gateway/src/jobs/`, applications depend on job availability but do not own it, and Prisma remains the only persistence dependency. No schema migration is required.

## Delivery Phases

### Phase 0: Discovery And Contract Check

- Confirm the controller exposes create, list, detail, update, and soft-delete routes.
- Confirm the query DTO carries public browse filters and pagination.
- Confirm the service uses soft-delete filtering and owner/admin authorization checks.

### Phase 1: Design And Data Shape

- Capture the job create/update/query/response DTOs and structured requirements shape.
- Capture the public read path and the recruiter/admin ownership rules.
- Capture the JSON requirements mapping and the delete-as-soft-delete behavior.

### Phase 2: Implementation By Service

- Keep all runtime code in `api-gateway/src/jobs/` and the shared auth/Prisma boundary.
- Preserve the current `requirements` JSON mapping used for skills and experience.
- Avoid any schema changes because persistence already exists in Prisma.

### Phase 3: Verification And Hardening

- Run the focused jobs unit tests first.
- Verify public listing, search/filter behavior, and owner/admin write checks.
- Confirm the build still passes after the jobs module wiring is loaded.

## Validation Commands

- API Gateway jobs slice: `cd api-gateway && npm test -- jobs`
- API Gateway build: `cd api-gateway && npm run build`
- Full gateway test suite if needed: `cd api-gateway && npm test`

## Complexity Tracking

Use this table only if the plan needs a justified exception to the normal brownfield guardrails.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | No exception is required for this migrated jobs slice | The existing runtime implementation already fits the service boundary |