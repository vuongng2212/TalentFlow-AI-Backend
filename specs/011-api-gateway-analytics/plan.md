# Implementation Plan: API Gateway Analytics

**Branch**: `011-api-gateway-analytics` | **Date**: 2026-05-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/011-api-gateway-analytics/spec.md`

## Summary

Reverse-engineer the existing API Gateway analytics boundary into a migrated Spec Kit artifact set. The feature already exists in `api-gateway/src/analytics/**`; the plan captures the read-only recruitment overview, pipeline, trend, and top-job reporting surfaces.

## Technical Context

**Primary Runtime**: api-gateway  
**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: NestJS, Prisma, class-validator, Swagger, Jest, existing JWT auth and role guards  
**Storage**: PostgreSQL jobs, candidates, and applications  
**Testing**: `cd api-gateway && npm test`, focused analytics specs, `npm run build`  
**Target Platform**: Local development and Linux containers  
**Project Type**: Polyglot backend services  
**Performance Goals**: Keep analytics queries bounded by the existing Prisma aggregate and read paths  
**Constraints**: Preserve role restrictions, query bounds, and the current response shapes  
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
specs/011-api-gateway-analytics/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
api-gateway/
├── src/
│   ├── analytics/
│   │   ├── analytics.controller.ts
│   │   ├── analytics.service.ts
│   │   ├── analytics.module.ts
│   │   └── dto/
│   ├── applications/
│   ├── jobs/
│   ├── candidates/
│   ├── interviews/
│   ├── auth/
│   ├── prisma/
│   └── common/
├── prisma/
├── test/
└── package.json
```

**Structure Decision**: The API Gateway owns the feature entirely. The analytics HTTP boundary lives under `api-gateway/src/analytics/`, and it reads from the same Prisma models already used by jobs, candidates, and applications. No schema migration is required.

## Delivery Phases

### Phase 0: Discovery And Contract Check

- Confirm the controller exposes overview, pipeline, trends, and top-job routes.
- Confirm the analytics service derives its data from existing Prisma counts and group-bys.
- Confirm the controller is role-restricted to recruiter and admin access.

### Phase 1: Design And Data Shape

- Capture the overview, pipeline, trend, and top-job DTOs.
- Capture the default query windows and validation bounds for trends and top jobs.
- Capture the read-only access rules and the live-response shapes used by the service.

### Phase 2: Implementation By Service

- Keep all runtime code in `api-gateway/src/analytics/` and the shared auth/Prisma boundary.
- Preserve the current aggregation logic and stage enumeration.
- Avoid any schema changes because analytics are derived from existing Prisma data.

### Phase 3: Verification And Hardening

- Run the focused analytics unit tests first.
- Verify overview, pipeline, trend, and top-job output shapes.
- Confirm the build still passes after the analytics module is loaded.

## Validation Commands

- API Gateway analytics slice: `cd api-gateway && npm test -- analytics`
- API Gateway build: `cd api-gateway && npm run build`
- Full gateway test suite if needed: `cd api-gateway && npm test`

## Complexity Tracking

Use this table only if the plan needs a justified exception to the normal brownfield guardrails.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | No exception is required for this migrated analytics slice | The existing runtime implementation already fits the service boundary |