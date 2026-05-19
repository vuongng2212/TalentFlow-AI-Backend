# Tasks: API Gateway Candidates

**Input**: Design documents from `/specs/005-api-gateway-candidates/`
**Prerequisites**: plan.md, spec.md

**Organization**: Tasks are grouped by service boundary and then by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or has no dependency on another task
- **[Story]**: Which user story the task belongs to, such as US1, US2, or US3
- Always include exact file paths in the description

## Path Conventions

- API Gateway: `api-gateway/src/`, `api-gateway/prisma/`, `api-gateway/test/`
- Shared planning docs: `specs/005-api-gateway-candidates/`

## Phase 1: Setup And Contract Lock

**Purpose**: Confirm runtime ownership, lock the contract surface, and record the existing candidate behavior.

- [x] T001 Review the current runtime entrypoint and affected candidates files for the feature in `api-gateway/src/app.module.ts`, `api-gateway/src/candidates/candidates.module.ts`, and `api-gateway/src/candidates/**`
- [x] T002 [P] Capture the candidates HTTP contract in `specs/005-api-gateway-candidates/spec.md` from `api-gateway/src/candidates/candidates.controller.ts` and `api-gateway/src/candidates/dto/*.ts`
- [x] T003 [P] Record validation, role, and delete semantics in `api-gateway/src/candidates/dto/*.ts` and the gateway auth guard stack

---

## Phase 2: Foundational Work

**Purpose**: Build the shared prerequisites that block all user stories for this feature.

- [x] T004 Wire `api-gateway/src/candidates/candidates.module.ts` with `CandidatesController` and `CandidatesService`
- [x] T005 [P] Define the request and response DTOs in `api-gateway/src/candidates/dto/query-candidates.dto.ts`, `api-gateway/src/candidates/dto/update-candidate.dto.ts`, and `api-gateway/src/candidates/dto/candidate-response.dto.ts`
- [x] T006 [P] Establish pagination, search, and update validation rules in `api-gateway/src/candidates/dto/*.ts`
- [x] T007 Keep the minimum persistence wiring in `api-gateway/src/candidates/candidates.service.ts` and `api-gateway/src/prisma/prisma.service.ts`

**Checkpoint**: The candidates boundary is wired and user story work can be validated independently.

---

## Phase 3: User Story 1 - Browse Candidate Records (Priority: P1)

**Goal**: Search candidate records and inspect their application history.

**Independent Test**: `GET /candidates` and `GET /candidates/:id` return paginated candidates and application history for authorized roles.

### Tests for User Story 1

- [x] [P] [US1] Cover list and detail controller behavior in `api-gateway/src/candidates/candidates.controller.spec.ts`
- [x] [P] [US1] Cover pagination, search, detail lookup, and application-history inclusion in `api-gateway/src/candidates/candidates.service.spec.ts`

### Implementation for User Story 1

- [x] [US1] Implement list and detail handlers in `api-gateway/src/candidates/candidates.controller.ts`
- [x] [US1] Implement searchable paging and application-history lookup in `api-gateway/src/candidates/candidates.service.ts`
- [x] [US1] Preserve query and response DTO validation in `api-gateway/src/candidates/dto/query-candidates.dto.ts` and `api-gateway/src/candidates/dto/candidate-response.dto.ts`

**Checkpoint**: Candidate browsing and detail reads should now be fully functional and independently testable.

---

## Phase 4: User Story 2 - Update Candidate Information (Priority: P2)

**Goal**: Update candidate contact and profile data as a recruiter or admin.

**Independent Test**: `PATCH /candidates/:id` persists the supplied candidate fields and rejects unauthorized roles.

### Tests for User Story 2

- [x] [P] [US2] Cover update controller behavior in `api-gateway/src/candidates/candidates.controller.spec.ts`
- [x] [P] [US2] Cover update validation and not-found behavior in `api-gateway/src/candidates/candidates.service.spec.ts`

### Implementation for User Story 2

- [x] [US2] Implement candidate update handler in `api-gateway/src/candidates/candidates.controller.ts`
- [x] [US2] Implement recruiter/admin update persistence in `api-gateway/src/candidates/candidates.service.ts`
- [x] [US2] Preserve update DTO validation in `api-gateway/src/candidates/dto/update-candidate.dto.ts`

**Checkpoint**: Candidate updates should now be independently testable.

---

## Phase 5: User Story 3 - Remove Candidates (Priority: P3)

**Goal**: Admins can delete candidates and trigger the existing cascade behavior.

**Independent Test**: `DELETE /candidates/:id` removes the candidate and cascades related applications for authorized admins.

### Tests for User Story 3

- [x] [P] [US3] Cover delete controller behavior in `api-gateway/src/candidates/candidates.controller.spec.ts`
- [x] [P] [US3] Cover admin-only delete and not-found behavior in `api-gateway/src/candidates/candidates.service.spec.ts`

### Implementation for User Story 3

- [x] [US3] Implement admin delete handler in `api-gateway/src/candidates/candidates.controller.ts`
- [x] [US3] Implement hard-delete persistence and cascade-aware behavior in `api-gateway/src/candidates/candidates.service.ts`
- [x] [US3] Preserve delete authorization through the gateway auth guard stack in `api-gateway/src/auth/guards/jwt-auth.guard.ts`, `api-gateway/src/auth/guards/roles.guard.ts`, and `api-gateway/src/app.module.ts`

**Checkpoint**: Candidate deletion should now be independently testable.

---

## Phase 6: Cross-Cutting Validation

**Purpose**: Work that touches multiple stories or service boundaries.

- [x] T024 [P] Update the migrated documentation in `specs/005-api-gateway-candidates/spec.md`, `specs/005-api-gateway-candidates/plan.md`, and `specs/005-api-gateway-candidates/tasks.md`
- [x] T025 [P] Run or update the owning service tests using the real gateway commands in `api-gateway/package.json`
- [x] T026 [P] Preserve observability and failure-path behavior in `api-gateway/src/candidates/candidates.service.ts`
- [x] T027 Validate backward compatibility for the existing route names, DTO field names, and response shape in `api-gateway/src/candidates/**`

## Gaps Found

- There is no dedicated HTTP e2e test that drives the full candidates lifecycle through the Nest runtime; current coverage is primarily unit-level around controller and service behavior.
- Candidate deletion is hard delete, so there is no archival or restore path in the current runtime behavior.
- No Prisma schema or migration work was required for this slice because the feature uses the existing candidate model and its cascade behavior.

## Dependencies & Execution Order

### Phase Dependencies

- Setup and contract lock can start immediately.
- Foundational work blocks all user stories.
- User stories can proceed in priority order once the foundation is ready.
- Cross-cutting validation comes after the story slices that it depends on.

### Service-Specific Validation Commands

- API Gateway: `cd api-gateway && npm test -- candidates`, `cd api-gateway && npm run build`, `cd api-gateway && npm test`

### Implementation Notes

- Keep tests close to the touched boundary.
- Prefer controller and service tests for read/update/delete behavior.
- Preserve cascade-delete awareness in the docs so future work does not treat candidates as soft-deleted.
- Avoid cross-story coupling unless the contract truly requires it.

## Notes

- [P] tasks can run in parallel because they touch different files with no dependency.
- Each user story is independently completable and testable.
- This feature is already present in runtime code; the tasks document records what exists rather than a work queue to execute.