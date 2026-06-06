# Implementation Plan: Subscription Plans

**Branch**: `015-subscription-plans` | **Date**: 2026-06-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/015-subscription-plans/spec.md`

## Summary

Implement subscription plans in the API Gateway as the source of truth for personal and workspace entitlements. The smallest safe path adds a subscription module under `api-gateway/src/subscriptions/`, Prisma models and migrations under `api-gateway/prisma/`, hooks account signup to create the default Free entitlement, replaces workspace membership gating from `workspace.isBusiness` to active Business workspace entitlement, and exposes HTTP surfaces for plan/status, upgrades, workspace activation, and quota checks.

CV Parser and Notification do not own subscription policy in this plan. AI scoring and CV analysis execution should consume an API Gateway entitlement decision before work starts; the existing CV upload queue contract using `bucket` plus `fileKey` remains unchanged.

## Technical Context

**Primary Runtime**: api-gateway  
**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: NestJS 11, Prisma 6.7, class-validator, Swagger, Jest, existing JWT auth and role guards  
**Storage**: PostgreSQL via Prisma for subscription state and AI usage records  
**Testing**: `cd api-gateway && npm test -- subscriptions`, focused workspace/auth tests, `npm run test:e2e -- workspaces`, `npm run build`  
**Target Platform**: Local development and Linux containers  
**Project Type**: Polyglot backend services  
**Performance Goals**: Entitlement and quota checks complete inside the normal gateway request path without cross-service calls; daily quota decisions are deterministic for concurrent requests.  
**Constraints**: Preserve service boundaries, preserve CV upload queue contract, validate all HTTP inputs, fail closed when entitlement cannot be verified, keep payment-provider integration out of this slice.  
**Scale/Scope**: One API Gateway module, Prisma schema migration, seed/default plan data, auth signup integration, workspace service integration, unit tests and focused e2e coverage.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- Runtime code and current Spec Kit artifacts are authoritative.
- Frozen legacy sources are context only and must not be indexed as active requirements.
- Service boundaries remain explicit: API Gateway owns subscription policy; CV Parser and Notification do not.
- Cross-service contracts are preserved; no CV upload queue contract change is planned.
- Gateway schema changes require Prisma schema and migration updates together.
- Validation, logging, quota failure, and entitlement failure behavior remain boundary-focused.

## Project Structure

### Documentation (this feature)

```text
specs/015-subscription-plans/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── subscription-plans.openapi.yaml
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
api-gateway/
├── src/
│   ├── auth/
│   ├── workspaces/
│   ├── subscriptions/
│   │   ├── subscriptions.controller.ts
│   │   ├── subscriptions.service.ts
│   │   ├── subscriptions.module.ts
│   │   ├── dto/
│   │   └── interfaces/
│   ├── prisma/
│   └── common/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── test/
└── package.json
```

**Structure Decision**: API Gateway owns this feature because it is HTTP-facing, auth-aware, workspace-aware, quota-gated, and Prisma-backed. CV Parser and Notification are not changed unless a later feature introduces new AI worker contracts or lifecycle notifications.

### Ownership Check

- Account default Free plan starts from API Gateway auth/signup flow.
- Personal Plus and Free quota checks live in API Gateway subscription service.
- Business workspace entitlement replaces current workspace `isBusiness` gating in API Gateway workspace service.
- AI request authorization lives in API Gateway before any scoring or analysis work is started.

## Delivery Phases

### Phase 0: Discovery And Contract Check

- Confirm current `AuthService.signup` creates users through `UsersService` and can attach Free entitlement in the same logical account-creation flow.
- Confirm current `Workspace` model stores `isBusiness` as the temporary proxy and `WorkspacesService.addMember` uses it for member invitation gating.
- Confirm existing workspace roles already include `OWNER`, `ADMIN`, `RECRUITER`, and `VIEWER`; Business purchaser can be assigned `ADMIN` or elevated consistently with owner semantics.
- Confirm no current subscription, billing, Stripe, payment, invoice, or AI usage models exist.

### Phase 1: Design And Data Shape

- Add plan catalog, user subscription, workspace subscription, and AI usage record entities.
- Keep plan values explicit: Free personal, Plus personal, Business workspace; monthly period for Plus and Business.
- Define context resolution: `personal` consumes user quota; `workspace` consumes workspace quota.
- Define fail-closed entitlement decisions and quota denial responses.
- Define migration handling for current `Workspace.isBusiness`; implementation may keep the field for compatibility but must move runtime gating to active Business entitlement.

### Phase 2: Implementation By Service

- Add Prisma models/enums and migration under `api-gateway/prisma/`.
- Seed the three subscription plans or make plan creation idempotent at runtime.
- Create `SubscriptionsModule` with services for plan lookup, subscription activation, status retrieval, and quota consumption.
- Integrate `AuthService.signup` with Free entitlement creation.
- Integrate `WorkspacesService.addMember` with Business entitlement checks.
- Add HTTP endpoints for plan/status/activation/quota decision surfaces.
- Add focused unit tests before broad e2e tests.

### Phase 3: Verification And Hardening

- Run subscription service unit tests for Free, Plus, Business, expiry, context resolution, and quota exhaustion.
- Run auth signup tests to verify Free default assignment.
- Run workspace tests to verify Business entitlement replaces `isBusiness` gating.
- Run focused e2e tests for account creation, plan status, Plus activation, Business workspace activation, member invitation, and quota limits.
- Run gateway build after Prisma client generation.

## Validation Commands

- API Gateway subscription tests: `cd api-gateway && npm test -- subscriptions`
- API Gateway auth/workspace focused tests: `cd api-gateway && npm test -- auth workspaces`
- API Gateway e2e focused tests: `cd api-gateway && npm run test:e2e -- workspaces`
- API Gateway build: `cd api-gateway && npm run build`
- Prisma generation/migration validation: `cd api-gateway && npx prisma generate`

## Local Verification Strategy

- Start with pure service unit tests for entitlement and quota math.
- Add integration-style service tests for Prisma transaction behavior around quota consumption.
- Validate HTTP DTOs and guards through controller/e2e tests only after service behavior is stable.
- For schema changes, update `prisma/schema.prisma`, add a migration folder, and run Prisma client generation before build.

## Complexity Tracking

Use this table only if the plan needs a justified exception to the normal brownfield guardrails.

| Violation        | Why Needed                                                                 | Simpler Alternative Rejected Because                                               |
| ---------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Schema migration | Subscription state and quota decisions need durable, auditable persistence | Config-only flags cannot enforce per-user, per-workspace, monthly, or daily limits |
