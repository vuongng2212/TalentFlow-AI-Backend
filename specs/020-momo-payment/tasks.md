---
description: "Dependency-ordered implementation tasks for the MoMo payment module"
---

# Tasks: MoMo Payment Module

**Input**: Design documents from `D:\Project\TalentFlow-AI\TalentFlow-AI-Backend\specs\020-momo-payment\`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/payments.openapi.yaml`, and `quickstart.md`

**Tests**: Required. The specification and plan mandate TDD: write focused tests, observe them fail against the missing behavior, then implement the matching slice.

**Organization**: Tasks are grouped by user story so each delivery slice remains independently testable. API Gateway is the only runtime boundary changed; do not change Subscription, `Workspace.isBusiness`, CV Parser, Notification, or RabbitMQ topology.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it uses a different file and has no dependency on an incomplete task.
- **[Story]**: User-story label (`[US1]`, `[US2]`, `[US3]`, or `[US4]`).
- Every task includes its exact target path.

## Path Conventions

- API Gateway runtime: `api-gateway/src/`
- Prisma schema and migration: `api-gateway/prisma/`
- Gateway unit tests: `api-gateway/src/payments/**/*.spec.ts`
- Gateway end-to-end tests: `api-gateway/test/payments.e2e-spec.ts`
- Deployment configuration: `k8s/api-gateway/`
- Active feature documents: `specs/020-momo-payment/`

## Phase 1: Setup and Contract Lock

**Purpose**: Freeze the payment boundary before tests encode it, including the rule that an IPN—not a browser redirect—is the sole provider-result authority.

- [X] T001 Verify the request/response envelope, status codes, idempotency header, tenant authorization, public IPN shape, and private receipt rules in `specs/020-momo-payment/contracts/payments.openapi.yaml`

---

## Phase 2: Foundational Persistence, Configuration, and Provider Safety

**Purpose**: Establish the shared financial persistence, protected configuration, provider adapter, and durable-work primitives that every user story requires.

### Tests for Foundational Work — write and observe RED first

- [X] T002 [P] Add failing validation tests for missing/invalid MoMo credentials, HTTPS URLs, timeout limits, private-bucket policy, recovery bounds, receipt issuer fields, and controlled VND catalogue JSON in `api-gateway/src/common/config/config.schema.spec.ts`
- [X] T003 [P] Add failing catalogue-resolution tests for enabled server-owned VND items, rejected client money fields, integer provider limits, and immutable trusted quote output in `api-gateway/src/payments/payment-catalog.service.spec.ts`
- [X] T004 [P] Add failing unit tests for fixed MoMo `captureWallet` create/query canonical strings, IPN canonicalization, malformed signatures, and length-safe HMAC comparison in `api-gateway/src/payments/momo/momo-signature.service.spec.ts`
- [X] T005 [P] Add failing adapter tests for signed create/query calls, stable provider identifiers, 30-second-or-greater abort handling, sanitized provider errors, and no raw payload logging in `api-gateway/src/payments/momo/momo.client.spec.ts`
- [X] T006 [P] Add failing repository tests for deterministic work-key insertion, lease ownership, expired-lease reclaiming, and conditional completion without Redis exclusion in `api-gateway/src/payments/payment-work.repository.spec.ts`

### Implementation for Foundational Work

