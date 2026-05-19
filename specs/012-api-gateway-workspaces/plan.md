# Implementation Plan: API Gateway Workspaces

**Branch**: `012-api-gateway-workspaces` | **Date**: 2026-05-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/012-api-gateway-workspaces/spec.md`

## Summary

Reverse-engineer the existing API Gateway workspaces boundary into a migrated Spec Kit artifact set. The feature already exists in `api-gateway/src/workspaces/**`; the plan captures workspace creation, membership management, and active-member listing on top of the current Prisma-backed model.

## Technical Context

**Primary Runtime**: api-gateway  
**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: NestJS, Prisma, class-validator, Swagger, Jest, existing JWT auth and role guards  
**Storage**: PostgreSQL workspace, workspace-member, and user tables  
**Testing**: `cd api-gateway && npm test`, focused workspace specs, `npm run build`  
**Target Platform**: Local development and Linux containers  
**Project Type**: Polyglot backend services  
**Performance Goals**: Keep workspace membership reads and writes bounded by the existing Prisma transaction and query paths  
**Constraints**: Preserve role restrictions, business entitlement enforcement, member-cap checks, and the current response shapes  
**Scale/Scope**: One HTTP module with controller, service, DTOs, and unit tests; no migrations required

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- Runtime code and current Spec Kit artifacts are authoritative.
- Frozen legacy sources are context only and must not be indexed as active requirements.
- Service boundaries must remain explicit.
- Cross-service changes require producer and consumer alignment.
- Schema changes in the gateway require schema and migration updates together.
- Validation, logging, and failure behavior must remain boundary-focused.

## Project Structure

### Documentation (this feature)

```text
specs/012-api-gateway-workspaces/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
api-gateway/
├── src/
│   ├── workspaces/
│   │   ├── workspaces.controller.ts
│   │   ├── workspaces.service.ts
│   │   ├── workspaces.module.ts
│   │   └── dto/
│   ├── auth/
│   ├── prisma/
│   └── common/
├── prisma/
├── test/
└── package.json
```

**Structure Decision**: The API Gateway owns the feature entirely. The workspaces HTTP boundary lives under `api-gateway/src/workspaces/`, and it reads and writes the same Prisma models already used by the rest of the gateway. No schema migration is required.

## Delivery Phases

### Phase 0: Discovery And Contract Check

- Confirm the controller exposes create, add-member, and list-member routes.
- Confirm the service applies the business entitlement proxy, membership access checks, and max-active-member cap.
- Confirm the controller is role-restricted to recruiter and admin access.

### Phase 1: Design And Data Shape

- Capture the workspace create and member invite DTOs.
- Capture the owner auto-membership behavior and active-member listing shape.
- Capture the live config fallback for the workspace member cap.

### Phase 2: Implementation By Service

- Keep all runtime code in `api-gateway/src/workspaces/` and the shared auth/Prisma boundary.
- Preserve the current transactional create path and membership reactivation logic.
- Avoid any schema changes because workspaces are derived from existing Prisma data.

### Phase 3: Verification And Hardening

- Run the focused workspace unit tests first.
- Verify create, invite, reactivation, cap enforcement, and list-member output shapes.
- Confirm the build still passes after the workspaces module is loaded.

## Validation Commands

- API Gateway workspaces slice: `cd api-gateway && npm test -- workspaces`
- API Gateway build: `cd api-gateway && npm run build`
- Full gateway test suite if needed: `cd api-gateway && npm test`

## Complexity Tracking

Use this table only if the plan needs a justified exception to the normal brownfield guardrails.

| Violation | Why Needed                                                  | Simpler Alternative Rejected Because                                  |
| --------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| None      | No exception is required for this migrated workspaces slice | The existing runtime implementation already fits the service boundary |
