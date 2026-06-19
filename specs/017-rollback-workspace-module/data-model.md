# Data Model: Rollback Workspace Module

## Removed Active Workspace Management Surface

Represents the runtime and persistence contract that is removed from the current release.

**Former active shapes**:

- `Workspace`: workspace identity, display name, Business flag, timestamps
- `WorkspaceMember`: workspace/user membership, role, invitation status, inviter, timestamps
- `WorkspaceMemberRole`: `OWNER`, `ADMIN`, `RECRUITER`, `VIEWER`
- `WorkspaceMemberStatus`: `ACTIVE`, `INVITED`, `REMOVED`
- Workspace HTTP payloads: create workspace, add/invite member, list members, role assignment/member administration payloads

**Rollback rule**:

- These shapes must not appear in the active API contract, generated client contract, seed expectations, or runtime route handling for this release.
- Previously known workspace paths must not mutate workspace-related state.
- Historical records may exist before migration, but they are not active product behavior after rollback.

## SubscriptionPlan

Represents the billing plan catalog retained from spec 016.

**Fields retained**:

- `id`
- `code`: `FREE`, `PLUS`, or `BUSINESS`
- `name`
- `billingPeriod`
- `isPaid`
- `priceAmount`
- `currency`
- `checkoutEligible`
- `isActive`
- feature flags needed by subscription billing/status

**Validation rules**:

- Free, Plus, and Business remain available according to spec 016.
- Business must not imply real workspace lifecycle capability.
- Fields named like workspace activation, workspace entitlement, or workspace member administration are removed from the active plan schema for this release.

## UserSubscription

Represents active and historical subscription periods retained from spec 016.

**Fields retained**:

- `id`
- `userId`
- `planId`
- `status`
- `periodStart`
- `periodEnd`
- `paymentTransactionId`
- `businessWorkspaceId`
- `createdAt`, `updatedAt`

**Validation rules**:

- `businessWorkspaceId` is allowed only for active Business subscription records.
- `businessWorkspaceId` is a subscription placeholder string and must not be a foreign key to `Workspace`.
- Plus subscriptions must not set `businessWorkspaceId`.
- Subscription activation must not create, update, invite into, assign roles for, or validate against a real workspace.
- The mock identifier is auditable billing data only; it is not an API route, membership boundary, entitlement lookup key, or manageable workspace resource.

## PaymentTransaction And PaymentConfirmation

Represents MoMo billing state retained from spec 016.

**Fields retained**:

- Payment purchaser, plan, expected amount/currency, provider identifiers, status, provider response metadata, rejection reason, confirmation timestamp
- Confirmation source, result, signature validity, accepted/rejected decision, rejection reason, received timestamp

**Validation rules**:

- Paid subscriptions activate only after trusted confirmation.
- Duplicate successful confirmation remains idempotent.
- Failed, cancelled, expired, mismatched, or unverified payment state leaves subscriptions inactive.
- Billing confirmation does not call workspace services or mutate workspace tables.

## AiUsageRecord

Represents AI usage audit state if retained by the active subscription release.

**Rollback expectation**:

- Personal usage state may remain if it is required by active subscription quota behavior.
- Workspace usage context and `workspaceId` relation must be removed from the active release unless a non-workspace feature explicitly owns it.
- No active AI usage path may consume or audit against a real workspace context in this release.

## Mock Business Workspace Identifier

Represents the spec 016 placeholder used only for Business subscription records.

**Source**:

- `SUBSCRIPTION_BUSINESS_WORKSPACE_ID` from validated API Gateway config
- Fallback constant only if the subscription module already accepts a checked-in mock default

**Validation rules**:

- Required before Business activation can complete.
- Stored only on `UserSubscription.businessWorkspaceId`.
- Not looked up in a workspace table.
- Not exposed as a manageable workspace id.

## State Transitions

### Removed workspace paths

```text
known workspace HTTP path -> missing route / not handled by workspace API -> no state mutation
```

### Business subscription activation

```text
PENDING payment -> trusted successful confirmation -> ACTIVE Business subscription with mock businessWorkspaceId
```

### Workspace lifecycle after rollback

```text
create workspace -> unavailable
invite/add member -> unavailable
list members -> unavailable
assign role/administer workspace -> unavailable
```

## Relationships

- `User` keeps subscription and payment relationships.
- `User` must not keep active workspace membership relationships after schema cleanup.
- `UserSubscription.businessWorkspaceId` remains a scalar string and has no relationship to `Workspace`.
- `PaymentTransaction` may activate one `UserSubscription`.
- Workspace management models have no active relationships in the release after rollback.
