# Implementation Plan: API Gateway Users

**Branch**: `002-api-gateway-users` | **Date**: 2026-05-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-api-gateway-users/spec.md`

## Summary

Reverse-engineer the existing API Gateway user-management boundary into a migrated Spec Kit artifact set. The feature is already implemented in `api-gateway/src/users/**`; the plan documents the current Prisma-backed list, profile, update, role-change, and soft-delete behavior with the gateway's existing auth and RBAC guards.

## Technical Context

**Primary Runtime**: api-gateway  
**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: NestJS, Prisma, class-validator, Swagger, Jest, existing JWT auth and role guards  
**Storage**: PostgreSQL user records  
**Testing**: `cd api-gateway && npm test`, focused users specs, `npm run build`  
**Target Platform**: Local development and Linux containers  
**Project Type**: Polyglot backend services  
**Performance Goals**: Keep user list and profile operations bounded by the existing Prisma query path and pagination limits  
**Constraints**: Preserve soft-delete filtering, enforce admin-only actions where already coded, and keep DTO validation strict at the HTTP boundary  
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
specs/002-api-gateway-users/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
api-gateway/
├── src/
│   ├── users/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.module.ts
│   │   └── dto/
│   ├── auth/
│   ├── prisma/
│   └── common/
├── prisma/
├── test/
└── package.json
```

**Structure Decision**: The API Gateway owns the feature entirely. The HTTP boundary lives under `api-gateway/src/users/`, the auth and role enforcement comes from the existing gateway guard stack, and Prisma remains the only persistence dependency. No schema migration is required.

## Delivery Phases

### Phase 0: Discovery And Contract Check

- Confirm the controller exposes list, profile, update, role-change, and soft-delete routes.
- Confirm the DTOs define the active query and update validation rules.
- Confirm the service filters deleted users and enforces the self-or-admin rule for profile updates.

### Phase 1: Design And Data Shape

- Capture the returned user and pagination shapes from the DTOs and service code.
- Capture the admin-only boundaries for list, role change, and delete actions.
- Capture the validation and not-found/forbidden behavior that the runtime already emits.

### Phase 2: Implementation By Service

- Keep all runtime code in `api-gateway/src/users/`, with auth and guard enforcement inherited from the gateway.
- Preserve the existing Prisma query path and soft-delete behavior.
- Avoid any schema or queue changes because this feature is HTTP and Prisma read/write only.

### Phase 3: Verification And Hardening

- Run the focused users unit tests first.
- Verify pagination, profile ownership, role change, and soft-delete handling.
- Confirm the build still passes after the users module wiring is loaded.

## Validation Commands

- API Gateway users slice: `cd api-gateway && npm test -- users`
- API Gateway build: `cd api-gateway && npm run build`
- Full gateway test suite if needed: `cd api-gateway && npm test`

## Complexity Tracking

Use this table only if the plan needs a justified exception to the normal brownfield guardrails.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | No exception is required for this migrated users slice | The existing runtime implementation already fits the service boundary |