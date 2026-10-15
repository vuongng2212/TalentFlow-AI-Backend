# Research: Subscriptions and Plan Entitlements

**Date**: 2026-09-16  
**Feature**: `019-subscriptions-plans`  
**Scope**: API Gateway plans, current workspace subscriptions, and Business entitlement synchronization

## R-01: Owning runtime boundary

### Decision

Implement the feature entirely in `api-gateway/`. Add a `src/subscriptions/` NestJS module; do not change CV Parser, Notification, queues, or payment integrations.

### Rationale

- The live API Gateway owns the Workspace Prisma model, authenticated HTTP surface, workspace context, and the existing `isBusiness` entitlement projection.
- No message, external payment, or delivery flow appears in the specification. Adding one would expand the service boundary without a consumer or operational requirement.

### Alternatives considered

1. A Billing service or payment-provider integration — outside scope and no live service/contract exists. Rejected.
2. Persisting the subscription in Notification or CV Parser — those services do not own Workspace persistence or HTTP authorization. Rejected.

## R-02: Current subscription persistence model

### Decision

Create one `Subscription` row per Workspace with `workspaceId @unique`; changing plans updates that row rather than creating a history record. Add `Plan` as a separate, fixed catalogue and use `PlanCode` (`FREE`, `PLUS`, `BUSINESS`) as the stable API selection identity.

### Rationale

- The specification asks for the workspace's current subscription, not payment history, invoices, cancellation, or plan-change audit records.
- A unique workspace foreign key is a database-level guarantee against duplicate current subscriptions and makes same-plan selection naturally idempotent.
- A human-readable enum code is stable for request validation and avoids exposing an implementation UUID as the client contract.
- The repository convention uses `String @default(uuid())` mapped to PostgreSQL TEXT columns, so the new model follows it rather than adding `@db.Uuid`.

### Alternatives considered

1. Multiple historical subscriptions with a partial unique active index — needs custom active-row constraints and lifecycle rules not requested here. Rejected as unneeded complexity.
2. Store a `planCode` directly on `Workspace` — loses the required Subscription entity and its audit/lifecycle fields. Rejected.
3. Derive state only from `Workspace.isBusiness` — cannot represent Plus and lacks a catalogue. Rejected.

## R-03: Canonical catalogue seed and existing-workspace backfill

### Decision

Use one hand-reviewed Prisma migration transaction to create Plans/Subscriptions, deterministically upsert Free/Plus/Business, then insert a current ACTIVE subscription for every existing Workspace. Map `is_business=true` to Business; map every other workspace to Free; do not change the boolean in the backfill.

### Rationale

- Production does not execute `prisma/seed.ts`; it explicitly refuses production. The migration must therefore create the canonical catalogue and preserve existing records itself.
- Existing manual Gateway migrations use SQL transactions, `IF NOT EXISTS`, explicit backfills, and `gen_random_uuid()`. This is appropriate for a schema plus data migration.
- Preserving the current field while inserting the matching subscription avoids an entitlement change during rollout.

### Alternatives considered

1. Seed plans only with `prisma db seed` — leaves deployed databases and existing workspaces without the required data. Rejected.
2. Make all existing workspaces Free — revokes Business access and violates FR-009. Rejected.
3. Create plans lazily on first request — is race-prone and cannot guarantee the exact catalogue before any request. Rejected.

## R-04: Workspace provisioning and removal of client-controlled entitlement

### Decision

Remove `isBusiness` from both workspace request DTOs. Within the existing interactive transactions in `WorkspaceCoreService.create` and `UsersService.createWithPersonalWorkspace`, create the Workspace with `isBusiness: false` and call a transaction-aware Free-subscription provisioning helper.

### Rationale

- Today both DTOs expose `isBusiness` and `WorkspaceCoreService` writes it directly. That contradicts FR-008.
- `main.ts` has a global whitelist and `forbidNonWhitelisted: true`; removing the field causes a clear HTTP 400 instead of silently accepting an untrusted entitlement.
- Both provisioning flows already create Workspace, owner membership, and active workspace pointer atomically. Adding the subscription to those same transactions ensures no workspace commits without Free.

### Alternatives considered

