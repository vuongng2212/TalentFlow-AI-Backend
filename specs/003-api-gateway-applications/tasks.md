# Tasks: API Gateway Applications

**Input**: Design documents from `/specs/003-api-gateway-applications/`
**Prerequisites**: plan.md, spec.md

**Organization**: Tasks are grouped by service boundary and then by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or has no dependency on another task
- **[Story]**: Which user story the task belongs to, such as US1, US2, or US3
- Always include exact file paths in the description

## Path Conventions

- API Gateway: `api-gateway/src/`, `api-gateway/prisma/`, `api-gateway/test/`
- Shared planning docs: `specs/003-api-gateway-applications/`

## Phase 1: Setup And Contract Lock

**Purpose**: Confirm runtime ownership, lock the contract surface, and record the existing application lifecycle behavior.

- [x] T001 Review the current runtime entrypoint and affected applications files for the feature in `api-gateway/src/app.module.ts`, `api-gateway/src/applications/applications.module.ts`, and `api-gateway/src/applications/**`
- [x] T002 [P] Capture the applications HTTP and upload contract in `specs/003-api-gateway-applications/spec.md` from `api-gateway/src/applications/applications.controller.ts`, `api-gateway/src/applications/dto/*.ts`, and `api-gateway/src/queue/interfaces/cv-uploaded-event.interface.ts`
- [x] T003 [P] Record validation, storage, and queue requirements in `api-gateway/src/applications/dto/*.ts`, `api-gateway/src/common/pipes/file-validation.pipe.ts`, `api-gateway/src/storage/storage.service.ts`, and `api-gateway/src/queue/queue.service.ts`

---

## Phase 2: Foundational Work

**Purpose**: Build the shared prerequisites that block all user stories for this feature.

- [x] T004 Wire `api-gateway/src/applications/applications.module.ts` with `PrismaModule`, `StorageModule`, `QueueModule`, and `ApplicationsService`
- [x] T005 [P] Define the request and response DTOs in `api-gateway/src/applications/dto/create-application.dto.ts`, `api-gateway/src/applications/dto/update-application.dto.ts`, `api-gateway/src/applications/dto/query-applications.dto.ts`, `api-gateway/src/applications/dto/upload-cv.dto.ts`, and `api-gateway/src/applications/dto/upload-cv-response.dto.ts`
- [x] T006 [P] Establish validation rules for pagination, role-based filters, file uploads, and update payloads in `api-gateway/src/applications/dto/*.ts` and `api-gateway/src/common/pipes/file-validation.pipe.ts`
- [x] T007 Keep the minimum persistence, storage, and queue wiring in `api-gateway/src/applications/applications.service.ts`, `api-gateway/src/storage/storage.service.ts`, and `api-gateway/src/queue/queue.service.ts`

**Checkpoint**: The applications boundary is wired and user story work can be validated independently.

---

## Phase 3: User Story 1 - Submit Applications (Priority: P1)

**Goal**: Submit a standard application or a CV-upload application for an open job.

**Independent Test**: `POST /applications` and `POST /applications/upload` create the application, reject duplicates, and publish the CV queue event when a file is uploaded.

### Tests for User Story 1

- [x] [P] [US1] Cover application creation and upload controller behavior in `api-gateway/src/applications/applications.controller.spec.ts`
- [x] [P] [US1] Cover open-job checks, duplicate detection, candidate auto-creation, upload rollback, and queue publishing in `api-gateway/src/applications/applications.service.spec.ts`

### Implementation for User Story 1

- [x] [US1] Implement application submission and CV upload handlers in `api-gateway/src/applications/applications.controller.ts`
- [x] [US1] Implement open-job validation, duplicate checks, candidate auto-creation, storage upload, queue publish, and rollback logic in `api-gateway/src/applications/applications.service.ts`
- [x] [US1] Preserve upload DTO and response DTO validation in `api-gateway/src/applications/dto/create-application.dto.ts`, `api-gateway/src/applications/dto/upload-cv.dto.ts`, and `api-gateway/src/applications/dto/upload-cv-response.dto.ts`

**Checkpoint**: Application submission and upload should now be fully functional and independently testable.

---

## Phase 4: User Story 2 - Browse Applications (Priority: P2)

