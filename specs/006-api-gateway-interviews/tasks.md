# Tasks: API Gateway Interviews

**Input**: Design documents from `/specs/006-api-gateway-interviews/`
**Prerequisites**: plan.md, spec.md

**Organization**: Tasks are grouped by service boundary and then by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or has no dependency on another task
- **[Story]**: Which user story the task belongs to, such as US1, US2, or US3
- Always include exact file paths in the description

## Path Conventions

- API Gateway: `api-gateway/src/`, `api-gateway/prisma/`, `api-gateway/test/`
- Shared planning docs: `specs/006-api-gateway-interviews/`

## Phase 1: Setup And Contract Lock

**Purpose**: Confirm runtime ownership, lock the contract surface, and record the existing interview behavior.

- [x] T001 Review the current runtime entrypoint and affected interviews files for the feature in `api-gateway/src/app.module.ts`, `api-gateway/src/interviews/interviews.module.ts`, and `api-gateway/src/interviews/**`
- [x] T002 [P] Capture the interviews HTTP contract in `specs/006-api-gateway-interviews/spec.md` from `api-gateway/src/interviews/interviews.controller.ts` and `api-gateway/src/interviews/dto/*.ts`
- [x] T003 [P] Record validation and authorization requirements in `api-gateway/src/interviews/dto/*.ts` and the gateway auth guard stack

---

## Phase 2: Foundational Work

**Purpose**: Build the shared prerequisites that block all user stories for this feature.

- [x] T004 Wire `api-gateway/src/interviews/interviews.module.ts` with `InterviewsController` and `InterviewsService`
- [x] T005 [P] Define the request and response DTOs in `api-gateway/src/interviews/dto/create-interview.dto.ts`, `api-gateway/src/interviews/dto/update-interview.dto.ts`, `api-gateway/src/interviews/dto/query-interviews.dto.ts`, and `api-gateway/src/interviews/dto/interview-response.dto.ts`
- [x] T006 [P] Establish future-date, role, and status validation rules in `api-gateway/src/interviews/dto/*.ts`
- [x] T007 Keep the minimum persistence wiring in `api-gateway/src/interviews/interviews.service.ts` and `api-gateway/src/prisma/prisma.service.ts`

**Checkpoint**: The interviews boundary is wired and user story work can be validated independently.

---

## Phase 3: User Story 1 - Schedule Interviews (Priority: P1)

**Goal**: Create interviews for existing applications with future scheduled times.

**Independent Test**: `POST /interviews` creates the interview only when the application exists and the scheduled time is in the future.

### Tests for User Story 1

- [x] [P] [US1] Cover create controller behavior in `api-gateway/src/interviews/interviews.controller.spec.ts`
- [x] [P] [US1] Cover application existence, interviewer existence, and future-date validation in `api-gateway/src/interviews/interviews.service.spec.ts`

### Implementation for User Story 1

- [x] [US1] Implement interview creation handler in `api-gateway/src/interviews/interviews.controller.ts`
- [x] [US1] Implement application lookup, interviewer lookup, future-date validation, and interview creation in `api-gateway/src/interviews/interviews.service.ts`
- [x] [US1] Preserve create DTO validation in `api-gateway/src/interviews/dto/create-interview.dto.ts`

**Checkpoint**: Interview scheduling should now be fully functional and independently testable.

---

## Phase 4: User Story 2 - Browse Interviews (Priority: P2)

**Goal**: Browse interviews and inspect interview details with linked application and interviewer context.

**Independent Test**: `GET /interviews` and `GET /interviews/:id` return paginated interview data with the current filters and relation data.

### Tests for User Story 2

- [x] [P] [US2] Cover list and detail controller behavior in `api-gateway/src/interviews/interviews.controller.spec.ts`
- [x] [P] [US2] Cover pagination, filters, and relation loading in `api-gateway/src/interviews/interviews.service.spec.ts`

### Implementation for User Story 2

- [x] [US2] Implement interview list and detail handlers in `api-gateway/src/interviews/interviews.controller.ts`
- [x] [US2] Implement filtered listing and detail relation loading in `api-gateway/src/interviews/interviews.service.ts`
- [x] [US2] Preserve query DTO validation in `api-gateway/src/interviews/dto/query-interviews.dto.ts` and `api-gateway/src/interviews/dto/interview-response.dto.ts`

**Checkpoint**: Interview browsing should now be independently testable.

---

## Phase 5: User Story 3 - Reschedule Or Cancel Interviews (Priority: P3)

**Goal**: Update interview details and cancel interviews without deleting the record.

**Independent Test**: `PATCH /interviews/:id` and `DELETE /interviews/:id` persist the expected changes and enforce the current validation rules.

### Tests for User Story 3

- [x] [P] [US3] Cover update and cancel controller behavior in `api-gateway/src/interviews/interviews.controller.spec.ts`
- [x] [P] [US3] Cover reschedule validation and cancel-as-status behavior in `api-gateway/src/interviews/interviews.service.spec.ts`

### Implementation for User Story 3

- [x] [US3] Implement interview update and cancel handlers in `api-gateway/src/interviews/interviews.controller.ts`
- [x] [US3] Implement reschedule validation and cancel-as-status persistence in `api-gateway/src/interviews/interviews.service.ts`
- [x] [US3] Preserve update DTO validation in `api-gateway/src/interviews/dto/update-interview.dto.ts`

**Checkpoint**: Interview updates and cancellations should now be independently testable.

---

## Phase 6: Cross-Cutting Validation

**Purpose**: Work that touches multiple stories or service boundaries.

- [x] T024 [P] Update the migrated documentation in `specs/006-api-gateway-interviews/spec.md`, `specs/006-api-gateway-interviews/plan.md`, and `specs/006-api-gateway-interviews/tasks.md`
- [x] T025 [P] Run or update the owning service tests using the real gateway commands in `api-gateway/package.json`
- [x] T026 [P] Preserve observability and failure-path behavior in `api-gateway/src/interviews/interviews.service.ts`
- [x] T027 Validate backward compatibility for the existing route names, DTO field names, and response shape in `api-gateway/src/interviews/**`

## Gaps Found

- There is no dedicated HTTP e2e test that drives the full interviews lifecycle through the Nest runtime; current coverage is primarily unit-level around controller and service behavior.
- Interview cancellation is a status change, so there is no archival or restore path in the current runtime behavior.
- No Prisma schema or migration work was required for this slice because the feature uses the existing interview model.

## Dependencies & Execution Order

### Phase Dependencies

- Setup and contract lock can start immediately.
- Foundational work blocks all user stories.
- User stories can proceed in priority order once the foundation is ready.
- Cross-cutting validation comes after the story slices that it depends on.

### Service-Specific Validation Commands

- API Gateway: `cd api-gateway && npm test -- interviews`, `cd api-gateway && npm run build`, `cd api-gateway && npm test`

### Implementation Notes

- Keep tests close to the touched boundary.
- Prefer controller and service tests for scheduling and cancel behavior.
- Preserve future-date validation and cancel-as-status semantics in the docs so future work does not treat interviews as deleted records.
- Avoid cross-story coupling unless the contract truly requires it.

## Notes

- [P] tasks can run in parallel because they touch different files with no dependency.
- Each user story is independently completable and testable.
- This feature is already present in runtime code; the tasks document records what exists rather than a work queue to execute.