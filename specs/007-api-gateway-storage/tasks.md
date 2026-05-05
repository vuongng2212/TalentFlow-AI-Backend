# Tasks: API Gateway Storage

**Input**: Design documents from `/specs/007-api-gateway-storage/`
**Prerequisites**: plan.md, spec.md

**Organization**: Tasks are grouped by service boundary and then by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or has no dependency on another task
- **[Story]**: Which user story the task belongs to, such as US1, US2, or US3
- Always include exact file paths in the description

## Path Conventions

- API Gateway: `api-gateway/src/`, `api-gateway/prisma/`, `api-gateway/test/`
- Shared planning docs: `specs/007-api-gateway-storage/`

## Phase 1: Setup And Contract Lock

**Purpose**: Confirm runtime ownership, lock the contract surface, and record the existing storage behavior.

- [x] T001 Review the current runtime entrypoint and affected storage files for the feature in `api-gateway/src/app.module.ts`, `api-gateway/src/storage/storage.module.ts`, and `api-gateway/src/storage/**`
- [x] T002 [P] Capture the storage utility contract in `specs/007-api-gateway-storage/spec.md` from `api-gateway/src/storage/storage.service.ts` and `api-gateway/src/storage/index.ts`
- [x] T003 [P] Record validation and config requirements in `api-gateway/src/common/config/config.schema.ts` and `api-gateway/src/storage/storage.service.ts`

---

## Phase 2: Foundational Work

**Purpose**: Build the shared prerequisites that block all user stories for this feature.

- [x] T004 Wire `api-gateway/src/storage/storage.module.ts` with `StorageService` as a global module
- [x] T005 [P] Define the upload, signed URL, delete, and bucket-name APIs in `api-gateway/src/storage/storage.service.ts`
- [x] T006 [P] Establish production config validation and URL fallback behavior in `api-gateway/src/storage/storage.service.ts` and `api-gateway/src/common/config/config.schema.ts`
- [x] T007 Keep the minimum object-storage client wiring in `api-gateway/src/storage/storage.service.ts`

**Checkpoint**: The storage boundary is wired and user story work can be validated independently.

---

## Phase 3: User Story 1 - Upload Stored Files (Priority: P1)

**Goal**: Upload files and return the stored location.

**Independent Test**: The upload method stores the object and returns the expected key plus URL for the configured environment.

### Tests for User Story 1

- [x] [P] [US1] Cover upload behavior and URL construction in `api-gateway/src/storage/storage.service.spec.ts`

### Implementation for User Story 1

- [x] [US1] Implement upload and URL construction in `api-gateway/src/storage/storage.service.ts`
- [x] [US1] Preserve bucket-name exposure for downstream workflows in `api-gateway/src/storage/storage.service.ts`

**Checkpoint**: File upload and location resolution should now be fully functional and independently testable.

---

## Phase 4: User Story 2 - Generate Temporary Access Links (Priority: P2)

**Goal**: Generate presigned URLs for stored files.

**Independent Test**: The signed-URL method returns a temporary access link and honors the requested expiry window.

### Tests for User Story 2

- [x] [P] [US2] Cover signed URL generation and expiry behavior in `api-gateway/src/storage/storage.service.spec.ts`

### Implementation for User Story 2

- [x] [US2] Implement presigned URL generation in `api-gateway/src/storage/storage.service.ts`
- [x] [US2] Preserve the existing signed URL fallback behavior in `api-gateway/src/storage/storage.service.ts`

**Checkpoint**: Temporary access link generation should now be independently testable.

---

## Phase 5: User Story 3 - Delete Files And Enforce Storage Safety (Priority: P3)

**Goal**: Delete stored files and enforce safe production initialization.

**Independent Test**: The delete method removes the object and production config failures are raised during service initialization.

### Tests for User Story 3

- [x] [P] [US3] Cover delete behavior, client shutdown, and production config guards in `api-gateway/src/storage/storage.service.spec.ts`

### Implementation for User Story 3

- [x] [US3] Implement delete and client shutdown behavior in `api-gateway/src/storage/storage.service.ts`
- [x] [US3] Preserve production credential and endpoint validation in `api-gateway/src/storage/storage.service.ts` and `api-gateway/src/common/config/config.schema.ts`

**Checkpoint**: File deletion and safety checks should now be independently testable.

---

## Phase 6: Cross-Cutting Validation

**Purpose**: Work that touches multiple stories or service boundaries.

- [x] T024 [P] Update the migrated documentation in `specs/007-api-gateway-storage/spec.md`, `specs/007-api-gateway-storage/plan.md`, and `specs/007-api-gateway-storage/tasks.md`
- [x] T025 [P] Run or update the owning service tests using the real gateway commands in `api-gateway/package.json`
- [x] T026 [P] Preserve observability and failure-path behavior in `api-gateway/src/storage/storage.service.ts`
- [x] T027 Validate backward compatibility for the existing URL-building rules, bucket name, and method surface in `api-gateway/src/storage/**`

## Gaps Found

- There is no dedicated HTTP e2e test for the storage utility because the boundary is exercised indirectly through the upload flows and unit tests.
- The service currently relies on runtime configuration to distinguish local development, account-based R2, and public CDN paths.
- No Prisma schema or migration work was required for this slice because storage is external object storage rather than database persistence.

## Dependencies & Execution Order

### Phase Dependencies

- Setup and contract lock can start immediately.
- Foundational work blocks all user stories.
- User stories can proceed in priority order once the foundation is ready.
- Cross-cutting validation comes after the story slices that it depends on.

### Service-Specific Validation Commands

- API Gateway: `cd api-gateway && npm test -- storage`, `cd api-gateway && npm run build`, `cd api-gateway && npm test`

### Implementation Notes

- Keep tests close to the touched boundary.
- Prefer storage service tests for upload, signed URL, and delete behavior.
- Preserve the bucket-based contract so downstream queue events can keep using bucket plus file key.
- Avoid cross-story coupling unless the contract truly requires it.

## Notes

- [P] tasks can run in parallel because they touch different files with no dependency.
- Each user story is independently completable and testable.
- This feature is already present in runtime code; the tasks document records what exists rather than a work queue to execute.