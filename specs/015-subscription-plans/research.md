# Research: Subscription Plans

## Decision: API Gateway Owns Subscription Policy

**Rationale**: Subscription state, account defaults, workspace entitlement, member management, and quota checks are all HTTP/auth/Prisma concerns already owned by the API Gateway. Keeping policy here avoids making CV Parser responsible for user plans or workspace membership.

**Alternatives considered**:
- Put quota enforcement in CV Parser: rejected because parser is a RabbitMQ worker and should not own auth or plan state.
- Add a separate billing service now: rejected because the requested slice excludes provider checkout, invoices, taxes, refunds, and dunning.

## Decision: Plan Catalog Is Persisted And Seeded

**Rationale**: Free, Plus, and Business are durable product concepts with limits, scopes, and permissions that need consistent references from subscriptions and usage records. A seeded catalog gives stable identifiers and keeps tests deterministic.

**Alternatives considered**:
- Hardcode plans only in code: rejected because usage records and subscriptions need referential consistency.
- Make plans fully admin-editable in this slice: rejected because the current requirement is fixed plan design, not plan administration.

## Decision: Separate Personal And Workspace Subscriptions

**Rationale**: Free and Plus are user-personal entitlements, while Business is workspace-scoped. Separate records make the Plus-plus-workspace story explicit: personal context uses user subscription, workspace context uses workspace subscription.

**Alternatives considered**:
- Single polymorphic subscription table only: possible, but separate models keep implementation and query rules clearer for this brownfield gateway.
- Store Business only as `workspace.isBusiness`: rejected because the current flag is temporary and cannot represent monthly periods, purchaser, status, or audit history.

## Decision: AI Usage Records Store Context And Day

**Rationale**: Quota behavior must be auditable and context-specific. Recording actor, context type, workspace, plan, action, and usage day allows deterministic daily limits and later reporting.

**Alternatives considered**:
- Redis-only counters: rejected for this slice because usage must be auditable and survive restarts.
- Aggregate counters only: rejected because they lose actor/action audit detail needed for support and abuse review.

## Decision: Fail Closed On Entitlement Uncertainty

**Rationale**: AI scoring and analysis cost money and affect paid value. If subscription state or quota cannot be verified, the safest behavior is to deny the AI action with a clear reason and avoid quota consumption.

**Alternatives considered**:
- Best-effort allow on errors: rejected because it can leak paid capabilities and hide entitlement failures.

## Decision: Payment Provider Is Out Of Scope

**Rationale**: The user requested plan design and entitlement behavior. Checkout, pricing, invoices, taxes, refunds, dunning, and payment webhooks require separate financial contracts and operational rules.

**Alternatives considered**:
- Add Stripe-like endpoints now: rejected because it would expand scope and introduce provider-specific commitments before product policy is stable.

## Decision: Business Purchaser Gets Workspace Admin Capability

**Rationale**: The existing workspace role model already has `ADMIN` and `OWNER`. Business activation should ensure the purchaser can administer members and roles. If the purchaser is already owner, the owner role remains sufficient; otherwise the purchaser should be active admin.

**Alternatives considered**:
- Always overwrite purchaser role to `ADMIN`: rejected because it could downgrade an existing `OWNER`.
- Add a new billing-owner role now: rejected because the requirement says additional roles may come later, and current role expansion should stay minimal.
