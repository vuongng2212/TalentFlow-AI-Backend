# Research: Subscription Billing

## Decision: Use MoMo official Payment Platform NodeJS integration assets behind a local adapter

**Rationale**: The user explicitly requested MoMo billing for both development and production and asked to use MoMo's library. MoMo's official payment repository includes NodeJS integration examples for online, offline, and mobile MoMo payment methods, and its documentation points implementers back to `developers.momo.vn`. The implementation should reuse the official NodeJS sample/library shape as the basis for signing, request creation, and provider response handling, but wrap it in a local `MomoBillingClient` so the gateway can enforce DTO validation, idempotency, logging, and persistence.

**Alternatives considered**:

- Third-party npm packages with MoMo keywords: rejected for planning because they are not the primary source of truth for MoMo Vietnam.
- Hand-rolled MoMo HTTP calls only: rejected because the user asked to use MoMo's library, and official sample/library code reduces drift from provider expectations.

**Primary references**:

- https://github.com/momo-wallet/payment
- https://developers.momo.vn/v3/docs/payment/api/wallet/onetime/
- https://developers.momo.vn/v3/vi/docs/payment/api/wallet/subscription/
- https://developers.momo.vn/v3/docs/payment/api/other/signature/

## Decision: Use MoMo subscription checkout request for Plus and Business paid plans

**Rationale**: MoMo's subscription documentation describes recurring subscription payments and uses `POST /v2/gateway/api/create` with `requestType` set to `subscription`. It requires unique `requestId`, unique `orderId`, merchant/user identifiers, `redirectUrl`, `ipnUrl`, `subscriptionInfo`, and signed request data. This fits paid plan checkout better than direct internal activation because the first purchase can create a provider-backed authorization/payment result.

**Alternatives considered**:

- MoMo one-time `captureWallet`: kept as fallback only if product decides this release is not true recurring billing. It supports web/mobile checkout, `requestId`, `orderId`, `ipnUrl`, and signed request data, but it does not represent a subscription authorization.
- Manual internal activation: rejected because paid subscriptions must be activated only from trusted payment confirmation.

## Decision: Internal confirmation activates subscriptions, not client redirect

**Rationale**: MoMo redirect is user-facing and cannot be trusted by itself. The gateway must verify provider result signatures and match them against the pending payment transaction before an authorized internal actor or trusted internal process confirms activation. Duplicate confirmations must be idempotent because MoMo and operators may retry.

**Alternatives considered**:

- Activate on checkout response: rejected because MoMo checkout creation is not proof of payment.
- Activate on client callback only: rejected because client-controlled claims can be forged or replayed.

## Decision: Roll back workspace coupling from subscription billing

**Rationale**: The active runtime currently contains workspace-facing subscription behavior from the previous wider scope: workspace subscription endpoints, Business activation by workspace id, workspace member/admin checks, `Workspace.isBusiness` mutation, workspace quota/entitlement paths, and workspace subscription models. Spec 016 requires billing and subscription only. Business activation now stores a mock `businessWorkspaceId` in subscription-owned state and does not create or mutate any workspace data.

**Alternatives considered**:

- Keep workspace routes but hide them from users: rejected because active HTTP surfaces and service calls would still violate scope.
- Keep `WorkspaceSubscription` as the Business source of truth: rejected because it implies a real workspace lifecycle relationship in a feature that must not depend on workspace.

## Decision: Persist payment transactions and confirmation audit in the gateway

**Rationale**: Billing state must be durable and auditable. The gateway needs to reconcile pending payments, rejected confirmations, successful activations, duplicate provider events, and operator review. A durable `PaymentTransaction` model with confirmation fields or a child confirmation audit table is required for safe idempotency.

**Alternatives considered**:

- Store pending payments in memory or cache: rejected because payment confirmation can arrive after restart or delayed provider retries.
- Store only active subscription records: rejected because failed and rejected confirmations would not be auditable.
