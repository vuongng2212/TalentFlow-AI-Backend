# Implementation Plan: API Gateway Auth

**Branch**: `001-api-gateway-auth` | **Date**: 2026-05-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-api-gateway-auth/spec.md`

## Summary

Reverse-engineer the existing API Gateway auth boundary into a migrated Spec Kit artifact set. The feature is already implemented in `api-gateway/src/auth/**`; the plan records the runtime shape, the boundary decisions, and the narrowest verification path for the existing cookie-based session flow.

## Technical Context

**Primary Runtime**: api-gateway  
**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: NestJS, Prisma, Passport, JwtService, Redis, Swagger, class-validator, Jest  
**Storage**: PostgreSQL user records plus Redis session and blacklist state  
**Testing**: `cd api-gateway && npm test`, focused auth specs, `npm run build`  
**Target Platform**: Local development and Linux containers  
**Project Type**: Polyglot backend services  
**Performance Goals**: Keep auth checks synchronous at the HTTP boundary and avoid blocking operations beyond Redis/JWT calls  
**Constraints**: Cookie-based auth must preserve existing cookie names, refresh tokens must be validated against Redis, and deleted users must not authenticate  
**Scale/Scope**: One HTTP module plus shared guards, strategies, DTOs, constants, Redis session state, and auth-related tests

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
specs/001-api-gateway-auth/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
api-gateway/
├── src/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.module.ts
│   │   ├── constants/
│   │   ├── decorators/
│   │   ├── dto/
│   │   ├── guards/
│   │   └── strategies/
│   ├── users/
│   ├── redis/
│   ├── common/
│   │   ├── config/
│   │   └── services/
│   └── app.module.ts
├── prisma/
├── test/
└── package.json
```

**Structure Decision**: The API Gateway owns the auth feature end to end. The HTTP contract lives under `api-gateway/src/auth/`, the user lookup dependency lives under `api-gateway/src/users/`, Redis session state lives under `api-gateway/src/redis/`, and global guard wiring remains in `api-gateway/src/app.module.ts`. No Prisma migration is required for this slice.

## Delivery Phases

### Phase 0: Discovery And Contract Check

- Confirm the auth controller owns signup, login, refresh, profile, and logout routes.
- Confirm the token and cookie contract is defined by the existing auth constants and DTOs.
- Confirm Redis is the only runtime state store used for refresh tokens, lockout counters, and token blacklisting.

### Phase 1: Design And Data Shape

- Capture the request and response shapes from the DTOs and controller methods.
- Capture the operational rules for cookie transport, refresh validation, lockout threshold, and audit logging.
- Capture the environment variables required to sign and verify JWTs.

### Phase 2: Implementation By Service

- Keep all runtime code in `api-gateway/src/auth/`, `api-gateway/src/users/`, `api-gateway/src/redis/`, and `api-gateway/src/common/`.
- Preserve the existing module wiring in `api-gateway/src/app.module.ts` and `api-gateway/src/auth/auth.module.ts`.
- Avoid any schema or queue changes because this feature is HTTP and Redis only.

### Phase 3: Verification And Hardening

- Run the focused auth unit tests first.
- Verify JWT strategy behavior, refresh-token validation, and login lockout paths.
- Confirm the build still passes after the auth module wiring is loaded.

## Validation Commands

- API Gateway auth slice: `cd api-gateway && npm test -- auth`
- API Gateway build: `cd api-gateway && npm run build`
- Full gateway test suite if needed: `cd api-gateway && npm test`

## Complexity Tracking

Use this table only if the plan needs a justified exception to the normal brownfield guardrails.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | No exception is required for this migrated auth slice | The existing runtime implementation already fits the service boundary |
