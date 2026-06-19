# Tasks: Subscription Billing

**Input**: Design documents from `/specs/016-subscription-billing/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Organization**: Tasks are grouped by API Gateway setup, shared billing foundation, and then by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on another task
- **[Story]**: Which user story this task belongs to, such as US1, US2, US3, or US4
- Always include exact file paths in the description

## Path Conventions

- API Gateway: `api-gateway/src/`, `api-gateway/prisma/`, `api-gateway/test/`
- Shared planning docs: `specs/016-subscription-billing/`
- Reference-only prior feature: `specs/015-subscription-plans/`

## Phase 1: Setup And Contract Lock

**Purpose**: Lock the 016 billing-only surface and use 015 only as a reference for what must be kept, reshaped, or rolled back.

- [X] T001 Review 015 subscription implementation and identify workspace spillover to remove in `specs/015-subscription-plans/tasks.md`, `specs/015-subscription-plans/contracts/subscription-plans.openapi.yaml`, `api-gateway/src/subscriptions/subscriptions.controller.ts`, `api-gateway/src/subscriptions/subscriptions.service.ts`, and `api-gateway/src/workspaces/workspaces.service.ts`
- [X] T002 [P] Confirm 016 contract endpoints and schemas against `specs/016-subscription-billing/contracts/subscription-billing.openapi.yaml`
- [X] T003 [P] Confirm MoMo official NodeJS integration fields and signature inputs in `api-gateway/src/subscriptions/billing/momo.types.ts`
- [X] T004 [P] Add subscription billing config requirements to `api-gateway/src/common/config/config.schema.ts`
- [X] T005 [P] Add config schema tests for MoMo and mock Business workspace id in `api-gateway/src/common/config/config.schema.spec.ts`

---

## Phase 2: Foundational Work

**Purpose**: Build shared persistence, DTOs, MoMo adapter boundaries, and rollback prerequisites that block all user stories.

- [X] T006 Update subscription plan pricing fields, payment transaction models, confirmation audit models, and `UserSubscription.businessWorkspaceId` in `api-gateway/prisma/schema.prisma`
- [X] T007 Add Prisma migration for subscription billing and workspace-coupling rollback in `api-gateway/prisma/migrations/20260612000000_subscription_billing/migration.sql`
- [X] T008 [P] Update plan seed data with paid checkout fields in `api-gateway/prisma/seed.ts`
- [X] T009 [P] Add billing constants including the default mock Business workspace id in `api-gateway/src/subscriptions/constants/subscription.constants.ts`
- [X] T010 [P] Add checkout, MoMo IPN, and internal confirm DTOs in `api-gateway/src/subscriptions/dto/subscription-billing.dto.ts`
- [X] T011 [P] Add payment and subscription response interfaces in `api-gateway/src/subscriptions/interfaces/subscription-billing-response.interface.ts`
- [X] T012 [P] Add MoMo request, response, and result types in `api-gateway/src/subscriptions/billing/momo.types.ts`
- [X] T013 [P] Add MoMo HMAC signature service in `api-gateway/src/subscriptions/billing/momo-signature.service.ts`
- [X] T014 Add MoMo billing client wrapper using the official MoMo NodeJS integration shape in `api-gateway/src/subscriptions/billing/momo-billing.client.ts`
- [X] T015 Wire MoMo billing providers into `api-gateway/src/subscriptions/subscriptions.module.ts`
- [X] T016 Remove workspace-facing subscription controller routes from `api-gateway/src/subscriptions/subscriptions.controller.ts`
- [X] T017 Remove subscription service dependencies on `Workspace`, `WorkspaceMember`, workspace entitlement, workspace quota, and `Workspace.isBusiness` mutation in `api-gateway/src/subscriptions/subscriptions.service.ts`
- [X] T018 Remove subscription coupling from workspace module providers if no longer needed in `api-gateway/src/workspaces/workspaces.module.ts`

**Checkpoint**: API Gateway has a billing-only subscription foundation, MoMo adapter boundary, and no active subscription route that accepts a real workspace id.

---

## Phase 3: User Story 1 - View Available Subscription Plans (Priority: P1)

**Goal**: Signed-in users can view the active Free, Plus, and Business plan catalog, including paid/free and checkout eligibility.

**Independent Test**: Request subscription plans and verify only active supported plans are returned with paid/free metadata and checkout eligibility.

### Tests for User Story 1

- [X] T019 [P] [US1] Update plan listing unit tests for paid/free, price, currency, active status, and checkout eligibility in `api-gateway/src/subscriptions/subscriptions.service.spec.ts`
- [X] T020 [P] [US1] Update plan listing controller tests for the 016 response contract in `api-gateway/src/subscriptions/subscriptions.controller.spec.ts`
- [X] T021 [P] [US1] Add plan listing e2e coverage for `GET /subscriptions/plans` in `api-gateway/test/subscriptions.e2e-spec.ts`

### Implementation for User Story 1

- [X] T022 [US1] Update plan mapping and catalog lookup to include billing fields in `api-gateway/src/subscriptions/subscriptions.service.ts`
- [X] T023 [US1] Update `GET /subscriptions/plans` response mapping in `api-gateway/src/subscriptions/subscriptions.controller.ts`
- [X] T024 [US1] Remove 015-only entitlement/quota fields from plan response interfaces in `api-gateway/src/subscriptions/interfaces/subscription-response.interface.ts`

**Checkpoint**: User Story 1 is functional and independently testable without checkout or confirmation.

---

## Phase 4: User Story 2 - Pay For A Subscription Through MoMo (Priority: P2)

**Goal**: Signed-in users can start MoMo checkout for Plus or Business, and the system creates pending payment records without activating subscriptions.

**Independent Test**: Start checkout for Plus and Business in dev/prod-style config and verify MoMo is used, pending payments are stored, and no paid subscription is active before confirmation.

### Tests for User Story 2

- [X] T025 [P] [US2] Add checkout service tests for Plus, Business, Free rejection, inactive plan rejection, pending payment creation, and no activation in `api-gateway/src/subscriptions/subscriptions.service.spec.ts`
- [X] T026 [P] [US2] Add MoMo billing client tests for request mapping, request id uniqueness, order id uniqueness, and provider response mapping in `api-gateway/src/subscriptions/billing/momo-billing.client.spec.ts`
- [X] T027 [P] [US2] Add signature service tests for official MoMo signing input ordering in `api-gateway/src/subscriptions/billing/momo-signature.service.spec.ts`
- [X] T028 [P] [US2] Add checkout controller tests for `POST /subscriptions/checkout` in `api-gateway/src/subscriptions/subscriptions.controller.spec.ts`
- [X] T029 [P] [US2] Add checkout e2e coverage for `POST /subscriptions/checkout` in `api-gateway/test/subscriptions.e2e-spec.ts`

### Implementation for User Story 2

- [X] T030 [P] [US2] Add checkout request validation in `api-gateway/src/subscriptions/dto/subscription-billing.dto.ts`
- [X] T031 [US2] Implement `createCheckout` to validate paid plans, create pending `PaymentTransaction`, call MoMo, and persist provider checkout data in `api-gateway/src/subscriptions/subscriptions.service.ts`
- [X] T032 [US2] Implement `POST /subscriptions/checkout` in `api-gateway/src/subscriptions/subscriptions.controller.ts`
- [X] T033 [US2] Replace direct Plus activation behavior from 015 with checkout-only behavior in `api-gateway/src/subscriptions/subscriptions.service.ts`
- [X] T034 [US2] Update OpenAPI decorators for checkout responses in `api-gateway/src/subscriptions/subscriptions.controller.ts`

**Checkpoint**: User Stories 1 and 2 work independently; paid plans can enter pending MoMo checkout and cannot activate without confirmation.

---

## Phase 5: User Story 3 - Confirm Payment Internally And Activate Subscription (Priority: P3)

**Goal**: Trusted internal confirmation verifies MoMo success, activates the matching subscription exactly once, and records rejected or duplicate confirmations.

**Independent Test**: Create a pending payment, process successful, duplicate, failed, cancelled, expired, mismatched, and unsigned confirmations, then verify activation happens only for matching successful confirmation.

### Tests for User Story 3

- [X] T035 [P] [US3] Add confirmation service tests for successful activation, duplicate idempotency, failed payment, cancelled payment, expired payment, mismatched amount, mismatched plan, and mismatched user in `api-gateway/src/subscriptions/subscriptions.service.spec.ts`
- [X] T036 [P] [US3] Add MoMo IPN controller tests for valid signature, invalid signature, accepted audit, and rejected audit in `api-gateway/src/subscriptions/subscriptions.controller.spec.ts`
- [X] T037 [P] [US3] Add internal confirmation controller tests for authorization failure and successful activation in `api-gateway/src/subscriptions/subscriptions.controller.spec.ts`
- [X] T038 [P] [US3] Add confirmation e2e coverage for `POST /subscriptions/momo/ipn` and `POST /internal/subscriptions/payments/:paymentId/confirm` in `api-gateway/test/subscriptions.e2e-spec.ts`

### Implementation for User Story 3

- [X] T039 [P] [US3] Add MoMo IPN and internal confirmation validation DTOs in `api-gateway/src/subscriptions/dto/subscription-billing.dto.ts`
- [X] T040 [US3] Implement MoMo result verification, payment matching, confirmation audit creation, and rejected confirmation handling in `api-gateway/src/subscriptions/subscriptions.service.ts`
- [X] T041 [US3] Implement idempotent paid subscription activation with transaction boundaries in `api-gateway/src/subscriptions/subscriptions.service.ts`
- [X] T042 [US3] Implement `POST /subscriptions/momo/ipn` and `POST /internal/subscriptions/payments/:paymentId/confirm` in `api-gateway/src/subscriptions/subscriptions.controller.ts`
- [X] T043 [US3] Add internal confirmation authorization guard or role check in `api-gateway/src/subscriptions/subscriptions.controller.ts`
- [X] T044 [US3] Update `GET /subscriptions/me` to expose active subscription and pending payment state in `api-gateway/src/subscriptions/subscriptions.service.ts`

**Checkpoint**: User Stories 1, 2, and 3 work independently; successful trusted confirmation activates paid subscriptions exactly once.

---

## Phase 6: User Story 4 - Attach Mock Business Workspace Id For Business Activation (Priority: P4)

**Goal**: Confirmed Business subscriptions store the configurable mock Business workspace id without creating or mutating real workspace data.

**Independent Test**: Confirm Business and Plus payments, verify Business includes the mock id, Plus does not, and workspace records/members/roles remain unchanged.

### Tests for User Story 4

- [X] T045 [P] [US4] Add Business mock workspace id activation tests in `api-gateway/src/subscriptions/subscriptions.service.spec.ts`
- [X] T046 [P] [US4] Add Plus activation test asserting `businessWorkspaceId` is absent in `api-gateway/src/subscriptions/subscriptions.service.spec.ts`
- [X] T047 [P] [US4] Add regression tests proving subscription billing does not call workspace create/update/member/role mutations in `api-gateway/src/subscriptions/subscriptions.service.spec.ts`
- [X] T048 [P] [US4] Add e2e coverage for Business activation mock id and no workspace mutation in `api-gateway/test/subscriptions.e2e-spec.ts`

### Implementation for User Story 4

- [X] T049 [US4] Load and validate `SUBSCRIPTION_BUSINESS_WORKSPACE_ID` or fallback constant for Business activation in `api-gateway/src/subscriptions/subscriptions.service.ts`
- [X] T050 [US4] Persist `businessWorkspaceId` only for Business subscriptions in `api-gateway/src/subscriptions/subscriptions.service.ts`
- [X] T051 [US4] Ensure `businessWorkspaceId` is a plain string and not a foreign key relation in `api-gateway/prisma/schema.prisma`
- [X] T052 [US4] Remove or quarantine 015 workspace subscription model usage from active subscription responses in `api-gateway/src/subscriptions/interfaces/subscription-response.interface.ts`
- [X] T053 [US4] Update `GET /subscriptions/me` response to include `businessWorkspaceId` only for Business in `api-gateway/src/subscriptions/subscriptions.controller.ts`

**Checkpoint**: All user stories are independently functional and Business billing remains subscription-only.

---

## Phase 7: Cross-Cutting Validation

**Purpose**: Final hardening, documentation alignment, generation, and service-local verification.

- [X] T054 [P] Update quickstart notes if implementation paths differ in `specs/016-subscription-billing/quickstart.md`
- [X] T055 [P] Update contract notes if endpoint behavior changes in `specs/016-subscription-billing/contracts/subscription-billing.openapi.yaml`
- [X] T056 [P] Remove stale 015-style workspace subscription assertions from `api-gateway/src/subscriptions/subscriptions.controller.spec.ts`
- [X] T057 [P] Remove stale 015-style workspace entitlement/quota assertions from `api-gateway/src/subscriptions/subscriptions.service.spec.ts`
- [X] T058 Run Prisma generation for the gateway after schema changes in `api-gateway/prisma/schema.prisma` using `cd api-gateway && npx prisma generate`
- [X] T059 Run focused subscription tests defined by `api-gateway/package.json` using `cd api-gateway && npm test -- subscriptions`
- [X] T060 Run focused subscription e2e tests defined by `api-gateway/test/jest-e2e.json` using `cd api-gateway && npm run test:e2e -- subscriptions`
- [X] T061 Run API Gateway build defined by `api-gateway/package.json` using `cd api-gateway && npm run build`
- [X] T062 Run API Gateway lint defined by `api-gateway/package.json` using `cd api-gateway && npm run lint`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 can start immediately.
- Phase 2 blocks all user stories because schema, config, DTOs, MoMo adapter wiring, and workspace rollback are shared.
- US1 is the MVP and can complete after Phase 2 without MoMo network success.
- US2 depends on US1 plan metadata and Phase 2 payment persistence.
- US3 depends on US2 pending payment creation.
- US4 depends on US3 activation and confirms Business-specific behavior.
- Phase 7 runs after all story slices are implemented.

### Parallel Opportunities

- T002, T003, T004, and T005 can run in parallel after T001.
- T008 through T013 can run in parallel after T006 and T007 are drafted.
- Story test tasks marked [P] can be written before implementation tasks in the same phase.
- T025 through T029 can run in parallel once checkout contracts are stable.
- T035 through T038 can run in parallel once confirmation states are defined.
- T045 through T048 can run in parallel once Business activation behavior is agreed.
- T054 through T057 can run in parallel during final cleanup.

### Implementation Strategy

- MVP first: complete US1 so the plan catalog exposes the new billing metadata cleanly.
- Next: implement US2 so Plus and Business can create pending MoMo payments without activation.
- Next: implement US3 so activation happens only through trusted confirmation and is idempotent.
- Final story: implement US4 so Business uses only the configurable mock id and never touches workspace runtime state.
- Keep 015 as a reference for existing files and tests, but treat its workspace tasks as rollback targets for 016.

### Real Commands To Use

- API Gateway subscription tests: `cd api-gateway && npm test -- subscriptions`
- API Gateway subscription e2e tests: `cd api-gateway && npm run test:e2e -- subscriptions`
- Prisma generation: `cd api-gateway && npx prisma generate`
- API Gateway build: `cd api-gateway && npm run build`
- API Gateway lint: `cd api-gateway && npm run lint`

## Notes

- No CV Parser, Notification, queue, storage, workspace invitation, workspace role, workspace membership, or workspace quota task is included for 016.
- MoMo checkout should follow the official MoMo request/signature/result handling documented in `specs/016-subscription-billing/research.md`.
- Every task that references workspace is a rollback or regression task, not new workspace feature work.
