# Tasks: API Gateway Auth

**Input**: Design documents from `/specs/001-api-gateway-auth/`
**Prerequisites**: plan.md, spec.md

**Organization**: Tasks are grouped by service boundary and then by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or has no dependency on another task
- **[Story]**: Which user story the task belongs to, such as US1, US2, or US3
- Always include exact file paths in the description

## Path Conventions

- API Gateway: `api-gateway/src/`, `api-gateway/prisma/`, `api-gateway/test/`
- Shared planning docs: `specs/001-api-gateway-auth/`

## Phase 1: Setup And Contract Lock

**Purpose**: Confirm runtime ownership, lock the contract surface, and record the existing HTTP auth behavior.

- [x] T001 Review the current runtime entrypoint and affected auth files for the feature in `api-gateway/src/app.module.ts`, `api-gateway/src/auth/auth.module.ts`, and `api-gateway/src/auth/**`
- [x] T002 [P] Capture the auth HTTP contract in `specs/001-api-gateway-auth/spec.md` from `api-gateway/src/auth/auth.controller.ts` and `api-gateway/src/auth/dto/*.ts`
- [x] T003 [P] Record validation and config requirements in `api-gateway/src/common/config/config.schema.ts`, `api-gateway/src/auth/constants/auth.constants.ts`, and `api-gateway/src/auth/constants/security.constants.ts`

---

## Phase 2: Foundational Work

**Purpose**: Build the shared prerequisites that block all user stories for this feature.

- [x] T004 Wire `api-gateway/src/auth/auth.module.ts` with `UsersModule`, `PassportModule`, `JwtModule`, `JwtStrategy`, `JwtRefreshStrategy`, and `SecurityAuditService`
- [x] T005 [P] Define the request and response DTOs in `api-gateway/src/auth/dto/signup.dto.ts`, `api-gateway/src/auth/dto/login.dto.ts`, and `api-gateway/src/auth/dto/auth-response.dto.ts`
- [x] T006 [P] Establish cookie names, JWT expirations, and lockout constants in `api-gateway/src/auth/constants/auth.constants.ts` and `api-gateway/src/auth/constants/security.constants.ts`
- [x] T007 Keep the minimum persistence wiring in `api-gateway/src/redis/redis.service.ts` and `api-gateway/src/users/users.service.ts`

**Checkpoint**: The auth boundary is wired and user story work can be validated independently.

---

## Phase 3: User Story 1 - Register And Sign In (Priority: P1)

**Goal**: Create an account and authenticate with cookie-based login.

**Independent Test**: `POST /auth/signup` and `POST /auth/login` return the expected profile and set the access and refresh cookies.

### Tests for User Story 1

- [x] T008 [P] [US1] Cover signup and login controller behavior in `api-gateway/src/auth/auth.controller.spec.ts`
- [x] T009 [P] [US1] Cover duplicate-email rejection, password hashing, login success, invalid credentials, and failed-login counters in `api-gateway/src/auth/auth.service.spec.ts`

### Implementation for User Story 1

- [x] T010 [US1] Implement signup and login handlers in `api-gateway/src/auth/auth.controller.ts`
- [x] T011 [US1] Implement duplicate-email checks, password hashing, login attempt tracking, token issuance, Redis refresh-token storage, and audit logging in `api-gateway/src/auth/auth.service.ts`
- [x] T012 [US1] Preserve validated signup/login DTO shapes in `api-gateway/src/auth/dto/signup.dto.ts` and `api-gateway/src/auth/dto/login.dto.ts`

**Checkpoint**: Signup and login should now be fully functional and independently testable.

---

## Phase 4: User Story 2 - Maintain Session And Read Profile (Priority: P2)

**Goal**: Refresh a session and read the current authenticated profile.

**Independent Test**: `POST /auth/refresh` with a valid refresh cookie and `GET /auth/me` with an authenticated access token return the expected results and cookie state.

### Tests for User Story 2

- [x] T013 [P] [US2] Cover access-token validation behavior in `api-gateway/src/auth/strategies/jwt.strategy.spec.ts`
- [x] T014 [P] [US2] Cover refresh-cookie extraction, Redis token matching, and blacklist rejection in `api-gateway/src/auth/strategies/jwt-refresh.strategy.spec.ts`
- [x] T015 [P] [US2] Cover refresh and profile controller behavior in `api-gateway/src/auth/auth.controller.spec.ts`

