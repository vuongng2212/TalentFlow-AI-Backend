# Implementation Plan: Socket.IO Handshake & Authentication

**Branch**: `015-socketio-jwt-handshake` | **Date**: 2026-05-25 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/015-socketio-jwt-handshake/spec.md`

## Summary

Implement the secure real-time connection handshake for the Notification service. The smallest safe path is to align the Notification WebSocket authentication path with the existing API Gateway access token contract, then harden and verify the Socket.IO handshake behavior already present under `notification/src/notification/` and `notification/src/auth/`.

This is primarily Notification service WebSocket/auth work. API Gateway is inspected for JWT contract truth and should only change if implementation discovers the runtime token contract cannot be consumed safely as-is.

## Technical Context

**Primary Runtime**: notification, with API Gateway contract inspection  
**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: Notification NestJS 10, `@nestjs/websockets`, `@nestjs/platform-socket.io`, `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, Socket.IO 4; API Gateway NestJS 11 JWT issuer for contract reference  
**Storage**: N/A for this feature; connection state is in Socket.IO runtime memory  
**Testing**: Notification `npm test`, targeted gateway/guard specs, optional `npm run test:e2e`, `npm run lint`, `npm run build`  
**Target Platform**: Local dev and Linux containers  
**Project Type**: Polyglot backend services  
**Performance Goals**: Authenticated handshake should complete within normal Socket.IO connection timing and add no persistence or queue dependency; every invalid handshake test case must reject deterministically.  
**Constraints**: Must validate the same API Gateway access token, support `handshake.auth.token` and `Authorization: Bearer <token>`, reject query-string-only tokens, require `sub/email/role`, avoid token logging, and keep scope in `notification/` unless contract alignment requires API Gateway edits.  
**Scale/Scope**: One Notification WebSocket/auth slice, no migrations, one WebSocket handshake contract, focused unit/e2e coverage.

## Constitution Check

_GATE: Passed before Phase 0 research. Re-check after Phase 1 design._

- Runtime code and current Spec Kit artifacts are authoritative: PASS. Plan is based on live `notification/src/**`, `api-gateway/src/auth/**`, and clarified spec.
- Frozen legacy sources are context only and must not be indexed as active requirements: PASS. No frozen legacy source is used.
- Service boundaries must remain explicit: PASS. Notification owns WebSocket authentication; API Gateway is contract producer only.
- Cross-service changes require producer and consumer alignment: PASS with note. The preferred plan avoids API Gateway code changes; if contract drift forces producer changes, both services must be planned in the same change window.
- Schema changes in the gateway require schema and migration updates together: PASS. No schema change is expected.
- Validation, logging, and failure behavior must remain boundary-focused: PASS. Handshake failures are rejected at the WebSocket edge and logs must not expose tokens.

## Project Structure

### Documentation (this feature)

```text
specs/015-socketio-jwt-handshake/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── websocket-handshake.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
notification/
├── src/
│   ├── auth/
│   │   ├── jwt.strategy.ts
│   │   ├── ws-jwt.guard.ts
│   │   └── auth.module.ts
│   ├── config/
│   │   ├── jwt.config.ts
│   │   └── validation.schema.ts
│   └── notification/
│       ├── notification.gateway.ts
│       └── notification.module.ts
├── test/
└── package.json

api-gateway/
└── src/
    ├── auth/
    │   ├── auth.service.ts
    │   ├── constants/auth.constants.ts
    │   └── strategies/jwt.strategy.ts
    └── common/config/config.schema.ts
```

**Structure Decision**: The implementation belongs in `notification/src/auth/`, `notification/src/config/`, and `notification/src/notification/`, with tests beside existing Notification specs. API Gateway files are reference points for the access token contract and should only be edited if a coordinated contract correction is required.

### Ownership Check

- Notification owns the Socket.IO namespace, handshake middleware, socket user identity, and room binding.
- API Gateway owns access token issuance and validation for HTTP users.
- No CV Parser, storage, queue, Prisma, or email delivery work is in scope.

## Delivery Phases

### Phase 0: Discovery And Contract Check

- Confirm live Notification Socket.IO behavior:
  - `NotificationGateway` registers namespace `/notifications`.
  - `afterInit` uses Socket.IO middleware to authenticate before connection.
  - Token extraction already checks `handshake.auth.token` before `Authorization`.
  - Query-string token is not read by current guard tests.
- Confirm live API Gateway JWT behavior:
  - API Gateway signs access tokens with `JWT_ACCESS_SECRET`.
  - Access token payload is `{ sub, email, role }`.
  - Access token expiration is currently 15 minutes.
  - Existing API Gateway JWT strategy validates `JWT_ACCESS_SECRET` and does not require `issuer/audience`.
- Contract gap to resolve in implementation:
  - Notification currently expects `jwt.secret`, `jwt.issuer`, and `jwt.audience` from `JWT_SECRET/JWT_ISSUER/JWT_AUDIENCE`.
  - Plan should align Notification to `JWT_ACCESS_SECRET` semantics unless product decides to introduce issuer/audience in API Gateway too.

### Phase 1: Design And Data Shape

- Use `research.md` decisions as the contract baseline.
- Use `data-model.md` for the connected socket identity and handshake state rules.
- Use `contracts/websocket-handshake.md` for accepted token locations, rejected token locations, and failure expectations.
- Configuration expectation:
  - Notification must have validated runtime config that can verify the API Gateway access token secret.
  - `.env.example` should name the final env variable consistently with the chosen contract.
- Failure behavior:
  - Missing, invalid, expired, malformed, query-string-only, and missing-identity-field attempts fail the handshake.
  - Failure output must not include raw token values.

### Phase 2: Implementation By Service

- Notification:
  - Align JWT verification strategy and gateway middleware with API Gateway access token contract.
  - Keep supported token order: `handshake.auth.token`, then `Authorization: Bearer <token>`.
  - Keep query-string token unsupported.
  - Ensure accepted sockets receive user identity `{ userId, email, role }` derived from token `sub/email/role`.
  - Ensure user-specific room binding is derived from authenticated identity only.
  - Add or update focused tests for valid auth token, Authorization fallback, missing token, invalid token, expired token, malformed token, missing `sub/email/role`, query-string-only rejection, and authenticated room join.
- API Gateway:
  - No implementation change planned.
  - Add/update a contract-facing test only if needed to lock the access token payload/secret expected by Notification.

### Phase 3: Verification And Hardening

- Run the narrowest tests first:
  - `cd notification && npm test -- notification.gateway.spec.ts ws-jwt.guard.spec.ts`
- Broaden after the handshake slice passes:
  - `cd notification && npm test`
  - `cd notification && npm run lint`
  - `cd notification && npm run build`
- If API Gateway contract tests are touched:
  - `cd api-gateway && npm test -- auth.service.spec.ts jwt.strategy.spec.ts`
- Manual smoke validation should include one valid API Gateway access token and rejected missing/invalid/query-string-only attempts.

## Validation Commands

- Notification focused: `cd notification && npm test -- notification.gateway.spec.ts ws-jwt.guard.spec.ts`
- Notification full: `cd notification && npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`
- API Gateway contract only if touched: `cd api-gateway && npm test -- auth.service.spec.ts jwt.strategy.spec.ts`

## Local Verification Strategy

- Start with Notification unit tests around token extraction and gateway middleware.
- Add a Socket.IO e2e-style verification only if unit coverage cannot prove handshake acceptance/rejection through the Nest gateway lifecycle.
- Do not run broad cross-service suites until the local Notification contract is green.
- Confirm logs mask PII and never print raw tokens in success or failure paths.

## Complexity Tracking

No complexity exception is planned.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
