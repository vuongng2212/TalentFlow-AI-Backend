# Implementation Plan: MoMo Payment Module

**Branch**: `Bero/feat/momo-payment` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/020-momo-payment/spec.md`

## Summary

Add a Gateway-owned `payments` module that creates a durable, server-priced MoMo Wallet checkout, accepts only verified MoMo IPN as payment authority, processes each final result once, produces an immutable commercial receipt, and preserves a reconciliation/audit trail. The implementation is localized to `api-gateway/`, its Prisma schema/migration, its API Gateway deployment configuration, and its tests. It introduces no CV Parser, Notification, RabbitMQ, subscription, or workspace-entitlement change.

The payment module uses MoMo AIO v2 `captureWallet` checkout through one isolated adapter. It persists an internal Payment and provider-stable order/request references before calling MoMo. PostgreSQL uniqueness, serializable transactions, and durable work leases—not Redis or a browser redirect—provide the idempotency and recovery guarantees.

## Technical Context

**Primary Runtime**: `api-gateway` (NestJS)

**Language/Version**: TypeScript 6.0.3 on Node 20 container runtime

**Primary Dependencies**: NestJS 11.1, Prisma 6.19 with PostgreSQL, `@nestjs/config`/Joi, `@nestjs/schedule`, built-in `fetch`/`crypto`, AWS S3 SDK for private invoice objects, `pdfkit` plus types for deterministic PDF receipt rendering

**Storage**: PostgreSQL payment records and audit trail; a separate private S3/R2-compatible invoice bucket; no new queue or cross-service broker topology

**Testing**: Focused Jest unit tests, gateway E2E tests, then `npm test`, `npm run test:e2e`, `npm run lint`, and `npm run build`

**Target Platform**: Local Node 20 development and Kubernetes Gateway replicas with PostgreSQL and private object storage

**Project Type**: Polyglot backend services; this feature modifies only the API Gateway boundary

**Performance Goals**:

- Persist and acknowledge a valid MoMo IPN with HTTP 204 within 15 seconds.
- Complete durable local outcome processing for 99.9% of verified results within 60 seconds; retain/retry the remainder visibly.
- Issue one retrievable receipt or a retryable render exception within 60 seconds of success processing.

**Constraints**:

- MoMo AIO v2 Wallet `captureWallet`, VND only, 1,000–50,000,000 VND provider limits.
- MoMo's `requestId` is provider idempotency; use the same provider request/order identifiers for recovery of one Payment.
- IPN must be public but HMAC-SHA256 verified and database matched; redirects and client status are untrusted display signals.
- The raw client idempotency key, MoMo secret, access key, raw signature, persistent public invoice URL, and unnecessary provider payload fields must not be logged, stored, or returned.
- Database transactions must not remain open during MoMo calls, PDF rendering, or object storage calls.
- Existing Subscription plan selection and `Workspace.isBusiness` remain unchanged.

**Scale/Scope**: One new `payments` module; one Prisma migration with seven payment/audit work tables plus enums; one OpenAPI contract; one controlled external MoMo adapter; one scheduled database work worker; and one private receipt storage path.

## Constitution Check

### Before research — PASS

- **Runtime truth first**: The current Gateway has no payment/invoice runtime. Existing workspace context, JWT/public-route decorators, Prisma, storage, scheduling, logging, and subscription code define the integration boundaries used here.
- **Active docs only**: Planning artifacts are limited to `specs/020-momo-payment/`; frozen legacy directories are not used as requirements.
- **Explicit service boundaries**: API Gateway owns the HTTP, provider, persistence, storage, and scheduler work. CV Parser and Notification are unchanged.
- **Edge validation**: DTO validation, client-idempotency hashing, strict HMAC canonicalization, provider/database matching, configuration validation, and private-download authorization happen at their ingress boundaries.
- **Test contract / TDD**: RED-first unit and E2E tests are a Phase 2 gate. No implementation work begins before the identified failing tests exist.
- **Operate safely**: Durable work records, leases, correlation identifiers, safe logs, counters, reconciliation, and deterministic non-regression states replace hidden retries.
- **Schema discipline**: Prisma schema and one hand-reviewed migration are planned together.

### After design — PASS

The selected architecture preserves all constitution principles. The only added complexity is necessary financial persistence and a third-party adapter; neither creates a cross-service consumer contract or bypasses an existing guardrail.

## Resolved design decisions

1. **Checkout**: Use MoMo AIO v2 `POST /v2/gateway/api/create` with `requestType: captureWallet` and `autoCapture: true`. The Gateway returns `payUrl` when ready. A create response with `resultCode: 0` means the checkout was created, not that the payment succeeded.
2. **Payable items**: `PaymentCatalogService` resolves `payableItemCode` from server-controlled `PAYMENT_CATALOG_JSON`; it returns a trusted VND quote with tax, display description, and terms version. The Payment snapshots it. The module does not modify the price-less `Plan` catalogue or grant a plan entitlement.
3. **Initiation idempotency**: Require `Idempotency-Key` for `POST /payments`. Hash the key and bind it to requester, resolved workspace, operation, and a fingerprint of the trusted quote. PostgreSQL is the only authority. The first transaction creates Payment, idempotency, audit, and checkout work together.
4. **Provider references**: Generate separate stable `momoOrderId` and UUID-v4 `momoRequestId` per Payment. Retry/check status with exactly those values; never expose a client key to MoMo.
5. **Result authority**: `POST /payments/momo/ipn` is the sole result intake. It verifies MoMo's precise `captureWallet` HMAC field sequence with constant-time comparison, then matches partner, order, request, VND amount, expected order information, and transaction identity against the stored Payment. `redirectUrl` only returns the user to the frontend.
6. **Terminal effects**: The IPN transaction conditionally changes only a pending payment, writes a scrubbed receipt/audit record, and inserts a deterministic work item. The scheduled worker performs result effects and invoice work outside the IPN deadline.
7. **Receipt**: Success processing creates one immutable commercial receipt and a deterministic private PDF object key. `pdfkit` renders only persisted snapshots. An authorized active workspace member receives a short-lived signed link; no public object URL is stored.
8. **Recovery**: A multi-replica-safe scheduled worker claims due records through PostgreSQL row locks with leases. It retries checkout creation, MoMo query reconciliation, effect application, invoice issuance, and rendering with backoff. A failed receipt render does not regress the Payment.

## Project Structure

### Documentation

```text
specs/020-momo-payment/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── payments.openapi.yaml
```

### Source changes

```text
api-gateway/
├── prisma/
│   ├── schema.prisma                         # Payment models/enums/relations
│   └── migrations/<timestamp>_add_momo_payments/
│       └── migration.sql                     # tables, constraints, indexes
├── src/
│   ├── app.module.ts                         # import PaymentsModule
│   ├── common/config/config.schema.ts        # protected MoMo/payment config validation
│   ├── payments/
│   │   ├── dto/
│   │   │   ├── create-payment.dto.ts
│   │   │   └── momo-ipn.dto.ts
│   │   ├── payments.module.ts
│   │   ├── payments.controller.ts            # authenticated tenant-facing endpoints
│   │   ├── momo-ipn.controller.ts            # public, HMAC-only IPN boundary
│   │   ├── payments.service.ts               # idempotency and read/reconcile orchestration
│   │   ├── payment-catalog.service.ts        # trusted payable item/quote resolver
│   │   ├── payment-recovery.service.ts       # scheduled durable-work worker
│   │   ├── payment-work.repository.ts        # atomic lease/claim SQL
│   │   ├── payment-audit.service.ts
│   │   ├── momo/
│   │   │   ├── momo.client.ts                # signed create/query HTTP adapter
│   │   │   ├── momo-signature.service.ts     # fixed canonical HMAC verification
│   │   │   └── momo.types.ts
│   │   └── invoice/
│   │       ├── invoice.service.ts
│   │       ├── invoice-renderer.service.ts
│   │       └── invoice-storage.service.ts    # private bucket + signed GET
│   └── payments/**/*.spec.ts                 # RED-first unit tests beside ownership
├── test/payments.e2e-spec.ts                 # cookie auth, tenant, IPN, concurrency coverage
├── .env.example                              # non-secret shape/placeholders only
└── package.json                              # PDF renderer dependency and types

