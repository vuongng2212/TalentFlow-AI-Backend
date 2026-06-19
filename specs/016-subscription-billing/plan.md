# Implementation Plan: Subscription Billing

**Branch**: `016-subscription-billing` | **Date**: 2026-06-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/016-subscription-billing/spec.md`

## Summary

Implement the reduced subscription billing slice in `api-gateway/` only. Keep `api-gateway/src/subscriptions/` as the single feature module for plan listing, MoMo checkout, internal confirmation, payment audit, and active subscription state. Use MoMo's official Payment Platform NodeJS integration sample/library as the billing adapter basis, wrapped behind a local `MomoBillingClient` so the gateway owns validation, idempotency, and persistence.

Rollback the workspace spillover from the current subscription runtime: remove workspace subscription HTTP surfaces from the subscription controller, stop mutating `Workspace` or `WorkspaceMember` records during Business activation, remove workspace entitlement/quota behavior from subscription billing, and represent Business activation only with a configurable mock `businessWorkspaceId` stored on the subscription/payment state. CV Parser and Notification remain out of scope; existing CV upload queue contracts stay unchanged.

## Technical Context

**Primary Runtime**: api-gateway  
**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: NestJS 11, Prisma 6.7, class-validator, Swagger, Jest, existing JWT/auth guards, MoMo official Payment Platform NodeJS integration sample/library  
**Storage**: PostgreSQL via Prisma for plan catalog, payment transaction records, confirmation audit, and user subscription state  
**Testing**: `cd api-gateway && npm test -- subscriptions`, `cd api-gateway && npm run test:e2e -- subscriptions`, `cd api-gateway && npm run build`  
**Target Platform**: Local development and Linux containers; development and production both use MoMo provider configuration  
**Project Type**: Polyglot backend services, single-service change for this feature  
**Performance Goals**: Plan/status reads complete inside the normal gateway request path; checkout and confirmation remain idempotent under duplicate user clicks, MoMo retries, or operator replays.  
**Constraints**: Use MoMo Billing in dev and prod, validate MoMo signatures/results at the gateway edge, activate only after trusted internal confirmation, fail closed on uncertain payment state, keep workspace creation/member/role logic out of scope, preserve CV upload `bucket` plus `fileKey` contract.  
**Scale/Scope**: One API Gateway module, one payment adapter, Prisma schema/migration updates for billing state, focused subscription tests, and removal/deactivation of workspace-coupled subscription endpoints from this slice.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- Runtime code and current Spec Kit artifacts are authoritative.
- Frozen legacy sources are context only and must not be indexed as active requirements.
- Service boundaries remain explicit: API Gateway owns subscription billing; CV Parser and Notification do not change.
- Cross-service contracts are preserved; no producer/consumer queue change is planned.
- Schema changes in the gateway require Prisma schema and migration updates together.
- Validation, logging, and failure behavior remain boundary-focused, especially for MoMo responses and internal confirmation.

## Project Structure

### Documentation (this feature)

```text
specs/016-subscription-billing/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── subscription-billing.openapi.yaml
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
api-gateway/
├── src/
│   ├── subscriptions/
│   │   ├── subscriptions.controller.ts
│   │   ├── subscriptions.service.ts
│   │   ├── subscriptions.module.ts
│   │   ├── billing/
│   │   │   ├── momo-billing.client.ts
│   │   │   ├── momo-signature.service.ts
│   │   │   └── momo.types.ts
│   │   ├── constants/
│   │   │   └── subscription.constants.ts
│   │   ├── dto/
│   │   └── interfaces/
│   ├── prisma/
│   ├── auth/
│   └── common/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── test/
└── package.json
```

**Structure Decision**: API Gateway owns this feature because subscription billing is HTTP-facing, auth-aware, payment-provider-facing, and Prisma-backed. `workspaces/` remains outside the feature; existing workspace code is not extended by subscription billing and any currently checked-in subscription-to-workspace coupling is removed from the subscription slice.

### Ownership Check

- Plan listing, checkout, MoMo provider interaction, internal confirmation, payment transaction state, and subscription activation live under `api-gateway/src/subscriptions/`.
- The mock Business workspace id lives in subscription constants/config and is written only to subscription-owned state.
- `api-gateway/src/workspaces/` must not receive new behavior for this feature.
- CV Parser and Notification have no implementation work for this feature.

## Delivery Phases

### Phase 0: Discovery And Contract Check

- Confirm current `subscriptions/` endpoints and service methods that activate Plus directly or Business through workspace routes.
- Confirm current Prisma subscription models created from spec 015 and identify which fields/tables must be kept, reshaped, or removed from the active billing path.
- Confirm MoMo official integration assets: NodeJS sample/library, subscription API fields, HMAC_SHA256 signature rules, redirect/IPN result handling, and request id idempotency.
- Confirm app config currently validates env values centrally and add MoMo config there rather than hardcoding provider values.
- Confirm no CV Parser, Notification, queue, storage, workspace invitation, role, or membership contract needs to change.

### Phase 1: Design And Data Shape

- Keep plan catalog as the source for Free, Plus, and Business, adding price/currency/checkout eligibility if not already present.
- Add `PaymentTransaction` as the durable record for MoMo checkout attempts and reconciliation.
- Add confirmation audit fields or a separate confirmation record so accepted, rejected, and duplicate confirmations are traceable.
- Reshape `UserSubscription` to represent active paid plans for users; Business stores an optional `businessWorkspaceId` mock value instead of relating to a real workspace.
- Remove active use of `WorkspaceSubscription`, workspace quota, workspace entitlement checks, and subscription-owned workspace mutation from this feature's runtime path.
- Define a MoMo billing adapter boundary that creates subscription checkout requests and verifies MoMo result signatures before internal activation.

### Phase 2: Implementation By Service

- Update Prisma schema and migration under `api-gateway/prisma/` for plan pricing, payment transaction state, confirmation audit, and optional subscription `businessWorkspaceId`.
- Add or adapt `api-gateway/src/subscriptions/billing/` from MoMo's official NodeJS integration sample/library, keeping gateway-specific validation and DTO mapping outside vendor code.
- Replace direct activation endpoints such as `POST /subscriptions/me/plus` with checkout and confirmation flow.
- Remove or disable subscription routes under `/workspaces/:workspaceId/...`; Business checkout must not accept a real workspace id.
- Remove subscription service calls that update `Workspace.isBusiness`, change `WorkspaceMember` roles, validate workspace membership, or consume workspace quota.
- Store the mock Business workspace id from `subscription.constants.ts` or validated config only when a Business payment is confirmed.
- Add focused unit tests around plan lookup, checkout creation, signature verification, confirmation matching, idempotent activation, failed payment handling, and Business mock id assignment.
- Add focused e2e tests for the HTTP subscription billing contract.

### Phase 3: Verification And Hardening

- Run narrow subscription unit tests first with the MoMo adapter mocked.
- Run Prisma generation and migration validation after schema changes.
- Run subscription e2e tests for checkout, internal confirm, duplicate confirm, mismatched confirm, status, and Business mock id behavior.
- Run gateway build and lint after the implementation compiles.
- Verify no workspace tests are required except a regression check that subscription billing no longer mutates workspace/member state.

## Validation Commands

- Subscription unit tests: `cd api-gateway && npm test -- subscriptions`
- Subscription e2e tests: `cd api-gateway && npm run test:e2e -- subscriptions`
- Prisma client generation: `cd api-gateway && npx prisma generate`
- Gateway build: `cd api-gateway && npm run build`
- Gateway lint: `cd api-gateway && npm run lint`

## Local Verification Strategy

- Mock MoMo network calls for unit tests and assert exact provider payload mapping, signature handling, and idempotency.
- Use fixture payloads for successful, failed, cancelled, expired, duplicate, and mismatched MoMo confirmations.
- Validate that client-controlled payloads cannot activate subscriptions without trusted confirmation.
- Validate Business activation stores only the configured mock `businessWorkspaceId` and performs no workspace create/update/member/role mutation.
- Keep CV Parser, Notification, queue, and storage test suites out of the required path unless implementation unexpectedly touches those contracts.

## Complexity Tracking

Use this table only if the plan needs a justified exception to the normal brownfield guardrails.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| Schema migration | Payment attempts, MoMo confirmations, and active subscription periods need durable audit and idempotency. | Config-only state cannot safely reconcile provider retries, duplicate confirmations, or subscription activation. |
| Runtime rollback of workspace coupling | Current checked-in subscription code includes workspace-facing Business activation and entitlement behavior that conflicts with spec 016. | Leaving those routes active would violate the reduced billing-only scope and could mutate workspace state during subscription tests. |
