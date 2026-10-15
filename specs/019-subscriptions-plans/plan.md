# Implementation Plan: Subscriptions and Plan Entitlements

**Branch**: `Bero/feat/billing-and-subscription` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/019-subscriptions-plans/spec.md`

## Summary

Implement the subscription catalogue and current-workspace subscription entirely in `api-gateway/`. Add canonical Free, Plus, and Business plans; create one current subscription per workspace; provision Free atomically when a workspace is created; and project the selected plan's Business capability to `Workspace.isBusiness`. The feature is authenticated HTTP, Prisma persistence, and workspace-provisioning work. It explicitly excludes checkout, pricing, invoice, provider, queue, CV Parser, and Notification changes.

## Technical Context

**Primary Runtime**: API Gateway  
**Language/Version**: TypeScript 6.0.3, NestJS 11.1, Prisma 6.19  
**Primary Dependencies**: NestJS, Prisma/PostgreSQL, `class-validator`, existing workspace-context and authorization guards  
**Storage**: PostgreSQL; Plan/Subscription schema and data migration  
**Testing**: Jest unit/controller tests and gateway E2E tests, followed by `npm test`, `npm run test:e2e`, `npm run lint`, and `npm run build`  
**Target Platform**: Existing API Gateway local/Node 20 and Kubernetes deployments  
**Project Type**: Polyglot backend; API Gateway only  
**Performance Goals**: Subscription provision/selection completes within existing request latency; no workspace commits without its required Free subscription  
**Constraints**: Existing workspace context is authoritative; only owner/admin changes plans; no client-controlled Business flag; all-or-nothing subscription/entitlement persistence  
**Scale/Scope**: New `src/subscriptions/` module, Plan/Subscription Prisma models/enums, one migration/backfill, seed alignment, workspace/user provisioning updates, and focused Gateway tests

## Constitution Check

### Before research — PASS

- Runtime code and active Spec Kit artifacts are the authority.
- Work remains inside the explicit API Gateway service boundary.
- The migration changes schema and persistence together.
- DTO/guard validation remains at the HTTP and workspace-context edges.
- RED-first tests are mandatory before non-trivial implementation.
- Logging uses safe identifiers only; no new silent failure or cross-service flow is introduced.

### After design — PASS

The design uses existing Prisma transactions, workspace authorization, and Gateway module conventions. It adds the minimum durable data model needed and introduces no exception to the constitution.

## Project Structure

```text
specs/019-subscriptions-plans/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── subscriptions-api.md