- [X] T007 Add and validate the protected MoMo, payment catalogue, recovery, private-receipt, and issuer configuration entries without default credentials in `api-gateway/src/common/config/config.schema.ts`
- [X] T008 [P] Add non-secret payment configuration names and redacted placeholders only in `api-gateway/.env.example`
- [X] T009 [P] Add `pdfkit` and its TypeScript type package for deterministic receipt rendering in `api-gateway/package.json`
- [X] T010 Add the documented payment enums, seven payment/audit/work models, Workspace/User relations, foreign keys, unique constraints, and recovery indexes in `api-gateway/prisma/schema.prisma`
- [X] T011 Create the hand-reviewed transactional payment migration with enums, tables, constraints, indexes, and no historical subscription backfill in `api-gateway/prisma/migrations/<timestamp>_add_momo_payments/migration.sql`
- [X] T012 Regenerate and type-check the Prisma Client for the completed payment schema in `api-gateway/prisma/schema.prisma`
- [X] T013 Define the typed, non-secret MoMo create/query/IPN contracts and documented result-code categories in `api-gateway/src/payments/momo/momo.types.ts`
- [X] T014 Implement validated server-owned payable-item lookup and trusted immutable VND quote construction in `api-gateway/src/payments/payment-catalog.service.ts`
- [X] T015 Implement fixed-field HMAC-SHA256 create/query signing and constant-time IPN verification without JSON-object-order signing in `api-gateway/src/payments/momo/momo-signature.service.ts`
- [X] T016 Implement the isolated `fetch`-based MoMo create/query adapter with stable request/order references, timeout cancellation, and sanitized failures in `api-gateway/src/payments/momo/momo.client.ts`
- [X] T017 Implement append-only, scrubbed payment audit recording that cannot store client keys, credentials, raw signatures, checkout URLs, or arbitrary callback bodies in `api-gateway/src/payments/payment-audit.service.ts`
- [X] T018 Implement deterministic work insertion plus parameterized `FOR UPDATE SKIP LOCKED` lease claim, retry, and completion operations in `api-gateway/src/payments/payment-work.repository.ts`
- [X] T019 Create and register the foundational payments providers, without exposing a controller until its story tasks, in `api-gateway/src/payments/payments.module.ts` and `api-gateway/src/app.module.ts`

**Checkpoint**: The Gateway can validate safe payment configuration, persist all required financial records, construct/verify provider messages, and coordinate durable work without provider I/O inside a database transaction.

---

## Phase 3: User Story 1 - Start a MoMo Payment Once (Priority: P1)

**Goal**: An active workspace owner or administrator starts exactly one server-priced MoMo checkout for one idempotent request, with a durable pending payment before provider I/O.

**Independent Test**: An eligible owner/admin creates a payment and receives one stored pending payment plus checkout instruction. Replaying the same trusted request and idempotency key returns the same payment; a changed intent, unauthorized caller, or ineligible item creates nothing.

### Tests for User Story 1 — write and observe RED first

- [X] T020 [P] [US1] Add failing service tests for serializable payment creation, key hashing, trusted-quote fingerprinting, same-key replay, fingerprint conflict, bounded serialization retry, and no client-supplied amount/tax/currency in `api-gateway/src/payments/payments.service.spec.ts`
- [X] T021 [P] [US1] Add failing recovery tests for one stable `CREATE_CHECKOUT` work item, provider-timeout `UNKNOWN` state, and reuse of the original MoMo request/order references in `api-gateway/src/payments/payment-recovery.service.spec.ts`
- [X] T022 [P] [US1] Add failing controller tests for the required `Idempotency-Key`, body containing only `payableItemCode`, `OWNER`/`ADMIN` metadata, masked provider data, and 201/202/409 mappings in `api-gateway/src/payments/payments.controller.spec.ts`
- [X] T023 [P] [US1] Add E2E coverage for cookie-authenticated owner/admin creation, recruiter/member denial, invalid catalogue input, missing/malformed key, same-key replay, fingerprint conflict, concurrent first requests, and cross-workspace isolation in `api-gateway/test/payments.e2e-spec.ts`

### Implementation for User Story 1

- [X] T024 [P] [US1] Create the DTO that accepts only `payableItemCode` and rejects money-, provider-, and entitlement-bearing fields in `api-gateway/src/payments/dto/create-payment.dto.ts`
- [X] T025 [US1] Implement the bounded serializable transaction that resolves the workspace quote, creates/replays `Payment` with embedded idempotency fields, records an audit event, and enqueues one `CREATE_CHECKOUT` record in `api-gateway/src/payments/payments.service.ts`
- [X] T026 [US1] Implement scheduled and opportunistic checkout creation after commit, preserving one provider request/order identity and returning `READY`, `UNKNOWN`, or `UNAVAILABLE` without opening another checkout in `api-gateway/src/payments/payment-recovery.service.ts`
- [X] T027 [US1] Implement authenticated `POST /payments` with `@WorkspaceRoles(OWNER, ADMIN)`, the resolved workspace context, required idempotency header, safe response projection, and Swagger metadata in `api-gateway/src/payments/payments.controller.ts`
- [X] T028 [US1] Register the creation controller and its checkout-work dependencies in `api-gateway/src/payments/payments.module.ts`

**Checkpoint**: A repeatable authorized initiation creates one immutable pending payment and, even after a provider timeout, never creates another payment or checkout for the same idempotent intent.

---

## Phase 4: User Story 2 - Process a Verified MoMo Result Internally (Priority: P1)

