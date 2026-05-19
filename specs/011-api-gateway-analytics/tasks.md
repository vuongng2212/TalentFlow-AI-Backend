# Tasks: API Gateway Analytics

**Input**: Design documents from `/specs/011-api-gateway-analytics/`
**Prerequisites**: plan.md, spec.md

**Organization**: Tasks are grouped by service boundary and then by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or has no dependency on another task
- **[Story]**: Which user story the task belongs to, such as US1, US2, or US3
- Always include exact file paths in the description

## Path Conventions

- API Gateway: `api-gateway/src/`, `api-gateway/prisma/`, `api-gateway/test/`
- Shared planning docs: `specs/011-api-gateway-analytics/`

## Phase 1: Setup And Contract Lock

**Purpose**: Confirm runtime ownership, lock the contract surface, and record the existing analytics behavior.

- [x] T001 Review the current runtime entrypoint and affected analytics files for the feature in `api-gateway/src/app.module.ts`, `api-gateway/src/analytics/analytics.module.ts`, and `api-gateway/src/analytics/**`
- [x] T002 [P] Capture the analytics HTTP contract in `specs/011-api-gateway-analytics/spec.md` from `api-gateway/src/analytics/analytics.controller.ts`, `api-gateway/src/analytics/dto/*.ts`, and `api-gateway/src/analytics/analytics.service.ts`
- [x] T003 [P] Record validation and role requirements in `api-gateway/src/analytics/dto/*.ts` and the gateway auth guard stack

---

## Phase 2: Foundational Work

**Purpose**: Build the shared prerequisites that block all user stories for this feature.

- [x] T004 Wire `api-gateway/src/analytics/analytics.module.ts` with `AnalyticsController` and `AnalyticsService`
- [x] T005 [P] Define the request and response DTOs in `api-gateway/src/analytics/dto/analytics-query.dto.ts` and `api-gateway/src/analytics/dto/analytics-response.dto.ts`
- [x] T006 [P] Establish bounds for trends and top-jobs query parameters in `api-gateway/src/analytics/dto/analytics-query.dto.ts`
- [x] T007 Keep the minimum Prisma aggregation wiring in `api-gateway/src/analytics/analytics.service.ts` and `api-gateway/src/prisma/prisma.service.ts`

**Checkpoint**: The analytics boundary is wired and user story work can be validated independently.

---

## Phase 3: User Story 1 - View Recruitment Overview (Priority: P1)

**Goal**: Return recruitment overview and pipeline counts to authorized internal roles.

**Independent Test**: `GET /analytics/overview` and `GET /analytics/pipeline` return the current aggregate values and zero-count stages.

### Tests for User Story 1

- [x] [P] [US1] Cover overview and pipeline controller behavior in `api-gateway/src/analytics/analytics.controller.spec.ts`
- [x] [P] [US1] Cover overview totals and pipeline stage aggregation in `api-gateway/src/analytics/analytics.service.spec.ts`

### Implementation for User Story 1

- [x] [US1] Implement overview and pipeline handlers in `api-gateway/src/analytics/analytics.controller.ts`
- [x] [US1] Implement aggregate job, candidate, and application counts in `api-gateway/src/analytics/analytics.service.ts`
- [x] [US1] Preserve response DTO validation in `api-gateway/src/analytics/dto/analytics-response.dto.ts`

**Checkpoint**: Overview and pipeline reporting should now be fully functional and independently testable.

---

## Phase 4: User Story 2 - Analyze Application Trends (Priority: P2)

**Goal**: Return application trends over a configurable lookback window.

**Independent Test**: `GET /analytics/trends` returns a continuous date series for the default or requested window.

### Tests for User Story 2

- [x] [P] [US2] Cover trend controller behavior in `api-gateway/src/analytics/analytics.controller.spec.ts`
- [x] [P] [US2] Cover trend series generation in `api-gateway/src/analytics/analytics.service.spec.ts`

### Implementation for User Story 2

- [x] [US2] Implement trend handler in `api-gateway/src/analytics/analytics.controller.ts`
- [x] [US2] Implement trend series aggregation in `api-gateway/src/analytics/analytics.service.ts`
- [x] [US2] Preserve trend query validation in `api-gateway/src/analytics/dto/analytics-query.dto.ts`

**Checkpoint**: Trend reporting should now be independently testable.

---

## Phase 5: User Story 3 - Rank Top Jobs (Priority: P3)

**Goal**: Return the jobs with the most applications.

**Independent Test**: `GET /analytics/top-jobs` returns jobs ordered by application count with the configured limit.

### Tests for User Story 3

- [x] [P] [US3] Cover top-jobs controller behavior in `api-gateway/src/analytics/analytics.controller.spec.ts`
- [x] [P] [US3] Cover top-job ranking in `api-gateway/src/analytics/analytics.service.spec.ts`

### Implementation for User Story 3

- [x] [US3] Implement top-job handler in `api-gateway/src/analytics/analytics.controller.ts`
- [x] [US3] Implement top-job ranking in `api-gateway/src/analytics/analytics.service.ts`
- [x] [US3] Preserve top-jobs query validation in `api-gateway/src/analytics/dto/analytics-query.dto.ts`

**Checkpoint**: Top-job reporting should now be independently testable.

---

## Phase 6: Cross-Cutting Validation

**Purpose**: Work that touches multiple stories or service boundaries.

- [x] T024 [P] Update the migrated documentation in `specs/011-api-gateway-analytics/spec.md`, `specs/011-api-gateway-analytics/plan.md`, and `specs/011-api-gateway-analytics/tasks.md`
- [x] T025 [P] Run or update the owning service tests using the real gateway commands in `api-gateway/package.json`
- [x] T026 [P] Preserve observability and failure-path behavior in `api-gateway/src/analytics/analytics.service.ts`
- [x] T027 Validate backward compatibility for the existing route names, DTO field names, and response shape in `api-gateway/src/analytics/**`

## Gaps Found

- The controller tests currently appear to reference older field names in some expectations, so the spec records the live service response shape rather than the stale test wording.
- There is no dedicated HTTP e2e test that drives the full analytics flow through the Nest runtime; current coverage is primarily unit-level around controller and service behavior.
- No Prisma schema or migration work was required for this slice because analytics are derived from existing Prisma data rather than persisted analytics tables.

## Dependencies & Execution Order

### Phase Dependencies

- Setup and contract lock can start immediately.
- Foundational work blocks all user stories.
- User stories can proceed in priority order once the foundation is ready.
- Cross-cutting validation comes after the story slices that it depends on.

### Service-Specific Validation Commands

- API Gateway: `cd api-gateway && npm test -- analytics`, `cd api-gateway && npm run build`, `cd api-gateway && npm test`

### Implementation Notes

- Keep tests close to the touched boundary.
- Prefer controller and service tests for reporting aggregates.
- Preserve the read-only role restriction so the reporting surface stays non-mutating.
- Avoid cross-story coupling unless the contract truly requires it.

## Notes

- [P] tasks can run in parallel because they touch different files with no dependency.
- Each user story is independently completable and testable.
- This feature is already present in runtime code; the tasks document records what exists rather than a work queue to execute.