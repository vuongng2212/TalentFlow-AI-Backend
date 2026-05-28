# Implementation Plan: API Gateway Applications

**Branch**: `003-api-gateway-applications` | **Date**: 2026-05-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-api-gateway-applications/spec.md`

## Summary

Reverse-engineer the existing API Gateway applications boundary into a migrated Spec Kit artifact set. The feature already exists in `api-gateway/src/applications/**`; the plan captures the current HTTP application lifecycle, the CV upload pipeline, and the RabbitMQ contract that hands off to the parser service.

## Technical Context

**Primary Runtime**: api-gateway  
**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: NestJS, Prisma, class-validator, Swagger, StorageService, QueueService, Jest, existing JWT auth and role guards  
**Storage**: PostgreSQL application and candidate records, R2/MinIO file storage, RabbitMQ queue state  
**Testing**: `cd api-gateway && npm test`, focused applications specs, `npm run build`  
**Target Platform**: Local development and Linux containers  
**Project Type**: Polyglot backend services  
**Performance Goals**: Keep application reads and writes bounded by the existing Prisma and storage/queue operations, with file uploads capped at 10MB  
**Constraints**: Preserve `bucket + fileKey` queue payloads, validate file signatures and DTOs at the edge, and roll back upload failures safely  
**Scale/Scope**: One HTTP module plus storage/queue dependencies and unit tests; no schema migrations required

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
specs/003-api-gateway-applications/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
api-gateway/
├── src/
│   ├── applications/
│   │   ├── applications.controller.ts
│   │   ├── applications.service.ts
│   │   ├── applications.module.ts
│   │   └── dto/
│   ├── storage/
│   ├── queue/
│   ├── prisma/
│   ├── auth/
│   └── common/
├── prisma/
├── test/
└── package.json
```

**Structure Decision**: The API Gateway owns the feature end to end. The application HTTP routes live under `api-gateway/src/applications/`, the CV upload storage dependency lives under `api-gateway/src/storage/`, the queue producer lives under `api-gateway/src/queue/`, and auth/role enforcement comes from the existing gateway guard stack. No schema migration is required.

## Delivery Phases

### Phase 0: Discovery And Contract Check

- Confirm the controller exposes create, upload, list, detail, update, and withdraw routes.
- Confirm the file upload boundary uses the file-validation pipe, storage service, and queue producer.
- Confirm the queue contract uses `bucket + fileKey` rather than a raw file URL.

### Phase 1: Design And Data Shape

- Capture the application and upload DTOs from the controller and service code.
- Capture the role-based visibility and mutation rules for applicants, recruiters, interviewers, and admins.
- Capture the rollback and failure behavior for upload or queue publish errors.

### Phase 2: Implementation By Service

- Keep all runtime code in `api-gateway/src/applications/`, `api-gateway/src/storage/`, `api-gateway/src/queue/`, `api-gateway/src/common/`, and the auth guard stack.
- Preserve the current `cv.uploaded` topology and `bucket + fileKey` payload contract.
- Avoid any schema changes because persistence already exists in Prisma.

### Phase 3: Verification And Hardening

- Run the focused applications unit tests first.
- Verify upload validation, role-based browsing, and update/withdraw authorization.
- Confirm the build still passes after the applications module wiring is loaded.

## Validation Commands

- API Gateway applications slice: `cd api-gateway && npm test -- applications`
- API Gateway build: `cd api-gateway && npm run build`
- Full gateway test suite if needed: `cd api-gateway && npm test`

## Complexity Tracking

Use this table only if the plan needs a justified exception to the normal brownfield guardrails.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | No exception is required for this migrated applications slice | The existing runtime implementation already fits the service boundary |