**Goal**: Only a database-matched, HMAC-verified MoMo IPN can transition a pending payment and schedule exactly one internal success or failure effect.

**Independent Test**: Deliver a valid success IPN, replay it, then deliver a late failure IPN; exactly one success outcome is recorded and the final state does not regress. Repeat with a valid failure IPN and verify that no success-only outcome is created.

### Tests for User Story 2 — write and observe RED first

- [X] T029 [P] [US2] Add failing result-processing tests for verified success/failure transitions, processing result codes that remain pending, invalid HMAC, unknown orders, partner/request/amount/order-info mismatches, duplicate receipts, and final-state conflicts in `api-gateway/src/payments/payments.service.spec.ts`
- [X] T030 [P] [US2] Add failing public-boundary tests for `@Public()`, `@SkipWorkspaceContext()`, typed bounded IPN input, 204 acknowledgement, and a browser return that cannot change payment state in `api-gateway/src/payments/momo-ipn.controller.spec.ts`
- [X] T031 [P] [US2] Add failing worker tests for multi-worker lease exclusion, abandoned-lease recovery, once-only `PAYMENT_CONFIRMED`/`PAYMENT_UNSUCCESSFUL` records, and no Subscription, `Workspace.isBusiness`, or Notification mutation in `api-gateway/src/payments/payment-recovery.service.spec.ts`
- [X] T032 [P] [US2] Add E2E IPN coverage for signed success/failure, invalid or mismatched callbacks, duplicate delivery, out-of-order late conflict, 15-second-safe acknowledgement, and exactly one local outcome in `api-gateway/test/payments.e2e-spec.ts`

### Implementation for User Story 2

- [X] T033 [P] [US2] Create the bounded typed callback DTO that exposes only required MoMo fields to verification and excludes the raw signature from response/log projections in `api-gateway/src/payments/dto/momo-ipn.dto.ts`
- [X] T034 [US2] Implement the one-transaction verified-result intake: scrubbed semantic receipt, exact-duplicate accounting, Payment/database matching, pending-only final transition, audit event, and deterministic success/failure/reconciliation work enqueue in `api-gateway/src/payments/payments.service.ts`
- [X] T035 [US2] Implement public `POST /payments/momo/ipn` with HMAC-only handling, callback-size/throttle protections, safe 204 acknowledgement, and no customer status behavior in `api-gateway/src/payments/momo-ipn.controller.ts`
- [X] T036 [US2] Implement lease-owned `APPLY_SUCCESS` and `APPLY_FAILURE` processing that conditionally records `Payment.outcomeRecordedAt` once, retains retry evidence, and never changes entitlement or notification state in `api-gateway/src/payments/payment-recovery.service.ts`
- [X] T037 [US2] Register the public IPN controller, worker, and outcome-processing dependencies in `api-gateway/src/payments/payments.module.ts`

**Checkpoint**: Duplicate, invalid, or contradictory callbacks are retained as safe evidence but can neither replay internal effects nor regress a final payment.

---

## Phase 5: User Story 3 - Obtain a Successful-Payment Invoice (Priority: P2)

**Goal**: An active member of the owning workspace can view and securely download the one immutable commercial receipt for a confirmed successful payment.

**Independent Test**: Complete a payment successfully, retrieve its receipt as a workspace member, and download a short-lived private link. Replaying success processing or an invoice render retry returns the same invoice reference and never creates a second invoice; another workspace is denied.

### Tests for User Story 3 — write and observe RED first

- [X] T038 [P] [US3] Add failing invoice-service tests for success-only issuance, unique payment/invoice references, immutable snapshots, duplicate-result replay, transaction rollback, and retryable issuance in `api-gateway/src/payments/invoice/invoice.service.spec.ts`
- [X] T039 [P] [US3] Add failing deterministic PDF rendering and private-object-storage tests for content hashing, same-key retry, no permanent public URL, and bounded signed-download expiry in `api-gateway/src/payments/invoice/invoice-renderer.service.spec.ts` and `api-gateway/src/payments/invoice/invoice-storage.service.spec.ts`
- [X] T040 [P] [US3] Add failing controller tests for member-only receipt view/download, 202 while rendering, 409 for non-success payments, and no cross-workspace disclosure in `api-gateway/src/payments/payments.controller.spec.ts`
- [X] T041 [P] [US3] Add E2E coverage for one receipt after duplicate success IPNs, failed/retryable render recovery, signed-link-only download, pending/failed invoice rejection, and cross-workspace denial in `api-gateway/test/payments.e2e-spec.ts`

