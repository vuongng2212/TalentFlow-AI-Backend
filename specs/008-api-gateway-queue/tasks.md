# Tasks: API Gateway Queue

**Input**: Design documents from `/specs/008-api-gateway-queue/`
**Prerequisites**: plan.md, spec.md

**Organization**: Tasks are grouped by service boundary and then by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or has no dependency on another task
- **[Story]**: Which user story the task belongs to, such as US1, US2, or US3
- Always include exact file paths in the description

## Path Conventions

- API Gateway: `api-gateway/src/`, `api-gateway/prisma/`, `api-gateway/test/`
- Shared planning docs: `specs/008-api-gateway-queue/`

## Phase 1: Setup And Contract Lock

**Purpose**: Confirm runtime ownership, lock the contract surface, and record the existing queue behavior.

- [x] T001 Review the current runtime entrypoint and affected queue files for the feature in `api-gateway/src/app.module.ts`, `api-gateway/src/queue/queue.module.ts`, and `api-gateway/src/queue/**`
- [x] T002 [P] Capture the queue contract in `specs/008-api-gateway-queue/spec.md` from `api-gateway/src/queue/queue.service.ts`, `api-gateway/src/queue/constants/queue.constants.ts`, and `api-gateway/src/queue/interfaces/cv-uploaded-event.interface.ts`
- [x] T003 [P] Record validation and config requirements in `api-gateway/src/common/config/config.schema.ts` and `api-gateway/src/queue/queue.service.ts`

---

## Phase 2: Foundational Work

**Purpose**: Build the shared prerequisites that block all user stories for this feature.

- [x] T004 Wire `api-gateway/src/queue/queue.module.ts` with `QueueService` as a global module
- [x] T005 [P] Define the publish, health, stats, and topology APIs in `api-gateway/src/queue/queue.service.ts`
- [x] T006 [P] Establish production connection rules, reconnect settings, and topology constants in `api-gateway/src/queue/queue.service.ts` and `api-gateway/src/queue/constants/queue.constants.ts`
- [x] T007 Keep the minimum RabbitMQ client wiring in `api-gateway/src/queue/queue.service.ts`

**Checkpoint**: The queue boundary is wired and user story work can be validated independently.

---

## Phase 3: User Story 1 - Establish Queue Topology (Priority: P1)

**Goal**: Connect to RabbitMQ and establish the CV processing topology.

**Independent Test**: The queue service initializes the exchange, queue, DLQ, and routing binding using the configured settings.

### Tests for User Story 1

- [x] [P] [US1] Cover topology initialization and shutdown behavior in `api-gateway/src/queue/queue.service.spec.ts`

### Implementation for User Story 1

- [x] [US1] Implement queue initialization and topology setup in `api-gateway/src/queue/queue.service.ts`
- [x] [US1] Preserve production connection validation in `api-gateway/src/queue/queue.service.ts`
- [x] [US1] Preserve topology constants in `api-gateway/src/queue/constants/queue.constants.ts`

**Checkpoint**: Queue topology setup should now be fully functional and independently testable.

---

## Phase 4: User Story 2 - Publish CV Upload Events (Priority: P2)

**Goal**: Publish the CV upload event consumed by the parser service.

**Independent Test**: `publishCvUploaded` sends a persistent JSON event to the existing routing key and rejects uninitialized or saturated channels.

### Tests for User Story 2

- [x] [P] [US2] Cover CV upload publish behavior in `api-gateway/src/queue/queue.service.spec.ts`

### Implementation for User Story 2

- [x] [US2] Implement `cv.uploaded` publishing in `api-gateway/src/queue/queue.service.ts`
- [x] [US2] Preserve the CV upload event interface in `api-gateway/src/queue/interfaces/cv-uploaded-event.interface.ts`
- [x] [US2] Preserve the `bucket + fileKey` contract in `api-gateway/src/queue/interfaces/cv-uploaded-event.interface.ts` and `api-gateway/src/queue/queue.service.ts`

**Checkpoint**: CV upload publishing should now be independently testable.

---

## Phase 5: User Story 3 - Observe And Recover Queue Health (Priority: P3)

**Goal**: Report queue health and recover from connection loss.

**Independent Test**: Queue health and stats reflect channel state, and connection loss triggers reconnect scheduling.

### Tests for User Story 3

- [x] [P] [US3] Cover health, stats, reconnect, and failure behavior in `api-gateway/src/queue/queue.service.spec.ts`

### Implementation for User Story 3

- [x] [US3] Implement health, stats, and shutdown behavior in `api-gateway/src/queue/queue.service.ts`
- [x] [US3] Implement reconnect scheduling and connection-loss cleanup in `api-gateway/src/queue/queue.service.ts`
- [x] [US3] Preserve logging and failure sanitization in `api-gateway/src/queue/queue.service.ts` and `api-gateway/src/common/utils/sanitize.util.ts`

**Checkpoint**: Queue observability and recovery should now be independently testable.

---

## Phase 6: Cross-Cutting Validation

**Purpose**: Work that touches multiple stories or service boundaries.

- [x] T024 [P] Update the migrated documentation in `specs/008-api-gateway-queue/spec.md`, `specs/008-api-gateway-queue/plan.md`, and `specs/008-api-gateway-queue/tasks.md`
- [x] T025 [P] Run or update the owning service tests using the real gateway commands in `api-gateway/package.json`
- [x] T026 [P] Preserve observability and failure-path behavior in `api-gateway/src/queue/queue.service.ts`
- [x] T027 Validate backward compatibility for the existing exchange, routing key, queue names, and payload shape in `api-gateway/src/queue/**`

## Gaps Found

- There is no dedicated HTTP e2e test for the queue utility because the boundary is exercised indirectly through upload flows and unit tests.
- The service currently uses scheduled reconnect logic and health checks, but there is no broader broker orchestration layer in this slice.
- No Prisma schema or migration work was required for this slice because RabbitMQ is external messaging infrastructure rather than database persistence.

## Dependencies & Execution Order

### Phase Dependencies

- Setup and contract lock can start immediately.
- Foundational work blocks all user stories.
- User stories can proceed in priority order once the foundation is ready.
- Cross-cutting validation comes after the story slices that it depends on.

### Service-Specific Validation Commands

- API Gateway: `cd api-gateway && npm test -- queue`, `cd api-gateway && npm run build`, `cd api-gateway && npm test`

### Implementation Notes

- Keep tests close to the touched boundary.
- Prefer queue service tests for topology, publish, and reconnect behavior.
- Preserve the bucket-based file contract so downstream CV parsing continues to work.
- Avoid cross-story coupling unless the contract truly requires it.

## Notes

- [P] tasks can run in parallel because they touch different files with no dependency.
- Each user story is independently completable and testable.
- This feature is already present in runtime code; the tasks document records what exists rather than a work queue to execute.