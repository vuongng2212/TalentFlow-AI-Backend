# Research: Rollback Workspace Module

## Decision: Keep the rollback inside API Gateway

**Rationale**: Workspace management is currently exposed through NestJS HTTP controllers, API Gateway module wiring, Prisma models, API Gateway tests, and generated OpenAPI. Spec 017 does not change CV parsing, notifications, queues, storage, or cross-service message payloads.

**Alternatives considered**:

- Cross-service cleanup: rejected because no parser, notification, queue, or storage contract is part of the workspace management surface.
- Documentation-only rollback: rejected because active runtime still exposes workspace routes and generated contracts.

## Decision: Remove workspace routes from runtime instead of returning unsupported responses

**Rationale**: The clarification for spec 017 says workspace APIs must be removed from the active API surface. Keeping controllers with 403, 404, or 501 handlers would still expose workspace operations in decorators, generated OpenAPI, and generated clients.

**Alternatives considered**:

- Leave controllers and make service methods throw: rejected because API operations would remain discoverable.
- Hide Swagger decorators only: rejected because runtime routes would still be callable.

## Decision: Clean Prisma workspace management models with a migration

**Rationale**: Current schema includes `Workspace`, `WorkspaceMember`, workspace membership relations on `User`, workspace enums, and a workspace relation on `AiUsageRecord`. These are active persistence contracts. Spec 017 requires active schema and seed expectations not to treat workspace management as supported.

**Alternatives considered**:

- Leave schema in place as historical state: rejected because Prisma client types and migrations remain active developer-facing contracts.
- Drop only HTTP routes: rejected because persistence, seed, and tests would still imply workspace feature completeness.

## Decision: Preserve spec 016 subscription billing unchanged

**Rationale**: Spec 016 intentionally reduced subscription scope to plan listing, MoMo checkout, internal confirmation, subscription activation, and a mock Business workspace identifier. Rollback must not remove Free, Plus, Business plan availability or Business activation.

**Alternatives considered**:

- Remove all workspace-named fields including `UserSubscription.businessWorkspaceId`: rejected because spec 016 requires this placeholder for Business subscription records.
- Reconnect Business to real workspace lifecycle: rejected because both spec 016 and spec 017 explicitly prohibit real workspace creation, invitation, role assignment, and membership mutation.

## Decision: Keep the mock Business workspace id as subscription-owned string data

**Rationale**: The mock Business workspace id is a billing placeholder, not a real workspace relation. It should remain validated by subscription config (`SUBSCRIPTION_BUSINESS_WORKSPACE_ID`) and stored on subscription state only for Business activation.

**Alternatives considered**:

- Validate the mock id against a `Workspace` table: rejected because the rollback removes real workspace lifecycle behavior.
- Generate a new workspace id per Business subscription: rejected because spec 016 calls for a predefined mock value that is easy to change.

## Decision: Verification must combine route absence, contract absence, schema cleanup, and billing regression

**Rationale**: The feature can regress in several independent ways: a stale controller route, a stale OpenAPI entry, an active Prisma model, or a subscription flow that starts mutating workspace state again. Focused verification needs to cover each boundary.

**Alternatives considered**:

- Only run broad gateway tests: rejected because broad tests may miss generated contract drift.
- Only scan source: rejected because runtime route behavior and subscription activation still need test evidence.

## Decision: Do not update CV upload, parser, notification, queue, or storage contracts

**Rationale**: Spec 017 repeats the repository rule that CV upload events must continue to use `bucket` plus `fileKey`. No rollback requirement touches those paths.

**Alternatives considered**:

- Opportunistically modernize queue/storage contracts: rejected as unrelated cross-service churn.