**Goal**: Read application lists and detail views with role-based visibility.

**Independent Test**: `GET /applications` and `GET /applications/:id` return the application set visible to the current role and reject unauthorized access.

### Tests for User Story 2

- [x] [P] [US2] Cover list and detail controller behavior in `api-gateway/src/applications/applications.controller.spec.ts`
- [x] [P] [US2] Cover role-based filtering, pagination, and access checks in `api-gateway/src/applications/applications.service.spec.ts`

### Implementation for User Story 2

- [x] [US2] Implement application list and detail handlers in `api-gateway/src/applications/applications.controller.ts`
- [x] [US2] Implement role-based filtering, pagination, and access control in `api-gateway/src/applications/applications.service.ts`
- [x] [US2] Preserve query DTO validation in `api-gateway/src/applications/dto/query-applications.dto.ts`

**Checkpoint**: Browsing and application detail reads should now be independently testable.

---

## Phase 5: User Story 3 - Update And Withdraw Applications (Priority: P3)

**Goal**: Update application fields and withdraw applications with the existing role rules.

**Independent Test**: `PUT /applications/:id` and `DELETE /applications/:id` persist the expected lifecycle changes and enforce the current authorization rules.

### Tests for User Story 3

- [x] [P] [US3] Cover update and withdraw controller behavior in `api-gateway/src/applications/applications.controller.spec.ts`
- [x] [P] [US3] Cover recruiter/admin updates, applicant cover-letter edits, and withdraw authorization in `api-gateway/src/applications/applications.service.spec.ts`

### Implementation for User Story 3

- [x] [US3] Implement application update and withdraw handlers in `api-gateway/src/applications/applications.controller.ts`
- [x] [US3] Implement stage/status/notes updates, cover-letter edits, reviewedAt handling, and withdraw soft-delete behavior in `api-gateway/src/applications/applications.service.ts`
- [x] [US3] Preserve update DTO validation in `api-gateway/src/applications/dto/update-application.dto.ts`

**Checkpoint**: Application updates and withdrawals should now be independently testable.

---

## Phase 6: Cross-Cutting Validation

**Purpose**: Work that touches multiple stories or service boundaries.

- [x] T024 [P] Update the migrated documentation in `specs/003-api-gateway-applications/spec.md`, `specs/003-api-gateway-applications/plan.md`, and `specs/003-api-gateway-applications/tasks.md`
- [x] T025 [P] Run or update the owning service tests using the real gateway commands in `api-gateway/package.json`
- [x] T026 [P] Preserve observability and failure-path behavior in `api-gateway/src/applications/applications.service.ts`, `api-gateway/src/storage/storage.service.ts`, and `api-gateway/src/queue/queue.service.ts`
- [x] T027 Validate backward compatibility for the existing route names, DTO field names, queue event payload, and upload response shape in `api-gateway/src/applications/**` and `api-gateway/src/queue/interfaces/cv-uploaded-event.interface.ts`

## Gaps Found

- There is no dedicated HTTP e2e test that drives the full application lifecycle through the Nest runtime; current coverage is primarily unit-level around controller, service, storage, and queue behavior.
- The upload flow depends on both storage and queue infrastructure being healthy; the current tests cover the rollback path, but not a live end-to-end broker plus storage deployment.
- No Prisma schema or migration work was required for this slice because the feature uses the existing application and candidate models.

## Dependencies & Execution Order

### Phase Dependencies

- Setup and contract lock can start immediately.
- Foundational work blocks all user stories.
- User stories can proceed in priority order once the foundation is ready.
- Cross-cutting validation comes after the story slices that it depends on.

### Service-Specific Validation Commands

- API Gateway: `cd api-gateway && npm test -- applications`, `cd api-gateway && npm run build`, `cd api-gateway && npm test`

### Implementation Notes

- Keep tests close to the touched boundary.
- Prefer controller, service, storage, and queue tests for upload flows.
- Prefer role-based service tests for visibility and authorization behavior.
- Avoid cross-story coupling unless the contract truly requires it.

## Notes

- [P] tasks can run in parallel because they touch different files with no dependency.
- Each user story is independently completable and testable.
- This feature is already present in runtime code; the tasks document records what exists rather than a work queue to execute.