---
description: "Dependency-ordered implementation tasks for subscriptions and plan entitlements"
---

# Tasks: Subscriptions and Plan Entitlements

**Input**: Design documents from `D:\Project\TalentFlow-AI\TalentFlow-AI-Backend\specs\019-subscriptions-plans\`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/subscriptions-api.md`, and `quickstart.md`

**Tests**: Required. The feature specification and plan mandate TDD: author focused tests first, confirm they fail for the missing behavior, then implement the matching slice.

**Organization**: Tasks are grouped by user story. Each user-story phase delivers a slice that can be tested without relying on later stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on another incomplete task.
- **[Story]**: User story label (`[US1]`, `[US2]`, or `[US3]`).
- Every task includes its exact target path.

## Path Conventions

- API Gateway runtime: `api-gateway/src/`
- Prisma schema, migration, and seed: `api-gateway/prisma/`
- Gateway unit tests: `api-gateway/src/**/*.spec.ts`
- Gateway end-to-end tests: `api-gateway/test/`
- Active feature documents: `specs/019-subscriptions-plans/`

## Phase 1: Setup and Contract Lock

**Purpose**: Resolve the one contract choice left open by the design before tests encode it.

- [x] T001 Review Gateway exception conventions and update the inactive-plan error status and response description consistently in `specs/019-subscriptions-plans/contracts/subscriptions-api.md`

---

## Phase 2: Foundational Persistence

**Purpose**: Establish the durable catalogue and one-current-subscription invariant that all user stories require.

- [x] T002 Add `PlanCode`, `SubscriptionStatus`, `Plan`, `Subscription`, and the `Workspace.subscription` relation with the documented mappings, unique constraint, indexes, and delete rules in `api-gateway/prisma/schema.prisma`
- [x] T003 Create the transactional canonical-plan seed and conflict-safe Workspace backfill migration in `api-gateway/prisma/migrations/20260916000000_add_subscriptions_plans/migration.sql`
- [x] T004 Update foreign-key-safe cleanup, canonical plan upserts, and Free/Business seed subscriptions in `api-gateway/prisma/seed.ts`
- [x] T005 Regenerate and verify Prisma Client types from the completed schema in `api-gateway/prisma/schema.prisma`

**Checkpoint**: The database creates Free, Plus, and Business deterministically, and every migrated or seeded workspace can have exactly one ACTIVE subscription.

---

## Phase 3: User Story 1 - Receive the default Free subscription (Priority: P1)

**Goal**: Every directly created workspace and signup-created personal workspace receives one Free subscription in the same transaction, with `isBusiness` forced to `false`.

**Independent Test**: Create a workspace and sign up a user; each resulting workspace has exactly one ACTIVE Free subscription and `isBusiness: false`. Payloads containing `isBusiness` are rejected.

### Tests for User Story 1 — write and observe RED first

- [x] T006 [P] [US1] Add failing transaction-level tests for `provisionFreeForWorkspace`, including active-Free lookup and one-row creation with the caller transaction client, in `api-gateway/src/subscriptions/subscriptions.service.spec.ts`
- [x] T007 [P] [US1] Update workspace-creation and name-only-update tests to require forced `isBusiness: false`, Free provisioning inside the transaction, and no direct entitlement update in `api-gateway/src/workspaces/workspace-core.service.spec.ts`
- [x] T008 [P] [US1] Update personal-workspace signup tests to require Free provisioning in the signup transaction in `api-gateway/src/users/users.service.spec.ts`
- [x] T009 [P] [US1] Add signup provisioning assertions for one Free subscription and `isBusiness: false` in `api-gateway/test/auth.e2e-spec.ts`
- [x] T010 [P] [US1] Replace client-controlled entitlement expectations with Free-provisioning and forbidden-extra-field coverage in `api-gateway/test/workspaces.e2e-spec.ts`

### Implementation for User Story 1