api-gateway/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/<timestamp>_add_subscriptions_plans/migration.sql
├── src/
│   ├── app.module.ts
│   ├── subscriptions/
│   │   ├── dto/change-subscription.dto.ts
│   │   ├── subscriptions.controller.ts
│   │   ├── subscriptions.service.ts
│   │   └── *.spec.ts
│   ├── users/
│   └── workspaces/
└── test/subscriptions.e2e-spec.ts
```

**Structure decision**: The Gateway owns the Workspace model, authenticated context, workspace provisioning, and Business projection. CV Parser and Notification have no relevant consumer or schema ownership, so they are unchanged.

## Delivery Phases

### Phase 0: Discovery and contract check — complete

- Confirmed the Gateway owns `Workspace`, workspace membership, authentication, and the existing `isBusiness` projection.
- Confirmed `WorkspaceContextGuard` resolves the tenant from `x-workspace-id`, active workspace, or first membership; routes should use that context rather than a free path workspace ID.
- Confirmed no existing payment, invoice, subscription, or catalogue runtime exists.
- Confirmed current `isBusiness` request DTO fields would allow client-controlled entitlement and must be removed.
- Confirmed production needs a migration/backfill because `prisma db seed` is not a deployment migration mechanism.

### Phase 1: Design and data shape — complete

- Add `Plan` (`FREE`, `PLUS`, `BUSINESS`) with a stable code, name, display order, active flag, and Business-entitlement flag.
- Add one `Subscription` per Workspace through `workspaceId @unique`; it has a selected Plan and is `ACTIVE` in this feature.
- Add `Workspace.subscription` and `Plan.subscriptions` relations using existing text UUID convention.
- Backfill every existing workspace: Business where `is_business=true`, otherwise Free; preserve the pre-existing boolean during the migration.
- Use context-rooted endpoints: `GET /subscriptions/plans`, `GET /subscriptions/current`, and `PUT /subscriptions/current` with `{ planCode }` only.
- Document schema, migration, state, and contract details in `data-model.md` and `contracts/subscriptions-api.md`.

### Phase 2: Implementation by service — planned

#### 2.1 RED: Plan persistence and migration

1. Write failing tests for canonical plan ordering, backfilled/current subscription invariants, and duplicate-free provisioning.
2. Add `PlanCode` and `SubscriptionStatus` enums plus `Plan`/`Subscription` Prisma models and Workspace relation.
3. Write one transactional SQL migration: create enums/tables/indexes/FKs, upsert canonical rows, backfill exactly one active subscription per workspace, and preserve `is_business` alignment.
4. Update `prisma/seed.ts` to upsert the same catalogue and create subscriptions for every fixture workspace.

#### 2.2 RED: transactional workspace provisioning

1. Write failing tests for normal workspace creation and signup personal-workspace creation receiving Free and `isBusiness=false` atomically.
2. Remove `isBusiness` from create/update workspace DTOs so global whitelist/forbid-non-whitelisted validation rejects client-controlled entitlement.
3. Add a transaction-aware `SubscriptionsService.provisionFreeForWorkspace(transaction, workspaceId)` helper.
4. Call it inside existing `WorkspaceCoreService` and `UsersService` provisioning transactions after workspace creation; do not open nested/separate transactions.

#### 2.3 RED: authenticated catalogue and plan selection

1. Write failing controller/service/E2E tests for authenticated catalogue visibility, active-member current read, owner/admin selection, recruiter/viewer/nonmember rejection, invalid/inactive code, and same-plan idempotency.
2. Add `SubscriptionsModule`, controller, DTO, and service. Import it into `AppModule` and current workspace/user modules as required for provisioning.
3. Use `@SkipWorkspaceContext()` for authenticated global catalogue; use existing resolved context for current routes. Guard PUT with `@WorkspaceRoles(OWNER, ADMIN)` and repeat active membership validation in the service transaction.
4. In one Prisma transaction, look up the active plan, verify membership, update the one Subscription row, and update `Workspace.isBusiness = plan.enablesBusiness`. Return the existing row for a same-plan request.
5. Log only workspace/requester/plan identifiers and safe outcome categories; never log arbitrary bodies or personal data.

### Phase 3: Verification and hardening — planned

1. Run focused subscription unit/controller tests first.
2. Run the subscription E2E test against a migrated test database, including cookie authentication and `x-workspace-id` behaviour.
3. Verify migration and seed idempotency; verify all old workspaces retain their Business projection.
4. Run full Gateway tests, lint, and build. Regenerate Swagger only if the repository workflow requires it.

## Validation Commands

```powershell
Set-Location D:\Project\TalentFlow-AI\TalentFlow-AI-Backend\api-gateway
npm test
npm run test:e2e
npm run lint
npm run build
```

## Local Verification Strategy

- Apply the migration to a disposable database before E2E tests, then run it again to verify it is conflict-safe.
- Exercise both standard workspace creation and signup personal-workspace provisioning.
- Use existing cookie authentication and workspace headers; do not substitute a path workspace ID as authorization.
- Assert the response envelope, fixed catalogue order, one current subscription per workspace, and synchronized `isBusiness` after every successful selection.

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| Plan and Subscription schema/migration | Required durable catalogue/current-subscription state and safe backfill | A boolean cannot represent Free/Plus/Business or a current selection |
| Transaction-aware provisioning helper | Every newly created workspace needs Free atomically | A post-commit process can leave a workspace without a subscription |
| `Workspace.isBusiness` projection update | Existing capability guards read it | Rewriting all consumers expands scope and risks regressions |
