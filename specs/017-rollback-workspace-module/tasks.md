# Tasks: Rollback Workspace Module

**Input**: Design documents from `specs/017-rollback-workspace-module/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/rollback-workspace.openapi.yaml`, `quickstart.md`

**Organization**: Tasks are grouped by dependency phase and then by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files with no dependency on another incomplete task
- **[Story]**: User story label for story-phase tasks only
- Every task includes exact file paths

## Path Conventions

- API Gateway runtime: `api-gateway/src/`
- API Gateway persistence: `api-gateway/prisma/`
- API Gateway tests: `api-gateway/test/`
- Generated contracts: `api-gateway/swagger-spec.json`, `docs/openapi/api-gateway.openapi.json`
- Active feature docs: `specs/017-rollback-workspace-module/`

---

## Phase 1: Setup And Contract Lock

**Purpose**: Lock the rollback boundary before editing runtime code.

- [X] T001 Review active workspace runtime wiring in `api-gateway/src/app.module.ts`, `api-gateway/src/workspaces/`, `api-gateway/prisma/schema.prisma`, and `api-gateway/test/workspaces.e2e-spec.ts`
- [X] T002 [P] Review retained subscription billing surfaces in `api-gateway/src/subscriptions/`, `api-gateway/test/subscriptions.e2e-spec.ts`, and `api-gateway/prisma/schema.prisma`
- [X] T003 [P] Review stale workspace contract entries in `api-gateway/swagger-spec.json`, `docs/openapi/api-gateway.openapi.json`, and `docs/openapi/README.md`
- [X] T004 [P] Confirm rollback contract guard stays subscription-only in `specs/017-rollback-workspace-module/contracts/rollback-workspace.openapi.yaml`

---

## Phase 2: Foundational Work

**Purpose**: Remove shared workspace foundations that would otherwise keep the module active.

- [X] T005 Remove `WorkspacesModule` import and module registration from `api-gateway/src/app.module.ts`
- [X] T006 Delete active workspace controller, service, module, DTO, and unit spec files under `api-gateway/src/workspaces/`
- [X] T007 Remove `WORKSPACE_MAX_ACTIVE_MEMBERS` validation/defaults from `api-gateway/src/common/config/config.schema.ts`
- [X] T008 Remove workspace management models, user relations, workspace enums, and workspace AI usage relation fields from `api-gateway/prisma/schema.prisma`
- [X] T009 Add rollback migration dropping workspace membership state before workspace identity state in `api-gateway/prisma/migrations/20260619000000_rollback_workspace_module/migration.sql`
- [X] T010 Remove workspace management seed expectations while preserving subscription plans in `api-gateway/prisma/seed.ts`
- [X] T011 Remove workspace entitlement helper paths that validate real workspace IDs from `api-gateway/src/subscriptions/subscriptions.service.ts`

**Checkpoint**: Workspace module code is no longer wired into runtime, and Prisma schema changes are ready for story work.

---

## Phase 3: User Story 1 - Remove Active Workspace Management Surface (Priority: P1)

**Goal**: Previously exposed workspace APIs are absent from runtime behavior and generated contracts.

**Independent Test**: Call known workspace paths and inspect generated API contracts to verify workspace management operations are absent and no workspace state mutates.

### Tests for User Story 1

- [X] T012 [US1] Replace workspace success-path e2e coverage with removed-route assertions in `api-gateway/test/workspaces.e2e-spec.ts`
- [X] T013 [US1] Add no-mutation assertions for removed workspace paths in `api-gateway/test/workspaces.e2e-spec.ts`
- [X] T014 [US1] Add generated-contract absence assertions for `WorkspacesController`, `/workspaces`, `CreateWorkspaceDto`, and `AddWorkspaceMemberDto` in `api-gateway/test/workspaces.e2e-spec.ts`

### Implementation for User Story 1

- [X] T015 [US1] Remove workspace route references from generated gateway contract output in `api-gateway/swagger-spec.json`
- [X] T016 [US1] Remove workspace route references from generated public contract output in `docs/openapi/api-gateway.openapi.json`
- [X] T017 [US1] Remove workspace management endpoint claims from `docs/openapi/README.md`
- [X] T018 [US1] Run a source scan for stale workspace API symbols in `api-gateway/src/`, `api-gateway/test/`, `api-gateway/prisma/`, `api-gateway/swagger-spec.json`, and `docs/openapi/`