1. Retain `isBusiness` but ignore it — accepts a misleading and unsafe client contract. Rejected.
2. Create subscriptions after the workspace transaction commits — partial failures can leave a workspace without a current subscription. Rejected.
3. Open a separate/nested transaction in the helper — weakens atomicity and is inconsistent with existing transaction callbacks. Rejected.

## R-05: HTTP resource shape and workspace authorization

### Decision

Use context-rooted routes:

- `GET /api/v1/subscriptions/plans`
- `GET /api/v1/subscriptions/current`
- `PUT /api/v1/subscriptions/current`

The catalogue route uses `@SkipWorkspaceContext()`; the two current-workspace routes use the resolved workspace context. The PUT accepts only `{ planCode }` and is guarded with `@WorkspaceRoles(OWNER, ADMIN)` plus service-level active role verification.

### Rationale

- The global `WorkspaceContextGuard` resolves `request.workspaceId` from `x-workspace-id` or active membership. `WorkspaceRolesGuard` checks that resolved ID, not an arbitrary route `:workspaceId`.
- A `/workspaces/:workspaceId/subscription` route would need extra equality/authorization rules to prevent a header/path mismatch. Current-context routes use exactly the ID that guards authorize.
- `@SkipWorkspaceContext()` keeps the authenticated global catalogue visible without requiring the caller to first resolve an active workspace, while global JWT authentication remains enabled.
- `PUT` accurately conveys that requesting the same desired plan is idempotent.

### Alternatives considered

1. `/workspaces/:workspaceId/subscription` endpoints — workable only with explicit route/context matching and service authorization; unnecessary for the existing context-based API. Rejected.
2. An entitlement boolean body such as `{ isBusiness: true }` — cannot select Plus and violates FR-008. Rejected.
3. A public catalogue — the feature requires authenticated visibility. Rejected.

## R-06: Entitlement synchronization and failure behavior

### Decision

Plan selection runs in one Prisma interactive transaction: find the requested active Plan, verify active owner/admin membership for the resolved workspace, update the one Subscription's plan, update `Workspace.isBusiness = plan.enablesBusiness`, and return Subscription plus Plan. Same-plan selection returns the existing row or updates that same row; it never inserts.

### Rationale

- Existing Business member/invitation gates already read `workspace.isBusiness`. Keeping this synchronized projection preserves their behavior without a broader rewrite.
- One transaction implements FR-007 and preserves the previous state on failed lookup, authorization, or persistence.
- Checks run before writes, avoiding accidental changes after an invalid or unavailable request.

### Alternatives considered

1. Update Subscription and Workspace in separate calls — can leave a plan and entitlement inconsistent after failure. Rejected.
2. Change each Business-only consumer to join Subscription/Plan — expands a focused feature and risks regressions. Rejected.
3. Create a new Subscription row on every selection — violates the single-current invariant unless historical status rules are added. Rejected.

## R-07: Seed, logging, and test strategy

### Decision

Update `prisma/seed.ts` to upsert the catalogue before hand-creating its personal and Business workspaces, and create subscriptions for each seed workspace. Log successful, invalid, and unauthorized selection outcomes using only workspace ID, requested/previous/selected plan codes, requester ID when available, and an outcome category. Implement tests before behavior.

### Rationale

- The current seed creates four Free-like personal workspaces and one direct Business workspace; without subscriptions, local/E2E data would violate the new invariant.
- Existing structured logging already carries correlation IDs. Raw email/name/request payload logging would add unnecessary PII.
- The constitution requires red-green-refactor TDD, and the feature changes both durable data and authorization-sensitive behavior.

### Alternatives considered

1. Leave the seed unchanged and let test fixtures manually create subscriptions — duplicates system rules and makes `db:seed` inconsistent. Rejected.
2. Use a payment/audit event stream for logging — no such contract or consumer is in scope. Rejected.
3. Implement before tests — violates the mandated TDD quality gate. Rejected.

## Resolved Design Summary

- API Gateway is the sole owner.
- The database has one canonical Plan catalogue and one current Subscription per Workspace.
- Migration, not runtime seed, establishes production plans and migration safety.
- All normal workspace creation gets Free in the caller's existing transaction.
- The client selects an active `planCode`; only Business projects `isBusiness=true`.
- The resolved workspace context is the authorization and resource boundary.
- No unresolved clarification remains.
