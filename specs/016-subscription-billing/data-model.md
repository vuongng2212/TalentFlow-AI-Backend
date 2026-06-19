# Data Model: Subscription Billing

## SubscriptionPlan

Represents a plan available in the subscription catalog.

**Fields**:

- `id`: stable internal identifier
- `code`: `FREE`, `PLUS`, or `BUSINESS`
- `name`: user-facing plan name
- `billingPeriod`: `NONE` for Free, `MONTHLY` for paid plans
- `isPaid`: whether checkout is required
- `priceAmount`: VND amount for checkout; zero or null for Free
- `currency`: `VND` for paid MoMo checkout
- `isActive`: whether the plan can be shown and purchased
- `checkoutEligible`: whether users may start checkout for this plan
- `createdAt`, `updatedAt`

**Validation rules**:

- Only active paid plans can be used for checkout.
- Free cannot create a MoMo payment transaction.
- Plus and Business must have positive VND price values before checkout.

## PaymentTransaction

Represents one MoMo checkout attempt and its reconciliation state.

**Fields**:

- `id`: internal payment transaction id
- `userId`: purchaser
- `planId`: selected subscription plan
- `provider`: fixed value `MOMO`
- `providerRequestId`: unique request id sent to MoMo
- `providerOrderId`: unique order id sent to MoMo
- `providerTransactionId`: MoMo transaction id when available
- `expectedAmount`: amount expected for the selected plan
- `currency`: expected currency
- `status`: `PENDING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `EXPIRED`, `REJECTED`
- `checkoutUrl`: provider payment URL when available
- `deeplink`: provider deeplink when available
- `qrCodeUrl`: provider QR payload URL when available
- `rawProviderRequest`: redacted request metadata for audit
- `rawProviderResponse`: redacted response/result metadata for audit
- `rejectionReason`: reason a confirmation was not accepted
- `createdAt`, `updatedAt`, `confirmedAt`

**Validation rules**:

- `providerRequestId` and `providerOrderId` must be unique.
- A payment can activate a subscription only from `PENDING` or already-idempotent `SUCCEEDED` state.
- Confirmed provider amount, currency, plan, user, request id, and order id must match the pending transaction.
- Duplicate successful confirmation for the same provider order id returns the existing activation result.

## PaymentConfirmation

Represents an audit entry for an internal or provider-driven confirmation attempt.

**Fields**:

- `id`: confirmation audit id
- `paymentTransactionId`: related payment transaction
- `source`: `MOMO_IPN`, `INTERNAL_OPERATOR`, or `INTERNAL_REPLAY`
- `resultCode`: MoMo result code or internal status
- `message`: provider/internal result message
- `signatureValid`: whether MoMo signature validation passed
- `accepted`: whether the confirmation activated or idempotently matched an active subscription
- `rejectionReason`: mismatch or verification failure reason
- `receivedAt`
- `rawPayload`: redacted provider/internal payload

**Validation rules**:

- MoMo-originated payloads must have a valid signature before they can be accepted.
- Rejected confirmations are stored for audit but must not activate subscriptions.

## UserSubscription

Represents the user's current and historical subscription periods.

**Fields**:

- `id`: subscription period id
- `userId`: owner
- `planId`: active plan
- `status`: `ACTIVE`, `CANCELLED`, `EXPIRED`
- `periodStart`: activation start
- `periodEnd`: paid period end; null only for Free if retained
- `paymentTransactionId`: payment that activated the paid period
- `businessWorkspaceId`: optional mock Business workspace id, present only for Business
- `createdAt`, `updatedAt`

**Validation rules**:

- Paid subscriptions require a successful `PaymentTransaction`.
- Business subscriptions require the configured mock `businessWorkspaceId`.
- Plus subscriptions must not set `businessWorkspaceId`.
- No subscription activation may create or mutate a real workspace.

## Mock Business Workspace Identifier

Represents the temporary Business workspace-like identifier used only by subscription billing.

**Source**:

- Prefer a validated config value such as `SUBSCRIPTION_BUSINESS_WORKSPACE_ID`.
- Keep a single fallback constant in `api-gateway/src/subscriptions/constants/subscription.constants.ts` only if the project accepts a checked-in mock default.

**Validation rules**:

- Must be present before Business payment confirmation can activate a Business subscription.
- Must not be validated against the real `Workspace` table.
- Must not trigger workspace creation, invitation, role assignment, or membership mutation.

## State Transitions

### PaymentTransaction

```text
PENDING -> SUCCEEDED
PENDING -> FAILED
PENDING -> CANCELLED
PENDING -> EXPIRED
PENDING -> REJECTED
SUCCEEDED -> SUCCEEDED (idempotent duplicate confirmation)
```

### UserSubscription

```text
none/free -> ACTIVE Plus after confirmed Plus payment
none/free/plus -> ACTIVE Business after confirmed Business payment with mock businessWorkspaceId
ACTIVE paid -> EXPIRED when periodEnd passes
ACTIVE paid -> CANCELLED only through explicit later lifecycle work
```

## Relationships

- `User` has many `PaymentTransaction` records.
- `SubscriptionPlan` has many `PaymentTransaction` records.
- `PaymentTransaction` has many `PaymentConfirmation` audit records.
- `PaymentTransaction` may activate one `UserSubscription`.
- `UserSubscription.businessWorkspaceId` is a string value, not a foreign key to `Workspace`.