### Implementation for User Story 2

- [x] T016 [US2] Implement refresh and profile endpoints in `api-gateway/src/auth/auth.controller.ts`
- [x] T017 [US2] Implement JWT cookie extraction and user validation in `api-gateway/src/auth/strategies/jwt.strategy.ts` and `api-gateway/src/auth/strategies/jwt-refresh.strategy.ts`
- [x] T018 [US2] Keep refresh-token persistence and profile shaping in `api-gateway/src/auth/auth.service.ts` and `api-gateway/src/users/users.service.ts`

**Checkpoint**: Session refresh and profile lookup should both work on their own.

---

## Phase 5: User Story 3 - Logout And Resist Brute Force (Priority: P3)

**Goal**: Log out cleanly and block repeated failed login attempts.

**Independent Test**: `POST /auth/logout` clears the current session and repeated failed login attempts eventually trigger temporary lockout.

### Tests for User Story 3

- [x] T019 [P] [US3] Cover logout behavior and revoked-token handling in `api-gateway/src/auth/auth.service.spec.ts` and `api-gateway/src/auth/auth.controller.spec.ts`
- [x] T020 [P] [US3] Cover public-route bypass and role/auth guard behavior in `api-gateway/src/auth/guards/jwt-auth.guard.spec.ts` and `api-gateway/src/auth/guards/roles.guard.spec.ts`

### Implementation for User Story 3

- [x] T021 [US3] Implement logout token blacklisting and cookie clearing in `api-gateway/src/auth/auth.controller.ts` and `api-gateway/src/auth/auth.service.ts`
- [x] T022 [US3] Implement login lockout tracking, TTL handling, and audit events in `api-gateway/src/auth/auth.service.ts`
- [x] T023 [US3] Preserve the global auth guard wiring in `api-gateway/src/app.module.ts`

**Checkpoint**: Logout and brute-force protection should both be active and independently testable.

---

## Phase 6: Cross-Cutting Validation

**Purpose**: Work that touches multiple stories or service boundaries.

- [x] T024 [P] Update the migrated documentation in `specs/001-api-gateway-auth/spec.md`, `specs/001-api-gateway-auth/plan.md`, and `specs/001-api-gateway-auth/tasks.md`
- [x] T025 [P] Run or update the owning service tests using the real gateway commands in `api-gateway/package.json`
- [x] T026 [P] Preserve observability and failure-path behavior in `api-gateway/src/common/services/security-audit.service.ts` and `api-gateway/src/auth/auth.service.ts`
- [x] T027 Validate backward compatibility for the existing cookie names and DTO field names in `api-gateway/src/auth/constants/auth.constants.ts` and `api-gateway/src/auth/dto/*.ts`

## Gaps Found

- There is no dedicated HTTP e2e test that drives the full cookie-based auth flow through the Nest runtime; current coverage is primarily unit-level around controller, service, and strategy behavior.
- Cookie security behavior still depends on the runtime environment for `secure`; that is expected, but it means production-only behavior is not fully exercised in the existing unit suite.
- No Prisma schema or migration work was required for this slice because auth state lives in Redis and the user identity model already exists.

## Dependencies & Execution Order

### Phase Dependencies

- Setup and contract lock can start immediately.
- Foundational work blocks all user stories.
- User stories can proceed in priority order once the foundation is ready.
- Cross-cutting validation comes after the story slices that it depends on.

### Service-Specific Validation Commands

- API Gateway: `cd api-gateway && npm test -- auth`, `cd api-gateway && npm run build`, `cd api-gateway && npm test`

### Implementation Notes

- Keep tests close to the touched boundary.
- Prefer strategy and controller tests for cookie-based auth behavior.
- Prefer Redis-backed checks for refresh-token and lockout flows.
- Avoid cross-story coupling unless the contract truly requires it.

## Notes

- [P] tasks can run in parallel because they touch different files with no dependency.
- Each user story is independently completable and testable.
- This feature is already present in runtime code; the tasks document records what exists rather than a work queue to execute.
