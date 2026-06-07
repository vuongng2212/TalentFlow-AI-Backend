# Tasks: Workspace Multi-Tenancy

**Input**: Design documents from `specs/016-workspace-multi-tenancy/`
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
- Shared planning docs: `specs/016-workspace-multi-tenancy/`

## Service Routing

- Start with `api-gateway/` when the feature is HTTP-facing or changes auth, storage, queue production, metrics, or Prisma schema.
- Start with `cv-parser/` when the feature is queue-consuming, parsing, OCR, or extraction work.
- Start with `notification/` when the feature is mail, websocket, notification persistence, or RabbitMQ consumption for the notification service.
- If the feature crosses services, include producer and consumer tasks in the same phase.

---

## Phase 1: Setup And Contract Lock

**Purpose**: Confirm runtime ownership, lock the contract surface, and create only the files required for the feature slice.

- [ ] T001 Review current database fields and mappings in api-gateway/prisma/schema.prisma
- [ ] T002 [P] Update api-headers and rabbitmq-events contracts in specs/016-workspace-multi-tenancy/contracts/api-headers.md and specs/016-workspace-multi-tenancy/contracts/rabbitmq-events.md
- [ ] T003 [P] Add environment variables config validation in api-gateway/src/common/config/config.schema.ts

---

## Phase 2: Foundational Work

**Purpose**: Build the shared prerequisites that block all user stories for this feature.

- [ ] T004 Update Prisma schema model definitions in api-gateway/prisma/schema.prisma
- [ ] T005 Generate Prisma client and create a custom SQL migration script in api-gateway/prisma/migrations/
- [ ] T006 [P] Create the workspace context guard to resolve request workspace in api-gateway/src/auth/guards/workspace-context.guard.ts
- [ ] T007 [P] Create the workspace roles guard and roles decorator in api-gateway/src/auth/guards/workspace-roles.guard.ts and api-gateway/src/auth/decorators/workspace-roles.decorator.ts
- [ ] T008 Register workspace guards globally in api-gateway/src/app.module.ts

**Checkpoint**: The service boundary is ready and user story work can begin.

---

## Phase 3: User Story 1 - Workspace-Centric Collaboration (Priority: P1)

**Goal**: View, edit, and collaborate on Jobs and Candidates created by other members of the same Workspace.

**Independent Test**: Send a GET `/jobs` request with the `x-workspace-id` header of a shared workspace; verify it returns jobs created by all active workspace members.

### Tests for User Story 1

- [ ] T009 [P] [US1] Implement unit tests for isolation checks in api-gateway/src/jobs/jobs.service.spec.ts and api-gateway/src/candidates/candidates.service.spec.ts
- [ ] T010 [P] [US1] Create integration e2e test for multi-tenant isolation in api-gateway/test/jobs-isolation.e2e-spec.ts

### Implementation for User Story 1

- [ ] T011 [P] [US1] Create workspace context helper service in api-gateway/src/common/services/workspace-context.service.ts
- [ ] T012 [US1] Refactor JobsService to query by workspace context in api-gateway/src/jobs/jobs.service.ts
- [ ] T013 [US1] Refactor CandidatesService to query and enforce uniqueness by workspace in api-gateway/src/candidates/candidates.service.ts
- [ ] T014 [US1] Refactor applications, interviews, and email-templates services to query by workspace in api-gateway/src/applications/applications.service.ts, api-gateway/src/interviews/interviews.service.ts, and api-gateway/src/email-templates/email-templates.service.ts
- [ ] T015 [US1] Update controllers to accept header and document via Swagger in api-gateway/src/jobs/jobs.controller.ts, api-gateway/src/candidates/candidates.controller.ts, api-gateway/src/applications/applications.controller.ts, and api-gateway/src/interviews/interviews.controller.ts

**Checkpoint**: User Story 1 should now be fully functional and independently testable.

---

## Phase 4: User Story 2 - Workspace Context Resolution and Switching (Priority: P2)

**Goal**: Switch between Personal Workspace and Business Workspaces without logging out.

**Independent Test**: Call `PATCH /users/active-workspace` with a target workspace ID, then perform subsequent GET requests without the `x-workspace-id` header and verify they return data from the newly selected active workspace.

### Tests for User Story 2