**Checkpoint**: User Story 1 is independently testable with removed-route behavior and zero active workspace contract operations.

---

## Phase 4: User Story 2 - Preserve Subscription Billing Without Workspace Lifecycle (Priority: P2)

**Goal**: Subscription plan listing, checkout, confirmation, status, and Business mock workspace id behavior continue without real workspace lifecycle behavior.

**Independent Test**: Run subscription billing flows and verify Business activation stores only the configured mock `businessWorkspaceId`, while Plus activation stores no Business workspace id.

### Tests for User Story 2

- [X] T019 [P] [US2] Keep or update subscription service tests for Business mock `businessWorkspaceId` activation in `api-gateway/src/subscriptions/subscriptions.service.spec.ts`
- [X] T020 [P] [US2] Keep or update subscription e2e tests for plan listing, checkout, internal confirmation, idempotency, Plus activation, and Business activation in `api-gateway/test/subscriptions.e2e-spec.ts`
- [X] T021 [US2] Add regression assertions that subscription activation does not create workspace or member records in `api-gateway/test/subscriptions.e2e-spec.ts`

### Implementation for User Story 2

- [X] T022 [US2] Preserve `SUBSCRIPTION_BUSINESS_WORKSPACE_ID` config usage and Business-only assignment in `api-gateway/src/subscriptions/subscriptions.service.ts`
- [X] T023 [US2] Preserve subscription response `businessWorkspaceId` fields as placeholder subscription data in `api-gateway/src/subscriptions/interfaces/subscription-billing-response.interface.ts`
- [X] T024 [US2] Remove or reshape workspace-id entitlement DTO usage that implies real workspace management in `api-gateway/src/subscriptions/dto/entitlement-check.dto.ts`
- [X] T025 [US2] Confirm subscription schema keeps `UserSubscription.businessWorkspaceId` as a nullable scalar string in `api-gateway/prisma/schema.prisma`

**Checkpoint**: User Story 2 is independently testable with billing-only subscriptions and no workspace lifecycle side effects.

---

## Phase 5: User Story 3 - Clean Active Data Contract And Migration Expectations (Priority: P3)

**Goal**: Active schema, migrations, seeds, docs, and generated runtime contracts no longer treat workspace management as supported.

**Independent Test**: Inspect Prisma schema/client generation, migration SQL, seed behavior, generated OpenAPI, and active docs for zero active workspace management requirements.

### Tests for User Story 3

- [X] T026 [P] [US3] Add or update seed regression coverage for retained subscription plans and removed workspace expectations in `api-gateway/test/seed.e2e-spec.ts`
- [X] T027 [P] [US3] Add schema cleanup verification notes for Prisma generation and migration application in `specs/017-rollback-workspace-module/quickstart.md`

### Implementation for User Story 3

- [X] T028 [US3] Run Prisma formatting and client generation after schema cleanup for `api-gateway/prisma/schema.prisma`
- [X] T029 [US3] Regenerate gateway OpenAPI output in `api-gateway/swagger-spec.json`
- [X] T030 [US3] Regenerate public OpenAPI output in `docs/openapi/api-gateway.openapi.json`
- [X] T031 [US3] Update active rollback verification guidance in `specs/017-rollback-workspace-module/quickstart.md`
- [X] T032 [US3] Ensure active feature artifacts document Business mock workspace id as subscription-only placeholder data in `specs/017-rollback-workspace-module/data-model.md`

**Checkpoint**: User Story 3 is independently testable through schema, migration, seed, generated contract, and active documentation inspection.

---

## Phase 6: Polish And Cross-Cutting Validation

**Purpose**: Prove the rollback is complete across runtime, persistence, contracts, and regression tests.

