# Tasks: Notification Service

**Input**: Design documents from `/specs/013-notification/`
**Prerequisites**: plan.md, spec.md

**Organization**: Tasks are grouped by service boundary and then by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or has no dependency on another task
- **[Story]**: Which user story the task belongs to, such as US1, US2, or US3
- Always include exact file paths in the description

## Path Conventions

- Notification service: `notification/src/`, `notification/test/`
- Shared planning docs: `specs/013-notification/`

## Phase 1: Setup And Contract Lock

**Purpose**: Confirm runtime ownership, lock the contract surface, and record the existing notification behavior.

- [x] T001 Review the current runtime entrypoint and affected notification files for the feature in `notification/src/app.module.ts`, `notification/src/notification/notification.module.ts`, and `notification/src/**`
- [x] T002 [P] Capture the notification HTTP and email contract in `specs/013-notification/spec.md` from `notification/src/notification/notification.controller.ts`, `notification/src/notification/dto/*.ts`, and `notification/src/notification/notification.service.ts`
- [x] T003 [P] Record validation, auth, throttling, email retry, and health requirements in `notification/src/notification/dto/*.ts`, `notification/src/auth/*.ts`, and `notification/src/health/*.ts`

---

## Phase 2: Foundational Work

**Purpose**: Build the shared prerequisites that block all user stories for this feature.

- [x] T004 Wire `notification/src/notification/notification.module.ts` with `NotificationController` and `NotificationService`
- [x] T005 [P] Define the request and response DTOs in `notification/src/notification/dto/send-notification.dto.ts` and `notification/src/notification/dto/notification-response.dto.ts`
- [x] T006 [P] Establish the email template mapping and retry behavior in `notification/src/email/email.service.ts` and `notification/src/email/email-template.ts`
- [x] T007 Keep the minimum JWT, RabbitMQ, and health wiring in `notification/src/auth/*.ts`, `notification/src/rabbitmq/*.ts`, and `notification/src/health/*.ts`

**Checkpoint**: The notification boundary is wired and user story work can be validated independently.

---

## Phase 3: User Story 1 - Send an Email Notification (Priority: P1)

**Goal**: Return a sent notification response for authenticated callers.

**Independent Test**: `POST /api/notifications/send` sends a plain-body or template-backed email and returns the notification response shape.

### Tests for User Story 1

- [x] [P] [US1] Cover email send behavior in `notification/src/email/email.service.spec.ts`
- [x] [P] [US1] Cover JWT protection and request handling in `notification/src/auth/jwt-auth.guard.spec.ts` and `notification/src/notification/notification.controller.ts` if controller spec is present

### Implementation for User Story 1

- [x] [US1] Implement send-notification handler in `notification/src/notification/notification.controller.ts`
- [x] [US1] Implement email send and response synthesis in `notification/src/notification/notification.service.ts`
- [x] [US1] Preserve send-notification validation in `notification/src/notification/dto/send-notification.dto.ts`

**Checkpoint**: Email notification sending should now be fully functional and independently testable.

---

## Phase 4: User Story 2 - Retrieve a Notification View (Priority: P2)

**Goal**: Return a notification view payload for authenticated callers.

**Independent Test**: `GET /api/notifications/:id` returns the live notification response shape for the caller.

### Tests for User Story 2

- [x] [P] [US2] Cover lookup behavior in `notification/src/notification/notification.controller.ts` and `notification/src/notification/notification.controller.spec.ts` if present
- [x] [P] [US2] Cover response-shape synthesis in `notification/src/notification/notification.service.ts`

### Implementation for User Story 2

- [x] [US2] Implement notification lookup handler in `notification/src/notification/notification.controller.ts`
- [x] [US2] Implement response synthesis in `notification/src/notification/notification.service.ts`
- [x] [US2] Preserve response DTO shape in `notification/src/notification/dto/notification-response.dto.ts`

**Checkpoint**: Notification lookup should now be independently testable.

---

## Phase 5: User Story 3 - Check Service Readiness And RabbitMQ Health (Priority: P3)

**Goal**: Return liveness and readiness checks for operators.

**Independent Test**: `/health`, `/health/ready`, and `/health/live` return the expected statuses and readiness depends on database and RabbitMQ checks.

### Tests for User Story 3

- [x] [P] [US3] Cover health behavior in `notification/src/health/health.controller.ts` and `notification/src/health/rabbitmq.health.ts`
- [x] [P] [US3] Cover RabbitMQ connection lifecycle behavior in `notification/src/rabbitmq/rabbitmq.service.ts`

### Implementation for User Story 3

- [x] [US3] Implement health routes in `notification/src/health/health.controller.ts`
- [x] [US3] Implement RabbitMQ readiness and reconnect behavior in `notification/src/rabbitmq/rabbitmq.service.ts`
- [x] [US3] Preserve database readiness checks in `notification/src/health/health.controller.ts`

**Checkpoint**: Health and readiness reporting should now be independently testable.

---

## Phase 6: Cross-Cutting Validation

**Purpose**: Work that touches multiple stories or service boundaries.

- [x] T024 [P] Update the migrated documentation in `specs/013-notification/spec.md`, `specs/013-notification/plan.md`, and `specs/013-notification/tasks.md`
- [x] T025 [P] Run or update the owning service tests using the real notification commands in `notification/package.json`
- [x] T026 [P] Preserve observability and failure-path behavior in `notification/src/email/email.service.ts`, `notification/src/health/health.controller.ts`, and `notification/src/rabbitmq/rabbitmq.service.ts`
- [x] T027 Validate backward compatibility for the existing route names, DTO field names, and response shape in `notification/src/**`

## Gaps Found

- The notification consumer and websocket gateway files are empty, so the runtime does not yet provide event-driven delivery or websocket push despite the scaffolded files.
- There is no dedicated HTTP controller e2e test that drives the notification routes through the full Nest runtime; current coverage is primarily unit-level around email, guards, and helper behavior.
- No persisted notification schema or repository exists in the current runtime slice, so `GET /api/notifications/:id` is a synthesized view rather than a database lookup.

## Dependencies & Execution Order

### Phase Dependencies

- Setup and contract lock can start immediately.
- Foundational work blocks all user stories.
- User stories can proceed in priority order once the foundation is ready.
- Cross-cutting validation comes after the story slices that it depends on.

### Service-Specific Validation Commands

- Notification: `cd notification && npm test`, `cd notification && npm run build`, `cd notification && npm test -- email`

### Implementation Notes

- Keep tests close to the touched boundary.
- Prefer controller, email, and health tests for notification workflows.
- Preserve JWT protection and throttling so the public send surface stays constrained.
- Avoid cross-story coupling unless the contract truly requires it.

## Notes

- [P] tasks can run in parallel because they touch different files with no dependency.
- Each user story is independently completable and testable.
- This feature is already present in runtime code; the tasks document records what exists rather than a work queue to execute.
