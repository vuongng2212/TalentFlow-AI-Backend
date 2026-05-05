# Tasks: API Gateway Jobs

**Input**: Design documents from `/specs/004-api-gateway-jobs/`
**Prerequisites**: plan.md, spec.md

**Organization**: Tasks are grouped by service boundary and then by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or has no dependency on another task
- **[Story]**: Which user story the task belongs to, such as US1, US2, or US3
- Always include exact file paths in the description

## Path Conventions

- API Gateway: `api-gateway/src/`, `api-gateway/prisma/`, `api-gateway/test/`
- Shared planning docs: `specs/004-api-gateway-jobs/`

## Phase 1: Setup And Contract Lock

**Purpose**: Confirm runtime ownership, lock the contract surface, and record the existing jobs behavior.

- [x] T001 Review the current runtime entrypoint and affected jobs files for the feature in `api-gateway/src/app.module.ts`, `api-gateway/src/jobs/jobs.module.ts`, and `api-gateway/src/jobs/**`
- [x] T002 [P] Capture the jobs HTTP contract in `specs/004-api-gateway-jobs/spec.md` from `api-gateway/src/jobs/jobs.controller.ts` and `api-gateway/src/jobs/dto/*.ts`
- [x] T003 [P] Record validation and authorization requirements in `api-gateway/src/jobs/dto/*.ts` and the gateway auth guard stack

---

## Phase 2: Foundational Work

**Purpose**: Build the shared prerequisites that block all user stories for this feature.

- [x] T004 Wire `api-gateway/src/jobs/jobs.module.ts` with `PrismaModule`, `JobsController`, and `JobsService`
- [x] T005 [P] Define the request and response DTOs in `api-gateway/src/jobs/dto/create-job.dto.ts`, `api-gateway/src/jobs/dto/update-job.dto.ts`, `api-gateway/src/jobs/dto/query-jobs.dto.ts`, `api-gateway/src/jobs/dto/job-response.dto.ts`, and `api-gateway/src/jobs/dto/job-requirements.dto.ts`
- [x] T006 [P] Establish pagination, filtering, and structured requirements validation in `api-gateway/src/jobs/dto/*.ts`
- [x] T007 Keep the minimum persistence wiring in `api-gateway/src/jobs/jobs.service.ts` and `api-gateway/src/prisma/prisma.service.ts`

**Checkpoint**: The jobs boundary is wired and user story work can be validated independently.

---

## Phase 3: User Story 1 - Create Job Postings (Priority: P1)

**Goal**: Create a new job posting with optional structured requirements.

**Independent Test**: `POST /jobs` creates the job for a recruiter or admin and persists nested requirements when supplied.

### Tests for User Story 1

- [x] [P] [US1] Cover create controller behavior in `api-gateway/src/jobs/jobs.controller.spec.ts`
- [x] [P] [US1] Cover create logic and requirements JSON mapping in `api-gateway/src/jobs/jobs.service.spec.ts`

### Implementation for User Story 1

- [x] [US1] Implement create handler in `api-gateway/src/jobs/jobs.controller.ts`
- [x] [US1] Implement job creation and requirements JSON mapping in `api-gateway/src/jobs/jobs.service.ts`
- [x] [US1] Preserve create DTO validation in `api-gateway/src/jobs/dto/create-job.dto.ts` and `api-gateway/src/jobs/dto/job-requirements.dto.ts`

**Checkpoint**: Job creation should now be fully functional and independently testable.

---

## Phase 4: User Story 2 - Browse Active Jobs (Priority: P2)

**Goal**: Publicly list jobs and read job details with filters and pagination.

**Independent Test**: `GET /jobs` and `GET /jobs/:id` return active jobs with the current filters and exclude deleted jobs.

### Tests for User Story 2

- [x] [P] [US2] Cover list and detail controller behavior in `api-gateway/src/jobs/jobs.controller.spec.ts`
- [x] [P] [US2] Cover pagination, search, salary, skills, status, and detail lookup in `api-gateway/src/jobs/jobs.service.spec.ts`

### Implementation for User Story 2

- [x] [US2] Implement public browse and detail handlers in `api-gateway/src/jobs/jobs.controller.ts`
- [x] [US2] Implement filtered listing and active-job lookup in `api-gateway/src/jobs/jobs.service.ts`
- [x] [US2] Preserve query DTO validation in `api-gateway/src/jobs/dto/query-jobs.dto.ts`

**Checkpoint**: Public browsing and job detail reads should now be independently testable.

---

## Phase 5: User Story 3 - Update And Remove Jobs (Priority: P3)

**Goal**: Update or soft-delete a job posting as the owner or an admin.

**Independent Test**: `PUT /jobs/:id` and `DELETE /jobs/:id` persist the expected job changes and enforce the ownership rule.

### Tests for User Story 3

- [x] [P] [US3] Cover update and delete controller behavior in `api-gateway/src/jobs/jobs.controller.spec.ts`
- [x] [P] [US3] Cover owner/admin authorization and soft-delete behavior in `api-gateway/src/jobs/jobs.service.spec.ts`

### Implementation for User Story 3

- [x] [US3] Implement update and delete handlers in `api-gateway/src/jobs/jobs.controller.ts`
- [x] [US3] Implement owner/admin update checks and soft-delete persistence in `api-gateway/src/jobs/jobs.service.ts`
- [x] [US3] Preserve update DTO validation in `api-gateway/src/jobs/dto/update-job.dto.ts`

**Checkpoint**: Job updates and deletions should now be independently testable.

---

## Phase 6: Cross-Cutting Validation

**Purpose**: Work that touches multiple stories or service boundaries.

- [x] T024 [P] Update the migrated documentation in `specs/004-api-gateway-jobs/spec.md`, `specs/004-api-gateway-jobs/plan.md`, and `specs/004-api-gateway-jobs/tasks.md`
- [x] T025 [P] Run or update the owning service tests using the real gateway commands in `api-gateway/package.json`
- [x] T026 [P] Preserve observability and failure-path behavior in `api-gateway/src/jobs/jobs.service.ts`
- [x] T027 Validate backward compatibility for the existing route names, DTO field names, and response shape in `api-gateway/src/jobs/**`

## Gaps Found

- There is no dedicated HTTP e2e test that drives the full jobs lifecycle through the Nest runtime; current coverage is primarily unit-level around controller and service behavior.
- The service returns Prisma include data such as creator metadata and application counts, but the Swagger DTOs do not fully describe every nested field.
- No Prisma schema or migration work was required for this slice because the feature uses the existing job model.

## Dependencies & Execution Order

### Phase Dependencies

- Setup and contract lock can start immediately.
- Foundational work blocks all user stories.
- User stories can proceed in priority order once the foundation is ready.
- Cross-cutting validation comes after the story slices that it depends on.

### Service-Specific Validation Commands

- API Gateway: `cd api-gateway && npm test -- jobs`, `cd api-gateway && npm run build`, `cd api-gateway && npm test`

### Implementation Notes

- Keep tests close to the touched boundary.
- Prefer controller and service tests for CRUD and query behavior.
- Prefer Prisma-backed checks for salary, skills, and soft-delete semantics.
- Avoid cross-story coupling unless the contract truly requires it.

## Notes

- [P] tasks can run in parallel because they touch different files with no dependency.
- Each user story is independently completable and testable.
- This feature is already present in runtime code; the tasks document records what exists rather than a work queue to execute.