# Tasks: Subscription Plans

**Input**: Design documents from `/specs/015-subscription-plans/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by service boundary and then by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on another task
- **[Story]**: Which user story this task belongs to, such as US1, US2, or US3
- Always include exact file paths in the description

## Path Conventions

- API Gateway: `api-gateway/src/`, `api-gateway/prisma/`, `api-gateway/test/`
- Shared planning docs: `specs/015-subscription-plans/`

## Phase 1: Setup And Contract Lock

**Purpose**: Confirm API Gateway runtime ownership, lock the subscription contract surface, and prepare the subscription module skeleton.

- [x] T001 Review API Gateway auth, workspace, app module, Prisma schema, and subscription contract files in `api-gateway/src/auth/auth.service.ts`, `api-gateway/src/workspaces/workspaces.service.ts`, `api-gateway/src/app.module.ts`, `api-gateway/prisma/schema.prisma`, and `specs/015-subscription-plans/contracts/subscription-plans.openapi.yaml`
- [x] T002 [P] Create subscription module directory structure in `api-gateway/src/subscriptions/`, `api-gateway/src/subscriptions/dto/`, and `api-gateway/src/subscriptions/interfaces/`
- [x] T003 [P] Add subscription plan constants and runtime policy types in `api-gateway/src/subscriptions/interfaces/subscription-policy.interface.ts`

---

## Phase 2: Foundational Work

**Purpose**: Build schema, migration, DTOs, and module wiring required by all subscription stories.

- [x] T004 Update Prisma subscription enums, models, and relationships in `api-gateway/prisma/schema.prisma`
- [x] T005 Add Prisma migration SQL for subscription plans, user subscriptions, workspace subscriptions, and AI usage records in `api-gateway/prisma/migrations/20260606000000_add_subscription_plans/migration.sql`
- [x] T006 [P] Add subscription DTOs in `api-gateway/src/subscriptions/dto/entitlement-check.dto.ts`
- [x] T007 [P] Add subscription response interfaces in `api-gateway/src/subscriptions/interfaces/subscription-response.interface.ts`
- [x] T008 Create `SubscriptionsService` plan catalog, status, activation, and quota scaffolding in `api-gateway/src/subscriptions/subscriptions.service.ts`
- [x] T009 Create `SubscriptionsController` HTTP surface in `api-gateway/src/subscriptions/subscriptions.controller.ts`
- [x] T010 Wire `SubscriptionsModule` into `api-gateway/src/subscriptions/subscriptions.module.ts` and `api-gateway/src/app.module.ts`

**Checkpoint**: API Gateway has a compiled subscription boundary and Prisma schema shape.

---

## Phase 3: User Story 1 - Default Free Plan For New Accounts (Priority: P1)

**Goal**: New accounts receive Free by default and Free users can consume limited personal AI scoring.

**Independent Test**: Create a new account, verify Free personal entitlement, then check and consume Free CV scoring until daily and trial limits are enforced.

### Tests for User Story 1

- [x] T011 [P] [US1] Add Free default and Free quota unit tests in `api-gateway/src/subscriptions/subscriptions.service.spec.ts`
- [x] T012 [P] [US1] Update signup unit test coverage for Free entitlement creation in `api-gateway/src/auth/auth.service.spec.ts`

### Implementation for User Story 1

- [x] T013 [US1] Implement idempotent Free plan catalog and default Free subscription creation in `api-gateway/src/subscriptions/subscriptions.service.ts`
- [x] T014 [US1] Integrate Free entitlement creation into account signup in `api-gateway/src/auth/auth.service.ts` and `api-gateway/src/auth/auth.module.ts`
- [x] T015 [US1] Implement personal Free entitlement check and quota consumption for `CV_SCORE` in `api-gateway/src/subscriptions/subscriptions.service.ts`
- [x] T016 [US1] Expose plan list, personal status, and entitlement check endpoints in `api-gateway/src/subscriptions/subscriptions.controller.ts`

**Checkpoint**: User Story 1 is functional and independently testable.

---

## Phase 4: User Story 2 - Plus Plan For Individual Users (Priority: P2)

**Goal**: Users can activate Plus for personal space, receive 20 daily AI requests, and unlock CV fit analysis.

**Independent Test**: Activate Plus for a user, verify personal status, consume 20 personal requests, and verify CV fit analysis is allowed only under Plus.

### Tests for User Story 2

- [x] T017 [P] [US2] Add Plus activation and personal quota tests in `api-gateway/src/subscriptions/subscriptions.service.spec.ts`
- [x] T018 [P] [US2] Add Plus controller tests in `api-gateway/src/subscriptions/subscriptions.controller.spec.ts`

### Implementation for User Story 2

- [x] T019 [US2] Implement Plus activation and one-month period handling in `api-gateway/src/subscriptions/subscriptions.service.ts`
- [x] T020 [US2] Implement Plus permission checks for `CV_FIT_ANALYSIS` in `api-gateway/src/subscriptions/subscriptions.service.ts`
- [x] T021 [US2] Expose Plus activation endpoint in `api-gateway/src/subscriptions/subscriptions.controller.ts`

**Checkpoint**: User Stories 1 and 2 work independently in personal space.

---

## Phase 5: User Story 3 - Business Plan Activates Workspace (Priority: P3)

**Goal**: Business activates workspace entitlement, purchaser administration, member invitation, role assignment support, and a shared 500 daily AI request pool.

**Independent Test**: Activate Business for a workspace, verify member invitation requires Business entitlement, and consume workspace AI requests against the workspace pool.

### Tests for User Story 3

- [x] T022 [P] [US3] Add Business workspace entitlement and quota tests in `api-gateway/src/subscriptions/subscriptions.service.spec.ts`
- [x] T023 [P] [US3] Update workspace member gating tests in `api-gateway/src/workspaces/workspaces.service.spec.ts`

### Implementation for User Story 3

- [x] T024 [US3] Implement Business workspace activation and purchaser admin preservation in `api-gateway/src/subscriptions/subscriptions.service.ts`
- [x] T025 [US3] Replace workspace `isBusiness` invite gating with active Business entitlement in `api-gateway/src/workspaces/workspaces.service.ts` and `api-gateway/src/workspaces/workspaces.module.ts`
- [x] T026 [US3] Implement workspace context entitlement and 500 daily quota consumption in `api-gateway/src/subscriptions/subscriptions.service.ts`
- [x] T027 [US3] Expose workspace subscription status and Business activation endpoints in `api-gateway/src/subscriptions/subscriptions.controller.ts`

**Checkpoint**: Business workspaces are independently functional.

---

## Phase 6: User Story 4 - Resolve Plus And Workspace Context (Priority: P4)

**Goal**: A Plus user in a Business workspace consumes the correct quota pool based on personal or workspace context.

**Independent Test**: Give a user Plus and Business workspace membership, exhaust one quota pool, and verify the other context still follows its own rules without overflow.

### Tests for User Story 4

- [x] T028 [P] [US4] Add mixed Plus and Business context tests in `api-gateway/src/subscriptions/subscriptions.service.spec.ts`
- [x] T029 [P] [US4] Add focused subscription e2e scenarios in `api-gateway/test/subscriptions.e2e-spec.ts`

### Implementation for User Story 4

- [x] T030 [US4] Implement explicit context resolution and no-overflow behavior in `api-gateway/src/subscriptions/subscriptions.service.ts`
- [x] T031 [US4] Add denial reason mapping and quota status output for mixed contexts in `api-gateway/src/subscriptions/subscriptions.controller.ts`

**Checkpoint**: Plus and Business permissions are separated by context.

---

## Phase 7: Cross-Cutting Validation

**Purpose**: Final hardening, docs, generation, and validation.

- [x] T032 [P] Update API Gateway seed or startup guidance for fixed plan catalog in `api-gateway/prisma/seed.ts`
- [x] T033 [P] Confirm generated planning artifacts remain aligned in `specs/015-subscription-plans/plan.md`, `specs/015-subscription-plans/data-model.md`, and `specs/015-subscription-plans/contracts/subscription-plans.openapi.yaml`
- [x] T034 Run Prisma generation for the gateway using `cd api-gateway && npx prisma generate`
- [ ] T035 Run focused subscription and workspace tests using `cd api-gateway && npm test -- subscriptions workspaces`
- [x] T036 Run API Gateway build using `cd api-gateway && npm run build`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 can start immediately.
- Phase 2 blocks all user stories because schema, DTOs, and module wiring are shared.
- US1 is the MVP and should complete before Plus and Business.
- US2 depends on the personal entitlement foundation from US1.
- US3 depends on subscription persistence and workspace membership integration.
- US4 depends on US2 and US3 because it verifies context separation between both plan types.
- Phase 7 runs after all story slices are implemented.

### Parallel Opportunities

- T002 and T003 can run in parallel after T001.
- T006 and T007 can run in parallel after schema decisions are stable.
- Story test tasks marked [P] can be drafted before implementation tasks in the same phase.
- T032 and T033 can run in parallel during final validation.

### Implementation Strategy

- MVP first: complete US1 so account signup and Free quota are reliable.
- Then add Plus personal behavior without touching workspace permission.
- Then add Business workspace activation and replace temporary business flag gating.
- Finally verify mixed Plus plus workspace context so quota pools never overflow into each other.

### Real Commands To Use

- API Gateway subscription tests: `cd api-gateway && npm test -- subscriptions`
- API Gateway focused tests: `cd api-gateway && npm test -- subscriptions workspaces`
- API Gateway build: `cd api-gateway && npm run build`
- Prisma generation: `cd api-gateway && npx prisma generate`
