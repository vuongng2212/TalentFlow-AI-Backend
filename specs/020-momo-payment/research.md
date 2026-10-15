# Research: MoMo Payment Module

**Date**: 2026-09-18  
**Feature**: `020-momo-payment`  
**Scope**: API Gateway only; one-time MoMo Wallet checkout, durable result processing, receipts, and reconciliation.

## R-01: Owning boundary and checkout product

### Decision

Implement the feature in `api-gateway/` as a new `payments` NestJS module. Use MoMo AIO v2 one-time wallet checkout: `POST /v2/gateway/api/create` with `requestType: captureWallet` and automatic capture enabled. The module will return MoMo's `payUrl` as the initial checkout instruction; `deeplink` and `qrCodeUrl` are optional projections only when the merchant account enables them.

### Rationale

- The running API Gateway already owns the authenticated HTTP boundary, workspace authorization, Prisma persistence, R2 access, scheduling, logging, and the subscription catalogue.
- MoMo documents `captureWallet` for desktop and mobile checkout, with VND amounts from 1,000 to 50,000,000, an `orderId`, a provider-idempotent `requestId`, `redirectUrl`, and server-to-server `ipnUrl`. [MoMo One-Time Payments](https://developers.momo.vn/v3/docs/payment/api/wallet/onetime/)
- The scope explicitly leaves CV Parser, Notification, payment-provider alternatives, and subscription entitlement mutation untouched.

### Alternatives considered

1. **Collection Link (`payWithMethod`)** — supports more payment methods, but would silently broaden a MoMo-wallet requirement to ATM/card checkout. Defer until that product decision is made.
2. **MoMo SDK in the controller** — spreads provider signing and error handling into HTTP code. Rejected in favour of a typed provider adapter.
3. **A new billing microservice** — no live service, deployment, or consumer contract exists. Rejected for this Gateway-owned release.

## R-02: Server-approved payable items and price snapshots

### Decision

Add a `PaymentCatalogService` inside the payment module. It resolves a client-supplied `payableItemCode` solely from a deployment-managed `PAYMENT_CATALOG_JSON` configuration value, validates that the code is enabled, and returns a trusted quote with a VND amount, tax amount, item description, and terms version. The client never supplies money, tax, currency, item text, or entitlement values. Each accepted payment copies that quote to its immutable charge snapshot.

The first release deliberately does **not** treat the current `Plan` rows as payable products. The live `Plan` model has no price, tax, billing period, or fulfilment contract, and its existing `PUT /subscriptions/current` changes entitlement immediately. A future subscription purchase flow must provide its own server-side payable-item resolver and consume only the deduplicated confirmed-payment outcome.

### Rationale

- This resolves the specification's required server-approved payable item without inventing plan prices or allowing browser-controlled amounts.
- Configuration is reviewed and deployed server-side; the stored snapshot protects historical payments and invoices from later catalogue changes.
- It preserves the explicit compatibility rule: no subscription or workspace entitlement changes occur in this feature.

### Alternatives considered

1. **Accept `amount` in `POST /payments`** — violates FR-002 and FR-016. Rejected.
2. **Make the existing subscription plan directly payable** — its live model lacks pricing and successful payment would give a customer no approved fulfilment. Rejected.
3. **Add a public payment-product administration API** — expands the requested payment flow into catalogue administration. Rejected.

## R-03: Initiation idempotency and uncertain provider creation

### Decision

Use PostgreSQL, not Redis, as the authority for initiation idempotency. Store the unique scope `(requesterId, workspaceId, operation, keyDigest)` and a SHA-256 fingerprint of the *trusted* quote and operation directly on Payment. The raw `Idempotency-Key` header is never stored or logged.

In a short serializable Prisma transaction, persist the pending Payment, immutable quote, idempotency fields, audit entry, and `CREATE_CHECKOUT` processing record. On a unique conflict, reload the existing Payment: equal fingerprint returns its original payment projection; different fingerprint produces HTTP 409. Retry bounded Prisma serialization failures (`P2034`) with jitter. No database transaction spans an HTTP call to MoMo.

Generate a distinct, stable MoMo `requestId` (UUID v4) and MoMo-safe `orderId` for each internal Payment. Reuse both for every retry or recovery of that Payment. On timeout or an in-progress provider response, leave the Payment pending with checkout status `UNKNOWN`, then reconcile it with MoMo Query before considering a new checkout.

### Rationale

- MoMo makes AIO v2 POST requests idempotent on `requestId`; it recommends UUID v4 and retains keys for at least 31 days. Retrying the same provider `requestId` avoids a second charge. [MoMo API Idempotency](https://developers.momo.vn/v3/docs/payment/api/result-handling/idempotency/)
- PostgreSQL unique constraints decide concurrent first requests across Gateway replicas. Prisma documents serializable transaction retries for write conflicts. [Prisma transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- The provider query endpoint is the safe recovery mechanism for ambiguous checkout creation; local time must not by itself mark a payment expired. [MoMo transaction query](https://developers.momo.vn/v3/docs/payment/api/payment-api/query/)

### Alternatives considered

1. **Redis `SETNX` lock** — process-local expiry and cache loss cannot protect financial uniqueness. Rejected.
2. **Reuse the client key as MoMo `requestId`** — exposes client-controlled semantics to the provider and prevents a stable, provider-specific identifier. Rejected.
3. **Call MoMo before persistence** — a timeout could create an untraceable checkout. Rejected.

## R-04: IPN, signature verification, and result-state authority

### Decision

Expose a minimal public `POST /api/v1/payments/momo/ipn` endpoint with `@Public()` and `@SkipWorkspaceContext()`. It will validate a typed callback DTO, construct MoMo's documented fixed canonical string for `captureWallet`, calculate HMAC-SHA256 using the protected secret, compare with `timingSafeEqual`, and match the verified fields to the stored payment before any state transition.

The IPN route records a scrubbed provider-result receipt, deduplicates by a SHA-256 semantic key over signed identity fields, conditionally transitions only a pending payment to its terminal outcome, creates the necessary processing record and audit entry in the same transaction, then returns `204 No Content`. It must meet MoMo's 15-second acknowledgement limit. A browser redirect only renders customer UX; it cannot change payment state.

### Rationale

- MoMo specifies POST JSON IPN, a 204 response within 15 seconds, HMAC verification, and matching provider/order/amount data with the merchant database. [MoMo Payment Notification](https://developers.momo.vn/v3/docs/payment/api/result-handling/notification/)
- The wallet documentation gives the exact creation and IPN canonical field lists; serializing arbitrary JSON or sorting a changed callback object would create a signature-verification defect. [MoMo One-Time Payments](https://developers.momo.vn/v3/docs/payment/api/wallet/onetime/)
- `resultCode: 0` on the *create* response means checkout creation succeeded, not that money was paid. Payment success comes only from verified result processing.

### Alternatives considered

1. **Trust `redirectUrl` parameters** — browsers can be closed, replayed, or tampered with. Rejected.
2. **A shared API-key webhook guard** — MoMo's protocol uses per-message HMAC verification, not a static caller key. Rejected.
3. **Persist raw callback bodies/signatures** — unnecessary sensitive data and log risk. Rejected; retain only safe mapped fields and a one-way fingerprint.

## R-05: Terminal mapping, duplicate handling, and recovery

### Decision

Model payment state separately from checkout state and callback verification. `PaymentStatus` is `PENDING`, `SUCCEEDED`, `FAILED`, `EXPIRED`, `CANCELLED`, or `REJECTED`; final values never regress. `PaymentCheckoutStatus` tracks whether a checkout is `NOT_REQUESTED`, `REQUESTING`, `READY`, `UNKNOWN`, or `UNAVAILABLE`. `PaymentProviderResult` records `VERIFIED`, `REJECTED`, `DUPLICATE`, or `CONFLICT_IGNORED` reception independently.

Map verified result code `0` to `SUCCEEDED`. Keep processing/in-progress codes pending and schedule a signed query. Map documented terminal failures to `FAILED`, `EXPIRED`, `CANCELLED`, or `REJECTED` by an internal safe reason code. A later result for a final payment is retained as a conflict and cannot overwrite the final state. Invalid signatures, unknown orders, and mismatches are rejected without changing a Payment.

### Rationale

- MoMo's result-code guidance distinguishes successful, waiting/processing, and final failure states; HTTP status alone is insufficient. [MoMo result codes](https://developers.momo.vn/v3/docs/payment/api/result-handling/resultcode/)
- Separating these concerns preserves evidence for support while keeping state transitions deterministic.

### Alternatives considered

1. **One Boolean `paid`** — cannot represent failed checkout creation, pending reconciliation, or terminal conflict evidence. Rejected.
2. **Let a late failure reverse success** — violates once-only fulfilment and audit integrity. Rejected.

## R-06: Exactly-once local processing and invoice delivery

### Decision

Use durable, lease-claimed `PaymentProcessingRecord` rows for checkout creation, reconciliation, success processing, failure processing, invoice issuance, and invoice rendering. Every record has a unique deterministic work key, attempt count, next-run time, lease owner/expiry, and safe error code. A Nest schedule worker atomically claims due work with PostgreSQL row locks (`FOR UPDATE SKIP LOCKED`), does external I/O outside a database transaction, and completes/retries only while it owns the lease.

On a successful payment, one short transaction creates the once-only internal outcome, the one-per-payment Invoice row, an audit event, and an `RENDER_INVOICE` record. Invoice references and invoice-payment relations are unique. The PDF renderer uses only the stored snapshot and issue timestamp, uploads to a separate private invoice bucket under a deterministic key, and retries the same key after a failure. Download returns a short-lived signed URL only after active-workspace authorization.

### Rationale

- The Gateway already has `ScheduleModule`; adding RabbitMQ payment messages would create an unnecessary cross-service contract.
- PostgreSQL documents `SKIP LOCKED` as appropriate for queue-like multi-consumer access. [PostgreSQL locking clauses](https://www.postgresql.org/docs/current/sql-select.html)
- A durable unique record gives exactly-once **local** database effects. A future remote consumer must still consume a published outcome idempotently; no distributed system can guarantee literal one-time external delivery across a database and network boundary.

### Alternatives considered

1. **Run all fulfilment and PDF work in the IPN request** — risks violating MoMo's response deadline and makes outage recovery unsafe. Rejected.
2. **Rely on one application instance or in-memory timers** — loses work after restart and duplicates with replicas. Rejected.
3. **Use the existing CV R2 public bucket** — invoice documents must not receive a permanent public URL. Rejected.

## Resolved design summary

- API Gateway is the only runtime changed.
- MoMo Wallet AIO v2 `captureWallet` is the only provider operation in v1.
- A server-only payment catalogue resolves items and money; Payment snapshots are immutable.
- PostgreSQL uniqueness and serializable transactions enforce client initiation idempotency; stable MoMo references enforce provider retry safety.
- Only verified MoMo IPN or signed query changes a Payment; redirects are display-only.
- Durable records, leases, and database uniqueness deliver once-only local outcomes, invoice issuance, and retriable rendering.
- Existing subscription/entitlement behaviour remains unchanged until an explicit future outcome-consumer contract exists.
