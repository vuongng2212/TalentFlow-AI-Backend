# Tasks: API Gateway Redis

**Input**: Design documents from `/specs/009-api-gateway-redis/`
**Prerequisites**: plan.md, spec.md

**Organization**: Tasks are grouped by service boundary and then by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or has no dependency on another task
- **[Story]**: Which user story the task belongs to, such as US1, US2, or US3
- Always include exact file paths in the description

## Path Conventions

- API Gateway: `api-gateway/src/`, `api-gateway/prisma/`, `api-gateway/test/`
- Shared planning docs: `specs/009-api-gateway-redis/`

## Phase 1: Setup And Contract Lock

**Purpose**: Confirm runtime ownership, lock the contract surface, and record the existing Redis behavior.

- [x] T001 Review the current runtime entrypoint and affected redis files for the feature in `api-gateway/src/app.module.ts`, `api-gateway/src/redis/redis.module.ts`, and `api-gateway/src/redis/**`
- [x] T002 [P] Capture the Redis utility contract in `specs/009-api-gateway-redis/spec.md` from `api-gateway/src/redis/redis.service.ts` and `api-gateway/src/redis/redis.service.spec.ts`
- [x] T003 [P] Record validation and config requirements in `api-gateway/src/common/config/config.schema.ts` and `api-gateway/src/redis/redis.service.ts`

---

## Phase 2: Foundational Work

**Purpose**: Build the shared prerequisites that block all user stories for this feature.

- [x] T004 Wire `api-gateway/src/redis/redis.module.ts` with `RedisService` as a global module
- [x] T005 [P] Define the get/set/del/exists/incr/expire/ttl/ping APIs in `api-gateway/src/redis/redis.service.ts`
- [x] T006 [P] Establish fail-fast config validation and shutdown behavior in `api-gateway/src/redis/redis.service.ts` and `api-gateway/src/common/config/config.schema.ts`
- [x] T007 Keep the minimum ioredis client wiring in `api-gateway/src/redis/redis.service.ts`

**Checkpoint**: The Redis boundary is wired and user story work can be validated independently.

---

## Phase 3: User Story 1 - Initialize Redis Access (Priority: P1)

**Goal**: Construct a Redis client from configuration and expose the underlying client.

**Independent Test**: The Redis service initializes when the URL exists and fails fast when it is missing.

### Tests for User Story 1

- [x] [P] [US1] Cover constructor success and fail-fast behavior in `api-gateway/src/redis/redis.service.spec.ts`

### Implementation for User Story 1

- [x] [US1] Implement Redis client initialization in `api-gateway/src/redis/redis.service.ts`
- [x] [US1] Preserve direct client exposure in `api-gateway/src/redis/redis.service.ts`
- [x] [US1] Preserve the global module wiring in `api-gateway/src/redis/redis.module.ts`

**Checkpoint**: Redis initialization should now be fully functional and independently testable.

---

## Phase 4: User Story 2 - Read And Write Runtime State (Priority: P2)

**Goal**: Read, write, delete, increment, expire, and inspect Redis keys for runtime coordination.

**Independent Test**: The helper methods forward to the Redis client with the expected semantics and TTL behavior.

### Tests for User Story 2

- [x] [P] [US2] Cover set/get/del/exists/incr/expire/ttl behavior in `api-gateway/src/redis/redis.service.spec.ts`

### Implementation for User Story 2

- [x] [US2] Implement Redis key-value helpers in `api-gateway/src/redis/redis.service.ts`
- [x] [US2] Preserve TTL-backed set behavior in `api-gateway/src/redis/redis.service.ts`
- [x] [US2] Preserve direct Redis semantics in `api-gateway/src/redis/redis.service.ts`

**Checkpoint**: Runtime state operations should now be independently testable.

---

## Phase 5: User Story 3 - Health And Shutdown (Priority: P3)

**Goal**: Ping Redis and shut down the client cleanly.

**Independent Test**: The service returns `PONG` for ping and quits the client on shutdown.

### Tests for User Story 3

- [x] [P] [US3] Cover ping and shutdown behavior in `api-gateway/src/redis/redis.service.spec.ts`

### Implementation for User Story 3

- [x] [US3] Implement ping and shutdown behavior in `api-gateway/src/redis/redis.service.ts`
- [x] [US3] Preserve shutdown cleanup in `api-gateway/src/redis/redis.service.ts`
- [x] [US3] Preserve config-driven initialization and teardown in `api-gateway/src/common/config/config.schema.ts` and `api-gateway/src/redis/redis.service.ts`

**Checkpoint**: Redis health and shutdown should now be independently testable.

---

## Phase 6: Cross-Cutting Validation

**Purpose**: Work that touches multiple stories or service boundaries.

- [x] T024 [P] Update the migrated documentation in `specs/009-api-gateway-redis/spec.md`, `specs/009-api-gateway-redis/plan.md`, and `specs/009-api-gateway-redis/tasks.md`
- [x] T025 [P] Run or update the owning service tests using the real gateway commands in `api-gateway/package.json`
- [x] T026 [P] Preserve observability and failure-path behavior in `api-gateway/src/redis/redis.service.ts`
- [x] T027 Validate backward compatibility for the existing helper names, TTL semantics, and client exposure in `api-gateway/src/redis/**`

## Gaps Found

- There is no dedicated HTTP e2e test for the Redis utility because the boundary is exercised indirectly through the auth and stateful gateway flows.
- The helper intentionally exposes the underlying client, so higher-level encapsulation is not part of the current runtime design.
- No Prisma schema or migration work was required for this slice because Redis is external transient state rather than database persistence.

## Dependencies & Execution Order

### Phase Dependencies

- Setup and contract lock can start immediately.
- Foundational work blocks all user stories.
- User stories can proceed in priority order once the foundation is ready.
- Cross-cutting validation comes after the story slices that it depends on.

### Service-Specific Validation Commands

- API Gateway: `cd api-gateway && npm test -- redis`, `cd api-gateway && npm run build`, `cd api-gateway && npm test`

### Implementation Notes

- Keep tests close to the touched boundary.
- Prefer redis service tests for TTL and helper semantics.
- Preserve direct client semantics so dependent auth flows keep working.
- Avoid cross-story coupling unless the contract truly requires it.

## Notes

- [P] tasks can run in parallel because they touch different files with no dependency.
- Each user story is independently completable and testable.
- This feature is already present in runtime code; the tasks document records what exists rather than a work queue to execute.