k8s/api-gateway/
├── configmap.yaml                            # non-secret URLs, numeric policy, catalogue
└── secret.yaml                               # MoMo credentials and private storage credentials
```

**Structure decision**: All feature runtime work begins in `api-gateway/src/payments/`; its schema is in `api-gateway/prisma/`. The only deployment changes are Gateway configuration and credentials. No `cv-parser/`, `notification/`, queue topology, or frontend source is changed in this plan.

## Delivery phases

### Phase 0: Discovery and contract check — complete

- Confirmed that `api-gateway/src/subscriptions/` has current workspace/role conventions but no price or fulfilment contract; payment must not mutate it.
- Confirmed public external routes use `@Public()` and `@SkipWorkspaceContext()`; payment IPN requires a MoMo verifier rather than the existing static API-key guard.
- Confirmed Prisma uses text UUID IDs and manual SQL migrations; no generic financial idempotency, outbox, or invoice renderer exists.
- Confirmed `ScheduleModule` already runs in the Gateway, while RabbitMQ is CV-specific; database-backed payment work avoids a new cross-service messaging contract.
- Confirmed current R2 storage defaults to a public CV bucket; receipts require a distinct private bucket adapter.
- Researched MoMo's official Wallet, IPN, idempotency, result-code, and query behaviour. See [research.md](./research.md).

### Phase 1: Design and data shape — complete

- Defined immutable Payment, idempotency, provider-receipt, work, outcome, invoice, and audit models with state machines and database invariants in [data-model.md](./data-model.md).
- Defined an HTTP/OpenAPI contract for customer initiation, status/history, receipt retrieval/download, explicit reconciliation, and public MoMo IPN in [payments.openapi.yaml](./contracts/payments.openapi.yaml).
- Defined local/deployment setup and safe test fixtures in [quickstart.md](./quickstart.md).
- Selected `PAYMENT_CATALOG_JSON` as the explicit server-side payable-item boundary. Its deployment values must be product-approved, but the module remains generic and never receives money from clients.
- Defined protected configuration:

  | Configuration | Classification | Rule |
  | --- | --- | --- |
  | `MOMO_API_BASE_URL` | non-secret | HTTPS URI; test or production base URL |
  | `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY` | credentials | Required outside test; Secret only |
  | `MOMO_IPN_URL`, `MOMO_REDIRECT_URL` | non-secret URLs | Required HTTPS absolute URLs in production |
  | `MOMO_REQUEST_TIMEOUT_MS` | non-secret | Minimum 30,000 ms, matching MoMo guidance |
  | `PAYMENT_CATALOG_JSON` | controlled business configuration | Validated JSON; only enabled VND items with integer amounts/tax and a terms version |
  | `PAYMENT_RECOVERY_*` | non-secret policy | Positive bounded retry, lease, and reconciliation timings |
  | `PAYMENT_INVOICE_BUCKET`, `PAYMENT_INVOICE_URL_TTL_SEC` | non-secret/private storage policy | Private bucket only; bounded signed-link duration |
  | `PAYMENT_RECEIPT_ISSUER_*` | non-secret display metadata | Validated receipt issuer snapshot; not a claim of tax-invoice compliance |

### Phase 2: Implementation by service — planned

#### 2.1 RED: foundation, configuration, schema, and provider adapter

1. Write failing tests for config refusal, catalogue resolution, canonical request signing, fixed callback-signature verification, and mismatch/invalid-signature behaviour.
2. Add `PaymentsModule` and config schema entries. Keep credentials out of defaults, `ConfigMap`, request DTOs, responses, and logs. Add clear `.env.example` placeholders only.
3. Add Prisma enums/models/relations and a hand-reviewed migration with all unique constraints and recovery indexes described in [data-model.md](./data-model.md). Update generated client as part of normal Prisma workflow.
4. Implement `MomoClient` over Node `fetch`: signed create and signed query, fixed request/response types, a 30-second-or-greater timeout, sanitized error mapping, and no controller-level provider calls.
5. Implement HMAC construction against MoMo's documented per-operation field lists, including length-safe `timingSafeEqual` verification. Do not use JSON stringify/object-order signing.

#### 2.2 RED: idempotent customer payment initiation

1. Write failing service/E2E tests for owner/admin creation, member/recruiter rejection, missing/malformed idempotency header, same-key same-intent replay, same-key fingerprint conflict, concurrent first calls, no client amount, and ambiguous provider timeout recovery.
2. Add `POST /api/v1/payments` with `@WorkspaceRoles(OWNER, ADMIN)`, resolved `WorkspaceContextService`, an `Idempotency-Key` header, and body `{ payableItemCode }` only.
3. In a serializable, bounded-retry transaction, resolve the server quote; create or replay Payment with its idempotency fields, audit entry, and `CREATE_CHECKOUT` work. Catch unique conflicts by re-reading Payment and comparing its fingerprint.
4. After commit, opportunistically claim/perform `CREATE_CHECKOUT`; return 201 with the stored payment and checkout projection when ready, or 202 with the same payment reference/status when the provider outcome is uncertain. Never create a second provider request for one Payment.
5. Include only payment reference, pending/final status, expiry/recovery information, and authorized checkout data in responses; do not expose stored provider credentials or raw provider payloads.

#### 2.3 RED: public IPN and final-state processing

1. Write failing tests for public-route metadata, required typed callback fields, valid signed success/failure, invalid HMAC, unknown order, partner/amount/request mismatch, duplicate delivery, late conflict, and a browser return that cannot mutate state.
2. Implement `POST /api/v1/payments/momo/ipn` with `@Public()`, `@SkipWorkspaceContext()`, appropriate throttle policy, and a small callback body limit. It must acknowledge persisted safely handled deliveries with 204 within 15 seconds.
3. Persist only a scrubbed result receipt and semantic fingerprint. In one transaction, deduplicate exact delivery, match the stored Payment, conditionally move only `PENDING` to a documented final state, record an audit event, and enqueue deterministic local work.
4. Map result codes deliberately: accepted `0` produces `SUCCEEDED`; documented processing codes remain pending/reconcile; final non-success codes map to `FAILED`, `EXPIRED`, `CANCELLED`, or `REJECTED`. Invalid/mismatched input is evidence only and never triggers success processing.
5. Add signed-query reconciliation for payments with an unknown checkout, overdue pending result, provider processing code, or an authorized owner/admin request. Local timers only schedule inquiry; they do not declare a payment expired.

#### 2.4 RED: durable work, once-only local outcome, and invoice

1. Write failing tests for multi-worker lease ownership, abandoned lease recovery, exact-once success/failure effect, one invoice after duplicate IPN, transaction rollback, retryable invoice rendering, and no entitlement mutation.
2. Implement database work claiming with a parameterized `FOR UPDATE SKIP LOCKED` query, lease expiry, bounded exponential backoff, and `MANUAL_REVIEW` escalation. Do not use Redis for financial exclusion.
3. Implement `APPLY_SUCCESS` and `APPLY_FAILURE` transactions. Each conditionally sets `Payment.outcomeRecordedAt` at most once; success creates at most one Invoice, audit entry, and render work. No work changes `Subscription`, `Workspace.isBusiness`, or Notification.
4. Add a deterministic PDF renderer, private invoice storage adapter, content hash, and short-lived signed download link. Store only private bucket/key metadata; no permanent public receipt URL.
5. Add authenticated member routes for list/detail/receipt and owner/admin reconciliation. Every lookup binds payment/invoice reference to the workspace resolved by the existing guard.

#### 2.5 Documentation and operational wiring

1. Update Swagger from controller annotations and regenerate `swagger-spec.json` only when the repository convention requires it.
2. Add non-secret MoMo/payment policy values to `k8s/api-gateway/configmap.yaml`; add credential placeholders only to `k8s/api-gateway/secret.yaml`; configure a private invoice bucket/IAM policy.
3. Add structured safe logs with payment reference, provider reference where available, idempotency decision, work kind/state, and safe reason code. Add counters/histograms without high-cardinality reference labels for creation, IPN verification, final transitions, work retry/manual-review, and invoice rendering.
4. Document alerts for verification failures, payments pending beyond recovery policy, manual-review work, and invoice render failures. Do not make MoMo a readiness dependency.

### Phase 3: Verification and hardening — planned

1. Run focused payment unit tests first, including signature fixtures produced from official MoMo test credentials or deterministic local fixtures.
2. Run `test/payments.e2e-spec.ts` against a test database: cookie auth, `x-workspace-id`, role restrictions, cross-workspace denial, idempotency concurrency, callback duplicates/out-of-order results, work recovery, and one receipt per successful payment.
3. Exercise the MoMo test environment only with sandbox credentials: initiate a VND test payment, observe IPN, verify receipt access, replay the exact callback, and verify a late conflict cannot regress success.
4. Run the full Gateway validation commands and inspect generated Swagger/config diffs. Confirm no secrets, raw signatures, or permanent private invoice URLs appear in logs/responses.

## Validation commands

```powershell
Set-Location D:\Project\TalentFlow-AI\TalentFlow-AI-Backend\api-gateway
npm test
npm run test:e2e
npm run lint
npm run build
```

## Local verification strategy

1. Start with unit tests for pure HMAC/canonicalization, catalogue, idempotency conflict handling, state transitions, work lease ownership, and invoice uniqueness.
2. Add controller and E2E tests that use the existing cookie-only JWT flow and workspace context instead of assuming a bearer token is accepted at runtime.
3. Run the new migration against a disposable PostgreSQL database; test concurrent initial requests after the schema constraints exist.
4. Use a private MinIO/R2-compatible test bucket for PDF uploads. Assert only signed download URLs are returned after tenant authorization.
5. Use MoMo sandbox end-to-end after local tests pass. Never use production credentials or real customer data in fixtures.

## Complexity tracking

| Addition | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| Durable payment/idempotency/work/audit schema | Financial callbacks, retries, and invoices must survive process restarts and replicas | In-memory or Redis-only state cannot guarantee cross-replica uniqueness or auditability |
| Isolated MoMo adapter and HMAC verifier | External provider has strict per-operation signing and recovery semantics | Signing in controllers or generic JSON signing is unsafe and hard to test |
| Private PDF receipt object storage | Users require durable downloadable receipts without public disclosure | Reusing the public CV bucket/permanent URL leaks financial documents |
| Database lease worker | Checkout/query/render work can exceed IPN response deadline and fail transiently | Synchronous IPN processing risks missed acknowledgements and duplicate side effects |

## Agent context update

The managed Spec Kit section of `AGENTS.md` must reference this plan after the plan artifacts are written, preserving all manual instructions outside its markers.