- [x] T011 [US1] Create the exported transaction-client-safe `provisionFreeForWorkspace(tx, workspaceId)` helper without nested transactions in `api-gateway/src/subscriptions/subscriptions.service.ts`
- [x] T012 [US1] Create and export the subscription provider required by workspace and user provisioning in `api-gateway/src/subscriptions/subscriptions.module.ts`
- [x] T013 [US1] Import the subscription provider and call the Free-provisioning helper within the existing workspace creation transaction in `api-gateway/src/workspaces/workspaces.module.ts` and `api-gateway/src/workspaces/workspace-core.service.ts`
- [x] T014 [US1] Import the subscription provider and call the Free-provisioning helper within the personal-workspace signup transaction in `api-gateway/src/users/users.module.ts` and `api-gateway/src/users/users.service.ts`
- [x] T015 [P] [US1] Remove `isBusiness` from accepted create/update DTO fields and their Swagger metadata in `api-gateway/src/workspaces/dto/create-workspace.dto.ts` and `api-gateway/src/workspaces/dto/update-workspace.dto.ts`
- [x] T016 [US1] Change the workspace update Swagger wording to name-only and preserve read-only `isBusiness` compatibility in `api-gateway/src/workspaces/workspaces.controller.ts`

**Checkpoint**: Direct workspace creation and signup provisioning are atomic, default to Free, and no API client can set `isBusiness` directly.

---

## Phase 4: User Story 2 - View the plan catalogue and current subscription (Priority: P2)

**Goal**: Authenticated callers can read the fixed catalogue without workspace context and active members can read the selected plan for their resolved workspace.

**Independent Test**: An authenticated caller receives exactly Free, Plus, Business in order; an active member receives their current subscription; an inaccessible or unresolved workspace reveals no subscription data.

### Tests for User Story 2 — write and observe RED first

- [x] T017 [P] [US2] Add failing service tests for deterministic catalogue ordering, current-subscription lookup with plan projection, and missing-subscription handling in `api-gateway/src/subscriptions/subscriptions.service.spec.ts`
- [x] T018 [P] [US2] Add failing controller delegation and route-metadata tests for catalogue and current-subscription reads in `api-gateway/src/subscriptions/subscriptions.controller.spec.ts`
- [x] T019 [P] [US2] Create E2E coverage for the authenticated global catalogue envelope, resolved-workspace current subscription, inactive/nonmember denial, and data-integrity 404 in `api-gateway/test/subscriptions.e2e-spec.ts`

### Implementation for User Story 2

- [x] T020 [US2] Implement ordered active-catalogue reads and resolved-workspace current-subscription projection including the selected plan and derived `isBusiness` in `api-gateway/src/subscriptions/subscriptions.service.ts`
- [x] T021 [US2] Implement authenticated `GET /subscriptions/plans` with `@SkipWorkspaceContext()`, plus `GET /subscriptions/current` with documented Swagger responses, in `api-gateway/src/subscriptions/subscriptions.controller.ts`
- [x] T022 [US2] Register the subscription controller and import the completed module into the application in `api-gateway/src/subscriptions/subscriptions.module.ts` and `api-gateway/src/app.module.ts`

**Checkpoint**: Catalogue and current-subscription reads return the documented response envelope, honor the existing workspace context guard, and expose no cross-workspace data.

---

## Phase 5: User Story 3 - Change the workspace plan (Priority: P3)

**Goal**: Only active workspace owners and administrators can select an active plan, atomically synchronize `Workspace.isBusiness`, and safely repeat the same selection.

**Independent Test**: An owner/admin changes Free or Plus to Business and back; the returned subscription and stored entitlement agree immediately. Recruiters, viewers, nonmembers, invalid/unavailable plans, and persistence failures leave the original state intact.

### Tests for User Story 3 — write and observe RED first

- [x] T023 [P] [US3] Add failing service tests for active OWNER/ADMIN authorization, inactive/unknown plan rejection, idempotent selection, transaction rollback, synchronized `isBusiness`, and identifier-only logs in `api-gateway/src/subscriptions/subscriptions.service.spec.ts`
- [x] T024 [P] [US3] Add failing controller tests for `PUT /subscriptions/current`, DTO delegation, required workspace roles, and Swagger error metadata in `api-gateway/src/subscriptions/subscriptions.controller.spec.ts`
- [x] T025 [P] [US3] Add E2E plan-change coverage for owner/admin upgrades and downgrades, recruiter/viewer/nonmember denial, invalid bodies, unavailable plans, repeated requests, and unchanged state after failure in `api-gateway/test/subscriptions.e2e-spec.ts`
- [x] T026 [P] [US3] Add regression coverage proving Business-only member and invitation gates follow an upgrade and later downgrade in `api-gateway/test/workspaces.e2e-spec.ts`

