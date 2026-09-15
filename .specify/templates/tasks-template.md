---
description: "Task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by service boundary and then by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on another task
- **[Story]**: Which user story this task belongs to, such as US1, US2, or US3
- Always include exact file paths in the description

## Path Conventions

- API Gateway: `api-gateway/src/`, `api-gateway/prisma/`, `api-gateway/test/`
- CV Parser: `cv-parser/src/main/java/com/talentflow/cvparser/`, `cv-parser/src/test/java/com/talentflow/cvparser/`
- Notification: `notification/src/`, `notification/prisma/`, `notification/test/unit/`, `notification/test/integration/`
- Shared planning docs: `specs/[###-feature-name]/`

## Service Routing

- Start with `api-gateway/` when the feature is HTTP-facing or changes auth, storage, queue production, metrics, or Prisma schema.
- Start with `cv-parser/` when the feature is queue-consuming, parsing, OCR, or extraction work.
- Start with `notification/` when the feature is mail, websocket, notification persistence, or RabbitMQ consumption for the notification service.
- If the feature crosses services, include producer and consumer tasks in the same phase.

## Phase 1: Setup And Contract Lock

**Purpose**: Confirm runtime ownership, lock the contract surface, and create only the files required for the feature slice.

- [ ] T001 Review the current runtime entrypoint and affected service files for the feature in the owning module
- [ ] T002 [P] Draft or update contract notes in `specs/[###-feature-name]/contracts/`
- [ ] T003 [P] Add or update validation and config requirements in the owning service

---

## Phase 2: Foundational Work

**Purpose**: Build the shared prerequisites that block all user stories for this feature.

- [ ] T004 Update schema, migration, or contract shape required by the feature
- [ ] T005 [P] Add new DTOs, shared types, or event interfaces at the service boundary
- [ ] T006 [P] Add or update config validation, guards, or middleware needed before feature work
- [ ] T007 Establish the minimum persistence, queue, or storage wiring required by the feature

**Checkpoint**: The service boundary is ready and user story work can begin.

---

## Phase 3: User Story 1 - [Title] (Priority: P1)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this slice works on its own]

### Tests for User Story 1

- [ ] T008 [P] [US1] Add or update the boundary test in the owning service test folder
- [ ] T009 [P] [US1] Add or update the focused integration or e2e test for the primary user path

### Implementation for User Story 1

- [ ] T010 [P] [US1] Add or update the entity, DTO, or interface in the owning module
- [ ] T011 [US1] Implement the service or use case in the owning service folder
- [ ] T012 [US1] Wire the controller, consumer, or handler in the owning service entrypoint
- [ ] T013 [US1] Add validation, mapping, and error handling for the feature boundary

**Checkpoint**: User Story 1 should now be fully functional and independently testable.

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this slice works on its own]

### Tests for User Story 2

- [ ] T014 [P] [US2] Add or update the second boundary test in the owning service test folder
- [ ] T015 [P] [US2] Add or update the second focused integration or e2e test

### Implementation for User Story 2

- [ ] T016 [P] [US2] Add or update the supporting model, DTO, or interface
- [ ] T017 [US2] Implement the second service path or handler
- [ ] T018 [US2] Integrate with User Story 1 behavior only if the contract requires it

**Checkpoint**: User Stories 1 and 2 should both work independently.

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this slice works on its own]

### Tests for User Story 3

- [ ] T019 [P] [US3] Add or update the third boundary test in the owning service test folder
- [ ] T020 [P] [US3] Add or update the third focused integration or e2e test

### Implementation for User Story 3

- [ ] T021 [P] [US3] Add or update the supporting model, DTO, or interface
- [ ] T022 [US3] Implement the third service path or handler
- [ ] T023 [US3] Integrate with earlier stories only if the feature requires it

**Checkpoint**: All prioritized user stories should now be independently functional.

---

## Phase 6: Cross-Cutting Validation

**Purpose**: Work that touches multiple stories or service boundaries.

- [ ] T024 [P] Update documentation in `specs/[###-feature-name]/` and any runtime guidance files impacted by the feature
- [ ] T025 [P] Run or update the owning service tests using the real commands for that service
- [ ] T026 [P] Add observability, security, or failure-path hardening if required
- [ ] T027 Validate backward compatibility or provide a migration note if contracts changed

### Real Commands To Use

- API Gateway: `cd api-gateway && npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`
- CV Parser: `cd cv-parser && mvn test`
- Notification: `cd notification && npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup and contract lock can start immediately.
- Foundational work blocks all user stories.
- User stories can proceed in priority order once the foundation is ready.
- Cross-cutting validation comes after the story slices that it depends on.

### Service-Specific Validation Commands

- API Gateway: `cd api-gateway && npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`
- CV Parser: `cd cv-parser && mvn test`
- Notification: `cd notification && npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`

### Implementation Notes

- Keep tests close to the touched boundary.
- Prefer producer/consumer checks for queue changes.
- Prefer schema and migration alignment for persistence changes.
- Avoid cross-story coupling unless the contract truly requires it.

## Notes

- [P] tasks can run in parallel because they touch different files with no dependency.
- Each user story should be independently completable and testable.
- Verify tests fail before implementing when tests are part of the feature scope.
- Verify tests fail before implementing when tests are part of the feature scope. For non-trivial changes, tests MUST be authored and failing before implementation (TDD).
- Stop at a checkpoint to validate the slice before broadening scope.