### Implementation for User Story 3

- [X] T042 [US3] Implement idempotent successful-payment invoice creation from persisted snapshots, immutable invoice references, issuance audit events, and `RENDER_INVOICE` work enqueue in `api-gateway/src/payments/invoice/invoice.service.ts`
- [X] T043 [US3] Implement deterministic PDF receipt rendering from persisted invoice/payment snapshots with no provider payload or secret material in `api-gateway/src/payments/invoice/invoice-renderer.service.ts`
- [X] T044 [US3] Implement private invoice upload, metadata persistence, content hashing, and bounded signed GET generation without a permanent public URL in `api-gateway/src/payments/invoice/invoice-storage.service.ts`
- [X] T045 [US3] Extend lease-owned work execution to issue an invoice once and retry its render/upload without regressing a successful payment in `api-gateway/src/payments/payment-recovery.service.ts`
- [X] T046 [US3] Implement workspace-scoped receipt read/download orchestration and safe document-status projections in `api-gateway/src/payments/payments.service.ts`
- [X] T047 [US3] Add authenticated member `GET /payments/{paymentReference}/invoice` and `/invoice/download` routes with documented 200/202/409 responses in `api-gateway/src/payments/payments.controller.ts`
- [X] T048 [US3] Register invoice issuance, rendering, private storage, and member receipt routes in `api-gateway/src/payments/payments.module.ts`

**Checkpoint**: One successful payment produces no more than one immutable receipt and its retried PDF remains private, tenant-authorized, and recoverable.

---

## Phase 6: User Story 4 - Reconcile and Support Payment History (Priority: P3)

**Goal**: Active members can inspect safe payment history, while owners/administrators can reconcile an uncertain payment without opening another charge.

**Independent Test**: An authorized workspace user finds a payment by internal reference and sees its immutable charge, result summary, invoice relation, and safe audit history. An owner/admin queues reconciliation by the existing reference; it reuses provider identifiers and never creates a new payment.

### Tests for User Story 4 — write and observe RED first

- [X] T049 [P] [US4] Add failing service tests for cursor-paginated workspace-scoped list/detail projections, non-sensitive audit history, invoice/result relations, final-payment reconciliation refusal, and deduplicated uncertain-payment enqueue in `api-gateway/src/payments/payments.service.spec.ts`
- [X] T050 [P] [US4] Add failing query-recovery tests for overdue/unknown pending payments, fixed signed MoMo query references, result re-entry through the verified processor, bounded retries, and manual-review escalation in `api-gateway/src/payments/payment-recovery.service.spec.ts`
- [X] T051 [P] [US4] Add failing controller tests for active-member list/detail metadata, owner/admin-only reconciliation, status/cursor/limit validation, and tenant-safe 404/403 behavior in `api-gateway/src/payments/payments.controller.spec.ts`
- [X] T052 [P] [US4] Add E2E coverage for payment history, safe audit projection, provider-reference correlation, member/nonmember access, explicit reconciliation, recovery after checkout uncertainty, and no duplicate payment creation in `api-gateway/test/payments.e2e-spec.ts`

### Implementation for User Story 4

- [X] T053 [US4] Implement workspace-bound payment list/detail/history projections and idempotent owner/admin reconciliation scheduling without exposing raw callback or credential data in `api-gateway/src/payments/payments.service.ts`
- [X] T054 [US4] Implement signed MoMo query recovery for unknown/overdue/processing payments, route verified query results through the same state processor, apply bounded backoff, and escalate exhausted work to `MANUAL_REVIEW` in `api-gateway/src/payments/payment-recovery.service.ts`
- [X] T055 [US4] Implement authenticated member `GET /payments` and `GET /payments/{paymentReference}` plus owner/admin `POST /payments/{paymentReference}/reconcile` routes with Swagger metadata in `api-gateway/src/payments/payments.controller.ts`

**Checkpoint**: Payment support data is searchable only within its owning workspace, and every recovery operation continues the original durable payment rather than creating a new charge.

---

## Phase 7: Polish, Deployment Wiring, and Cross-Cutting Validation

**Purpose**: Complete operational readiness, privacy protections, documentation, and regression verification after all user-story checkpoints pass.