### Implementation for User Story 3

- [x] T027 [US3] Create a DTO that accepts only the required `PlanCode` enum and documents the request body in `api-gateway/src/subscriptions/dto/change-subscription.dto.ts`
- [x] T028 [US3] Implement the single interactive transaction that rechecks active OWNER/ADMIN membership, selects an active plan, updates the unique Subscription, synchronizes `Workspace.isBusiness`, returns the plan projection, and logs only identifiers in `api-gateway/src/subscriptions/subscriptions.service.ts`
- [x] T029 [US3] Implement idempotent `PUT /subscriptions/current` with `@WorkspaceRoles(OWNER, ADMIN)`, the change DTO, and finalized Swagger status documentation in `api-gateway/src/subscriptions/subscriptions.controller.ts`

**Checkpoint**: Plan selection changes only one current Subscription and its entitlement projection atomically; all rejected requests preserve both values.

---

## Phase 6: Polish and Cross-Cutting Validation

**Purpose**: Validate migration safety, the full Gateway regression surface, and implementation documentation.

- [x] T030 [P] Verify a pre-feature database snapshot retains Business workspaces as Business and maps all other workspaces to Free using the migration acceptance query in `specs/019-subscriptions-plans/quickstart.md`
- [x] T031 [P] Reconcile final status codes, manual request examples, migration directory, and test commands with the shipped behavior in `specs/019-subscriptions-plans/contracts/subscriptions-api.md` and `specs/019-subscriptions-plans/quickstart.md`
- [x] T032 Run focused unit and E2E suites for the changed subscription, workspace, user, and authentication files using the commands in `api-gateway/package.json`
- [x] T033 Run Prisma deployment/generation, the complete Gateway unit and E2E suites, then lint and build using the commands in `api-gateway/package.json`

---

## Dependencies and Execution Order

### Phase Dependencies

```text
T001
  └── T002 → T003 → T004 → T005
                         └── US1 (T006–T016)
                               └── US2 (T017–T022)
                                     └── US3 (T023–T029)
                                           └── T030–T033
```

- The contract decision in T001 must be complete before tests assert unavailable-plan behavior.
- Schema, migration, seed, and regenerated client types in T002–T005 are the persistence foundation for every story.
- US1 creates the provisioned invariant and exported service boundary that US2 and US3 consume.
- US2 exposes read paths before US3 adds the mutating selection path.
- Finish T030–T033 only after all user-story checkpoints pass.

### Parallel Opportunities

- **US1**: T006–T010 can be authored in parallel, as each touches a distinct test file; then T015 can proceed in parallel with T011–T014 once its RED test exists.
- **US2**: T017–T019 can be authored in parallel; T020, T021, and T022 remain sequential because they build one HTTP surface.
- **US3**: T023–T026 can be authored in parallel; T027 precedes T029, while T028 provides the behavior covered by both controller and E2E tests.
- **Final validation**: T030 and T031 may run in parallel after implementation; T032 and T033 are sequential verification gates.

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete T001–T005 to establish the migration-safe persistence invariant.
2. Complete T006–T016 and run its focused tests.
3. Demonstrate that new direct and signup-created workspaces have one Free subscription and no client-controlled entitlement field.

### Incremental Delivery

1. Add US2 read endpoints after the Free provisioning invariant is verified.
2. Add US3 plan selection only after catalogue/current reads are stable.
3. Run migration, focused tests, full regression, lint, and build at the final checkpoint.

### Real Validation Commands

```powershell
cd api-gateway
npm test -- subscriptions
npm test -- workspace-core
npm test -- users
npm test -- auth
npm run test:e2e -- subscriptions
npx prisma migrate deploy
npx prisma generate
npm test
npm run test:e2e
npm run lint
npm run build
```