- [X] T033 [P] Run workspace rollback scan with `rg -n "WorkspacesController|/workspaces|CreateWorkspaceDto|AddWorkspaceMemberDto|WORKSPACE_MAX_ACTIVE_MEMBERS" api-gateway/src api-gateway/test api-gateway/prisma docs/openapi api-gateway/swagger-spec.json`
- [X] T034 [P] Run subscription unit tests for `api-gateway/src/subscriptions/subscriptions.service.spec.ts` with `cd api-gateway && npm test -- subscriptions`
- [X] T035 [P] Run removed-route and subscription e2e tests for `api-gateway/test/workspaces.e2e-spec.ts` and `api-gateway/test/subscriptions.e2e-spec.ts` with `cd api-gateway && npm run test:e2e -- workspaces subscriptions`
- [X] T036 [P] Run Prisma generation for `api-gateway/prisma/schema.prisma` with `cd api-gateway && npx prisma generate`
- [X] T037 [P] Run Swagger generation for `api-gateway/swagger-spec.json` and `docs/openapi/api-gateway.openapi.json` with `cd api-gateway && npm run swagger:generate`
- [X] T038 [P] Run gateway build for `api-gateway/src/` with `cd api-gateway && npm run build`
- [X] T039 [P] Run gateway lint for `api-gateway/src/` and `api-gateway/test/` with `cd api-gateway && npm run lint`
- [X] T040 Verify CV upload queue contract references still use `bucket` plus `fileKey` in `api-gateway/src/` and `api-gateway/test/cv-upload.e2e-spec.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 can start immediately.
- Phase 2 blocks all user stories because runtime wiring and schema cleanup affect every slice.
- User Story 1 should complete before OpenAPI regeneration is treated as final.
- User Story 2 can proceed after Phase 2 and should be validated before broad cleanup is considered complete.
- User Story 3 depends on Phase 2 and benefits from User Stories 1 and 2 being mostly stable.
- Phase 6 runs after all story slices are implemented.

### User Story Dependencies

- **US1** has no dependency after Phase 2 and is the MVP rollback scope.
- **US2** has no dependency on US1 after Phase 2, but must preserve subscription behavior while workspace code is removed.
- **US3** depends on the final schema, migration, seed, and generated contract state from US1 and US2.

### Parallel Opportunities

- T002, T003, and T004 can run in parallel during setup.
- T019 and T020 can run in parallel because they touch `api-gateway/src/subscriptions/subscriptions.service.spec.ts` and `api-gateway/test/subscriptions.e2e-spec.ts`.
- T026 and T027 can run in parallel with US1/US2 implementation once schema direction is confirmed.
- T033 through T039 can run in parallel where local tooling and database state allow it.

### Parallel Execution Examples

```powershell
# US1 contract/test work
Task T012: update api-gateway/test/workspaces.e2e-spec.ts removed-route cases
Task T015: regenerate or edit api-gateway/swagger-spec.json after runtime removal
Task T017: update docs/openapi/README.md workspace claims
```

```powershell
# US2 billing regression work
Task T019: update api-gateway/src/subscriptions/subscriptions.service.spec.ts
Task T020: update api-gateway/test/subscriptions.e2e-spec.ts
Task T023: verify api-gateway/src/subscriptions/interfaces/subscription-billing-response.interface.ts
```

```powershell
# US3 data/contract cleanup work
Task T028: run Prisma generation for api-gateway/prisma/schema.prisma
Task T029: regenerate api-gateway/swagger-spec.json
Task T031: update specs/017-rollback-workspace-module/quickstart.md
```

## Implementation Strategy

### MVP First

Complete Phase 1, Phase 2, and User Story 1 first. This removes the active workspace API surface and proves known workspace paths are no longer supported.

### Incremental Delivery

1. Deliver US1 to remove routes and generated contract operations.
2. Deliver US2 to prove subscription billing behavior from spec 016 still works.
3. Deliver US3 to finalize schema, migration, seed, generated docs, and active documentation cleanup.
4. Run Phase 6 validation before considering the rollback complete.

### Service Boundary Notes

- Keep implementation inside `api-gateway/`, `docs/openapi/`, and `specs/017-rollback-workspace-module/`.
- Do not change `cv-parser/`, `notification/`, RabbitMQ, MinIO, or CV upload queue payload contracts.
- Preserve `UserSubscription.businessWorkspaceId` as a string placeholder and do not introduce a foreign key to a real workspace.