- [ ] T016 [P] [US2] Create unit tests for active workspace switching in api-gateway/src/users/users.service.spec.ts
- [ ] T017 [P] [US2] Create integration e2e test for context fallback and active workspace patching in api-gateway/test/workspace-switching.e2e-spec.ts

### Implementation for User Story 2

- [ ] T018 [P] [US2] Create switch workspace DTO in api-gateway/src/users/dto/switch-workspace.dto.ts
- [ ] T019 [US2] Implement active workspace switching in api-gateway/src/users/users.service.ts
- [ ] T020 [US2] Expose active workspace patch endpoint in api-gateway/src/users/users.controller.ts
- [ ] T021 [US2] Modify UsersService creation flow to atomically provision a default Personal Workspace during signup inside a database transaction in api-gateway/src/users/users.service.ts

**Checkpoint**: User Stories 1 and 2 should both work independently.

---

## Phase 5: User Story 3 - Secure Token-Based Invitation Flow (Priority: P3)

**Goal**: Invite new members via email and have them accept the invitation through a secure token-based flow.

**Independent Test**: Call `POST /workspaces/:id/invitations` to generate an invitation token and check that the membership is created in `INVITED` status, then call `POST /workspaces/invitations/accept` with the token to verify it transitions to `ACTIVE`.

### Tests for User Story 3

- [ ] T022 [P] [US3] Create unit tests for invitation endpoints in api-gateway/src/workspaces/workspaces.service.spec.ts
- [ ] T023 [P] [US3] Create integration e2e test for invitation acceptance in api-gateway/test/workspace-invitations.e2e-spec.ts

### Implementation for User Story 3

- [ ] T024 [P] [US3] Create invitation DTO and event interface in api-gateway/src/workspaces/dto/create-invitation.dto.ts and api-gateway/src/queue/interfaces/workspace-member-invited-event.interface.ts
- [ ] T025 [US3] Implement invitation generation and acceptance in api-gateway/src/workspaces/workspaces.service.ts
- [ ] T026 [US3] Expose workspace invitation routes in api-gateway/src/workspaces/workspaces.controller.ts
- [ ] T027 [US3] Add the RabbitMQ event publishing logic for workspace invitations in api-gateway/src/queue/queue.service.ts
- [ ] T028 [US3] Implement RabbitMQ event consumer for workspace invitation email dispatch in notification/src/rabbitmq/notification.consumer.ts
- [ ] T029 [P] [US3] Define workspace invitation DTO in notification/src/rabbitmq/dtos/workspace-member-invited.dto.ts
- [ ] T030 [P] [US3] Define workspace invitation email template in notification/src/email/templates/workspace-invitation.hbs
- [ ] T031 [US3] Implement workspace invitation email sending in notification/src/notification/notification.service.ts

**Checkpoint**: All prioritized user stories should now be independently functional.

---

## Phase 6: Cross-Cutting Validation

**Purpose**: Work that touches multiple stories or service boundaries.

- [ ] T032 [P] Update local verification steps in specs/016-workspace-multi-tenancy/quickstart.md
- [ ] T033 [P] Run code quality and formatting checks across api-gateway/ and notification/
- [ ] T034 [P] Execute full unit and e2e test suites in api-gateway/ and notification/
- [ ] T035 Verify production builds compile cleanly in api-gateway/ and notification/

### Real Commands To Use

- API Gateway: `cd api-gateway && npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`
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
- Notification: `cd notification && npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`

### Parallel Execution Examples

- **User Story 1**: Tasks `T009`, `T010`, and `T011` can be worked on in parallel as they touch independent unit/e2e tests and the helper service.
- **User Story 2**: Tasks `T016`, `T017`, and `T018` can be worked on in parallel.
- **User Story 3**: Tasks `T022`, `T023`, `T024`, `T028`, `T029`, and `T030` can be worked on in parallel.

### Implementation Strategy

We will adopt an **MVP-first** strategy:
1. Complete Setup and Foundational phases.
2. Deliver **User Story 1** first to enable basic collaborative access on jobs and candidates.
3. Deliver **User Story 2** to support seamless switching between workspaces and default personal workspace provisioning on signup.
4. Deliver **User Story 3** to establish the invite/accept workflow spanning both `api-gateway` and `notification` services.
5. Perform final cross-cutting validations.
