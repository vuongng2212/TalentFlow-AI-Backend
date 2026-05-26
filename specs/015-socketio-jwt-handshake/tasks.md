# Tasks: Socket.IO Handshake & Authentication

**Input**: Design documents from `/specs/015-socketio-jwt-handshake/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/websocket-handshake.md, quickstart.md

**Organization**: Tasks are grouped by service boundary and then by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on another task
- **[Story]**: Which user story this task belongs to, such as US1, US2, or US3
- Always include exact file paths in the description

## Path Conventions

- Notification runtime: `notification/src/`
- Notification tests: `notification/src/**/*.spec.ts`, `notification/test/`
- Notification config: `notification/src/config/`, `notification/.env.example`
- Planning docs: `specs/015-socketio-jwt-handshake/`
- API Gateway files are reference-only unless JWT contract alignment becomes unavoidable.

## Phase 1: Setup And Contract Lock

**Purpose**: Confirm runtime ownership and lock the Socket.IO handshake contract before touching runtime code.

- [x] T001 Review the current Socket.IO handshake runtime in `notification/src/notification/notification.gateway.ts`, `notification/src/auth/ws-jwt.guard.ts`, and `notification/src/auth/jwt.strategy.ts`.
- [x] T002 [P] Review the current Notification JWT config contract in `notification/src/config/jwt.config.ts`, `notification/src/config/validation.schema.ts`, and `notification/.env.example`.
- [x] T003 [P] Review the existing Notification gateway and guard tests in `notification/src/notification/notification.gateway.spec.ts` and `notification/src/auth/ws-jwt.guard.spec.ts`.
- [x] T004 [P] Confirm the API Gateway access token reference contract from `api-gateway/src/auth/auth.service.ts`, `api-gateway/src/auth/strategies/jwt.strategy.ts`, and `api-gateway/src/auth/constants/auth.constants.ts` without editing API Gateway files.
- [x] T005 Confirm no implementation drift required updates to `specs/015-socketio-jwt-handshake/contracts/websocket-handshake.md`.

---

## Phase 2: Foundational Work

**Purpose**: Build shared prerequisites that block all user stories.

- [x] T006 Add or update the Notification JWT config mapping for API Gateway access token validation in `notification/src/config/jwt.config.ts`.
- [x] T007 Add or update env validation for the API Gateway access token secret in `notification/src/config/validation.schema.ts`.
- [x] T008 Update Notification example configuration to document the final JWT access secret variable in `notification/.env.example`.
- [x] T009 [P] Add a shared token extraction/normalization helper for Socket.IO auth and Authorization fallback in `notification/src/auth/ws-token.util.ts`.
- [x] T010 Update `WsJwtGuard` to use the shared token extraction rules in `notification/src/auth/ws-jwt.guard.ts`.
- [x] T011 Update `NotificationGateway` to use the shared token extraction rules and API Gateway access token config in `notification/src/notification/notification.gateway.ts`.
- [x] T012 Update `JwtStrategy` to validate the existing API Gateway access token contract without requiring issuer/audience in `notification/src/auth/jwt.strategy.ts`.

**Checkpoint**: Notification can validate the same access token contract that API Gateway issues, and user story work can begin.

---

## Phase 3: User Story 1 - Establish Secure Real-Time Connection (Priority: P1)

**Goal**: Authenticated users can establish a real-time Notification connection with an API Gateway access token.

**Independent Test**: A valid token in `handshake.auth.token` or `Authorization: Bearer <token>` is accepted and attaches the same authenticated user identity to the socket.

### Tests for User Story 1

- [x] T013 [P] [US1] Add gateway middleware test for a valid API Gateway-style token via `handshake.auth.token` in `notification/src/notification/notification.gateway.spec.ts`.
- [x] T014 [P] [US1] Add gateway middleware test for a valid API Gateway-style token via `Authorization: Bearer <token>` in `notification/src/notification/notification.gateway.spec.ts`.
- [x] T015 [P] [US1] Add guard token extraction tests for primary and fallback token locations in `notification/src/auth/ws-jwt.guard.spec.ts`.
- [x] T016 [US1] Add accepted socket identity assertion for `userId`, `email`, and `role` mapping in `notification/src/notification/notification.gateway.spec.ts`.
- [x] T017 [US1] Add authenticated room binding assertion for `user:<userId>` in `notification/src/notification/notification.gateway.spec.ts`.

### Implementation for User Story 1

- [x] T018 [US1] Implement API Gateway access token verification for successful Socket.IO handshakes in `notification/src/notification/notification.gateway.ts`.
- [x] T019 [US1] Implement authenticated user identity mapping from token `sub`, `email`, and `role` in `notification/src/notification/notification.gateway.ts`.
- [x] T020 [US1] Ensure the connection path joins only the server-derived user room in `notification/src/notification/notification.gateway.ts`.

**Checkpoint**: User Story 1 should now be fully functional and independently testable.

---

## Phase 4: User Story 2 - Reject Unauthenticated Or Invalid Connections (Priority: P1)

**Goal**: Missing, invalid, expired, malformed, query-string-only, or insufficient identity tokens are rejected during handshake.

**Independent Test**: Each invalid connection attempt fails before becoming an authenticated socket and leaves `socket.data.user` unset.

### Tests for User Story 2

- [x] T021 [P] [US2] Add missing token rejection test in `notification/src/notification/notification.gateway.spec.ts`.
- [x] T022 [P] [US2] Add invalid signature and malformed token rejection tests in `notification/src/notification/notification.gateway.spec.ts`.
- [x] T023 [P] [US2] Add expired token rejection test in `notification/src/notification/notification.gateway.spec.ts`.
- [x] T024 [P] [US2] Add missing `sub`, `email`, or `role` payload rejection tests in `notification/src/notification/notification.gateway.spec.ts`.
- [x] T025 [P] [US2] Add query-string-only token rejection test in `notification/src/notification/notification.gateway.spec.ts`.
- [x] T026 [P] [US2] Add guard query-string ignore test coverage in `notification/src/auth/ws-jwt.guard.spec.ts`.

### Implementation for User Story 2

- [x] T027 [US2] Ensure missing token attempts fail the Socket.IO middleware before connection in `notification/src/notification/notification.gateway.ts`.
- [x] T028 [US2] Ensure invalid, expired, and malformed access tokens fail deterministically in `notification/src/notification/notification.gateway.ts`.
- [x] T029 [US2] Ensure payloads missing `sub`, `email`, or `role` fail identity mapping in `notification/src/notification/notification.gateway.ts`.
- [x] T030 [US2] Ensure query-string token values are ignored by shared extraction logic in `notification/src/auth/ws-token.util.ts`.

**Checkpoint**: User Stories 1 and 2 should both work independently.

---

## Phase 5: User Story 3 - Verify Connection Establishment Operationally (Priority: P2)

**Goal**: Developers and operators can verify accepted and rejected connection attempts without exposing raw tokens.

**Independent Test**: Success and failure paths produce observable outcomes while masking PII and never logging raw token values.

### Tests for User Story 3

- [x] T031 [P] [US3] Add success logging assertion with masked email in `notification/src/notification/notification.gateway.spec.ts`.
- [x] T032 [P] [US3] Add failure path assertion that raw token values are not logged in `notification/src/notification/notification.gateway.spec.ts`.
- [x] T033 [P] [US3] Add disconnect logging assertion for authenticated and unknown users in `notification/src/notification/notification.gateway.spec.ts`.

### Implementation for User Story 3

- [x] T034 [US3] Harden success and disconnect logging to use masked identity values in `notification/src/notification/notification.gateway.ts`.
- [x] T035 [US3] Harden handshake rejection handling so emitted errors do not include raw tokens in `notification/src/notification/notification.gateway.ts`.

**Checkpoint**: All prioritized user stories should now be independently functional.

---

## Phase 6: Cross-Cutting Validation

**Purpose**: Validate the feature slice and update active planning/runtime guidance only where the contract changed.

- [x] T036 [P] Update Notification runtime guidance for the final WebSocket auth contract in `notification/README.md`.
- [x] T037 [P] Confirm no implementation contract change required updates to `specs/015-socketio-jwt-handshake/plan.md`, `specs/015-socketio-jwt-handshake/contracts/websocket-handshake.md`, or `specs/015-socketio-jwt-handshake/quickstart.md`.
- [x] T038 Run focused Notification tests with `npm test -- notification.gateway.spec.ts ws-jwt.guard.spec.ts` from `notification/package.json`.
- [x] T039 Run full Notification unit tests with `npm test` from `notification/package.json`.
- [x] T040 Run Notification lint with `npm run lint` from `notification/package.json`.
- [x] T041 Run Notification build with `npm run build` from `notification/package.json`.
- [x] T042 Confirm API Gateway contract tests were not required because API Gateway files were not changed.

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 can start immediately.
- Phase 2 blocks all user stories.
- User Story 1 and User Story 2 are both P1; implement US1 first for the successful path, then US2 for fail-closed hardening.
- User Story 3 depends on the success and rejection paths from US1 and US2.
- Phase 6 follows all implemented story slices.

### User Story Dependencies

- **US1**: Depends on Phase 2 config/token extraction foundation.
- **US2**: Depends on Phase 2 foundation; can be developed after or alongside US1 tests once shared extraction exists.
- **US3**: Depends on US1 and US2 observable success/failure paths.

### Parallel Execution Examples

- After Phase 2 begins, T009 can be done in parallel with T006-T008 because it creates a separate helper file.
- In US1, T013, T014, and T015 can be written in parallel because they touch focused test cases.
- In US2, T021-T026 can be written in parallel because each covers a distinct rejection path.
- In US3, T031-T033 can be written in parallel because each verifies a different logging path.
- In Phase 6, T036 and T037 can run in parallel with validation command execution after implementation is complete.

### Service-Specific Validation Commands

- Notification focused: `cd notification && npm test -- notification.gateway.spec.ts ws-jwt.guard.spec.ts`
- Notification full: `cd notification && npm test`
- Notification lint: `cd notification && npm run lint`
- Notification build: `cd notification && npm run build`
- API Gateway contract only if touched: `cd api-gateway && npm test -- auth.service.spec.ts jwt.strategy.spec.ts`

## Implementation Strategy

### MVP First

Complete Phase 1, Phase 2, and Phase 3 to prove valid API Gateway access tokens can establish secure real-time connections.

### Incremental Delivery

1. Deliver US1 successful handshake and room binding.
2. Add US2 fail-closed rejection paths.
3. Add US3 operational verification and logging hardening.
4. Run Phase 6 validation and update active docs.

## Notes

- [P] tasks can run in parallel because they touch different files with no dependency on another incomplete task.
- Tests are included because this feature touches an auth boundary and the spec requires deterministic accepted/rejected connection behavior.
- Keep implementation in `notification/` unless API Gateway contract alignment becomes unavoidable.
- Do not modify frozen legacy sources.