- [X] T056 [P] Add MoMo/payment policy configuration, catalogue, recovery timing, private invoice bucket, and receipt issuer values without credentials in `k8s/api-gateway/configmap.yaml`
- [X] T057 [P] Add credential-key placeholders only—never literal MoMo or object-storage secrets—in `k8s/api-gateway/secret.yaml`
- [X] T058 [P] Add low-cardinality payment creation, IPN verification, state transition, work retry/manual-review, and invoice-render metrics in `api-gateway/src/metrics/metrics.service.ts` and `api-gateway/src/metrics/metrics.module.ts`
- [X] T059 Add structured safe payment/recovery logging with references only where appropriate, safe reason codes, and explicit suppression of idempotency keys, signatures, secrets, checkout URLs, and signed download URLs in `api-gateway/src/payments/payment-audit.service.ts` and `api-gateway/src/payments/payment-recovery.service.ts`
- [X] T060 Update controller annotations and regenerate the checked-in OpenAPI output for the shipped payment surface in `api-gateway/src/payments/payments.controller.ts`, `api-gateway/src/payments/momo-ipn.controller.ts`, and `api-gateway/swagger-spec.json`
- [X] T061 Reconcile sandbox-only setup, private-bucket checks, alert conditions, payment retention guidance, API examples, and focused test commands with shipped behavior in `specs/020-momo-payment/quickstart.md` and `specs/020-momo-payment/contracts/payments.openapi.yaml`
- [X] T062 Run focused payment unit and E2E suites, including the migration against a disposable database and deterministic receipt storage fixture, using scripts declared in `api-gateway/package.json`
- [X] T063 Run Prisma generation/deployment verification, the complete Gateway unit/E2E suites, lint, build, Swagger diff review, and a secret/private-URL response-log audit using scripts declared in `api-gateway/package.json`

---

## Dependencies and Execution Order

### Phase Dependencies

```text
T001
  └── Foundation (T002–T019)
        └── US1: initiate once (T020–T028)
              └── US2: verified IPN and local outcome (T029–T037)
                    └── US3: immutable receipt (T038–T048)
                          └── US4: history and reconciliation (T049–T055)
                                └── Polish and validation (T056–T063)
```

- T001 locks the customer/IPN boundary before implementation and tests encode it.
- T002–T019 establish database authority, protected configuration, provider signing, and the durable-work primitives required by all stories.
- US1 must produce the single persisted payment and stable MoMo identities before US2 can accept a result.
- US2 establishes authoritative payment state and the once-only outcome before US3 issues a receipt.
- US4 uses the durable data and recovery semantics established by US1–US3 to expose safe support history and reconciliation.
- Finish T056–T063 only after all user-story checkpoints pass.

### Parallel Opportunities

- **Foundation**: T002–T006 are independent RED tests; T008 and T009 can proceed in parallel once T007's configuration shape is decided.
- **US1**: T020–T023 can be authored in parallel. T024 can proceed after the tests are in place; T025–T028 follow the creation-path dependency chain.
- **US2**: T029–T032 can be authored in parallel. T033 can proceed after the test boundary exists; T034–T037 are ordered by verified intake, public handling, and durable effect wiring.
- **US3**: T038–T041 can be authored in parallel. T042–T045 build issuance and rendering in order, while T046–T048 attach the completed receipt boundary.
- **US4**: T049–T052 can be authored in parallel. T053–T055 follow service, recovery, and controller wiring order.
- **Polish**: T056–T058 can proceed in parallel; T059–T061 follow the final runtime surface, then T062 and T063 are sequential verification gates.

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete T001–T019 to establish validated configuration, migration-safe persistence, trusted quoting, HMAC/provider primitives, and durable work coordination.
2. Complete T020–T028 and run the focused creation tests.
3. Demonstrate that an authorized owner/admin can start exactly one server-priced checkout and safely replay the same request after a timeout.

### Incremental Delivery

1. Add US2 to make the persisted checkout financially authoritative only after a verified MoMo IPN and to record one durable local outcome.
2. Add US3 to issue and privately deliver one immutable receipt for the confirmed success path.
3. Add US4 to make safe history and reconciliation available without reopening a charge.
4. Complete deployment wiring, observability, sandbox verification, and full Gateway regression only after all slices are stable.

### Real Validation Commands

```powershell
cd api-gateway
npm test -- payments
npm run test:e2e -- payments.e2e-spec.ts
npx prisma generate
npm run db:migrate:deploy
npm run swagger:generate
npm test
npm run test:e2e
npm run lint
npm run build
```
