# Tasks: API Gateway CV Event Orchestration

**Input**: Design documents from `/specs/017-api-gateway-cv-event-orchestration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/events.md

**Organization**: Tasks are grouped by service boundary and then by user story so each slice can be implemented and tested independently.

## Phase 1: Setup And Contract Lock

**Purpose**: Confirm runtime ownership, lock the contract surface, and create only the files required for the feature slice.

- [X] T001 Review the current application service and queue service logic in `api-gateway/src/applications/` and `api-gateway/src/queue/`
- [X] T002 [P] Draft or update contract notes in `specs/017-api-gateway-cv-event-orchestration/contracts/events.md`
- [X] T003 [P] Add or update configuration requirements for new events in `api-gateway/src/common/config/config.schema.ts`

## Phase 2: Foundational Work

**Purpose**: Build the shared prerequisites that block all user stories for this feature.

- [X] T004 Update schema in `api-gateway/prisma/schema.prisma` to add `cvParsingStatus`, `aiScore`, `scoringReasoning`, and `parsedData` to the `Application` model, and generate migration
- [X] T005 [P] Add raw and enriched event interfaces in `api-gateway/src/queue/interfaces/cv-events.interface.ts`
- [X] T006 [P] Add queue consumer bindings configuration for the `talentflow.events` exchange in `api-gateway/src/queue/queue.module.ts`
- [X] T007 Add necessary DTOs or shared types for CV parsing status in `api-gateway/src/applications/dto/` and `api-gateway/src/applications/entities/application.entity.ts`

**Checkpoint**: The service boundary is ready and user story work can begin.

## Phase 3: User Story 1 - Process Successful CV Parsing Event (Priority: P1)

**Goal**: Consume raw success parsing event, update DB, enrich context, and publish enriched success event.

**Independent Test**: Provide a mock `cv.parsed` event, verify `Application` entity updates with score/data, and assert an enriched success event is published.

### Tests for User Story 1

- [X] T008 [P] [US1] Add unit test for handling successful parsing event in `api-gateway/src/applications/applications.service.spec.ts`
- [X] T009 [P] [US1] Add consumer unit test for `cv.parsed` in `api-gateway/src/queue/queue.service.spec.ts`

### Implementation for User Story 1

- [X] T010 [US1] Implement `handleCvParsedEvent` in `api-gateway/src/applications/applications.service.ts` to enrich the event and update the application record
- [X] T011 [US1] Implement the RabbitMQ consumer for `cv.parsed` and wire it to publish the enriched success event in `api-gateway/src/queue/queue.service.ts`

**Checkpoint**: User Story 1 should now be fully functional and independently testable.

## Phase 4: User Story 2 - Process Failed CV Parsing Event (Priority: P1)

**Goal**: Consume raw failure parsing event, update DB status, enrich context, and publish enriched failure event.

**Independent Test**: Provide a mock `cv.failed` event, verify `Application` entity updates to failed status, and assert an enriched failure event is published.

### Tests for User Story 2

- [X] T012 [P] [US2] Add unit test for handling failed parsing event in `api-gateway/src/applications/applications.service.spec.ts`
- [X] T013 [P] [US2] Add consumer unit test for `cv.failed` in `api-gateway/src/queue/queue.service.spec.ts`

### Implementation for User Story 2

- [X] T014 [US2] Implement `handleCvFailedEvent` in `api-gateway/src/applications/applications.service.ts` to enrich the event and update the application status to FAILED
- [X] T015 [US2] Implement the RabbitMQ consumer for `cv.failed` and wire it to publish the enriched failure event in `api-gateway/src/queue/queue.service.ts`

**Checkpoint**: User Stories 1 and 2 should both work independently.

## Phase 5: Cross-Cutting Validation

**Purpose**: Work that touches multiple stories or service boundaries.

- [X] T016 [P] Add dead-letter queue (DLQ) safeguards and structured logging for failed event consumptions in `api-gateway/src/queue/queue.service.ts`
- [X] T017 [P] Run API Gateway tests via `cd api-gateway && npm test` and `npm run test:e2e` to validate boundaries
- [X] T018 Update documentation in `specs/017-api-gateway-cv-event-orchestration/` to reflect implemented event topologies and testing methods

## Dependencies & Execution Order

- Setup and foundational work (T001-T007) must be completed first to establish schema and contracts.
- User Story 1 (T008-T011) and User Story 2 (T012-T015) can proceed in parallel once foundational work is ready.
- Cross-cutting validation (T016-T018) concludes the execution.
