# Data Model: Subscription Plans

## SubscriptionPlan

Represents the fixed plan catalog for this release.

**Fields**:
- `id`: stable identifier
- `code`: `FREE`, `PLUS`, or `BUSINESS`
- `name`: user-visible plan name
- `scope`: `PERSONAL` or `WORKSPACE`
- `billingPeriod`: `NONE` for Free, `MONTHLY` for Plus and Business
- `dailyAiRequestLimit`: Free 5, Plus 20, Business 500
- `trialAiRequestLimit`: Free 15, null for Plus and Business
- `canScoreCv`: true for all plans
- `canAnalyzeCvFit`: false for Free, true for Plus and Business
- `canActivateWorkspace`: true only for Business
- `isActive`: catalog availability flag

**Validation rules**:
- Exactly one active plan per code.
- Free must be personal scope.
- Plus must be personal scope.
- Business must be workspace scope.

## UserSubscription

Represents a user's personal plan.

**Fields**:
- `id`
- `userId`
- `planId`
- `status`: `ACTIVE`, `CANCELLED`, or `EXPIRED`
- `periodStart`
- `periodEnd`: null allowed for Free
- `createdAt`
- `updatedAt`

**Relationships**:
- Belongs to `User`
- Belongs to `SubscriptionPlan`

**State transitions**:
- New account creates active Free.
- Free can transition to active Plus.
- Plus can transition to cancelled or expired, then Free becomes effective again.

**Validation rules**:
- A user must always have an effective personal entitlement.
- Only one active paid personal subscription may be effective at a time.
- Plus does not grant workspace entitlement.

## WorkspaceSubscription

Represents Business entitlement for one workspace.

**Fields**:
- `id`
- `workspaceId`
- `purchaserId`
- `planId`
- `status`: `ACTIVE`, `CANCELLED`, or `EXPIRED`
- `periodStart`
- `periodEnd`
- `createdAt`
- `updatedAt`

**Relationships**:
- Belongs to `Workspace`
- Belongs to purchaser `User`
- Belongs to Business `SubscriptionPlan`

**State transitions**:
- Workspace without Business has no active workspace entitlement.
- Business activation creates or renews active entitlement for one monthly period.
- Expiry removes Business-only capabilities until renewed.

**Validation rules**:
- Active workspace subscription must use Business plan.
- A workspace can have only one active Business entitlement at a time.
- Purchaser must be an account holder and must become an active workspace admin unless already owner/admin.

## AiUsageRecord

Represents one consumed or denied AI action for quota and audit.

**Fields**:
- `id`
- `actorId`
- `contextType`: `PERSONAL` or `WORKSPACE`
- `workspaceId`: required when context is workspace
- `planId`
- `action`: `CV_SCORE` or `CV_FIT_ANALYSIS`
- `usageDate`: day bucket used for quota
- `count`: normally 1
- `decision`: `ALLOWED` or `DENIED`
- `denyReason`: optional user-visible reason key
- `createdAt`

**Relationships**:
- Belongs to actor `User`
- Optionally belongs to `Workspace`
- Belongs to resolved `SubscriptionPlan`

**Validation rules**:
- Personal context must not include workspace quota consumption.
- Workspace context must include a workspace and active membership.
- Denied requests do not consume quota count.
- Free total trial limit counts allowed Free personal AI scoring records across all dates.

## EntitlementDecision

Runtime response shape for checking an AI action before execution.

**Fields**:
- `allowed`: boolean
- `contextType`: `personal` or `workspace`
- `resolvedPlan`: `Free`, `Plus`, or `Business`
- `action`: requested AI action
- `remainingDailyQuota`
- `remainingTrialQuota`: only meaningful for Free
- `reason`: present when denied

**Validation rules**:
- Context must be explicit.
- Plus user in personal context resolves to Plus.
- Plus user in Business workspace context resolves to Business.
- Quota pools never overflow into each other.
