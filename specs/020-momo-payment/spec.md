# Feature Specification: MoMo Payment Module

**Feature Branch**: `Bero/feat/momo-payment`  
**Created**: 2026-09-18  
**Status**: Ready for Planning  
**Input**: User description: "Tạo một module mang tên payment, module này mang chức năng tạo thanh toán, xử lý thanh toán, xuất hóa đơn, ghi vào database. Sử dụng MoMo làm phương thức thanh toán, yêu cầu kĩ càng về idempotency; khi nhận được API thanh toán thành công hoặc không thì xử lý internal trong backend."

## Problem Statement

API Gateway currently has plan and subscription management but no durable payment record, no controlled MoMo payment flow, and no reliable way to turn a provider result into a single internal outcome and invoice. Workspace owners need to initiate a payment for an approved payable item, receive a trustworthy result, and retrieve a record of the completed transaction. Finance and support staff need an auditable history that remains correct when users retry requests or MoMo sends the same result more than once.

This feature introduces a `payment` module in the API Gateway. It owns payment initiation, verified MoMo result handling, internal outcome processing, invoice issuance, and payment persistence. It does not change the CV Parser or Notification services.

## Scope And Ownership

- **Primary service(s)**: API Gateway
- **Runtime boundary**: Authenticated payment initiation and invoice retrieval, plus a signed provider-result intake and internal background processing
- **Data boundary**: API Gateway persistence for payment requests, provider result records, idempotency records, invoices, and an audit trail
- **Active docs**: Use `.specify/` and `specs/` as the current planning surface; frozen sources are reference only.

### In Scope

- Creating a payment for one server-approved payable item using MoMo.
- Persisting the payment before requesting or displaying a MoMo checkout experience.
- Receiving and verifying both successful and unsuccessful MoMo results, then processing each result internally without trusting a browser redirect.
- Strong idempotency for client initiation, provider results, internal fulfillment, and invoice issuance.
- Issuing, storing, viewing, and downloading a payment invoice/receipt for a confirmed successful payment.
- Recording identifiers, state changes, and safe audit information needed for support and reconciliation.

### Out Of Scope

- Supporting payment providers other than MoMo.
- Accepting client-defined price, currency, discount, tax, or entitlement values.
- Refunds, chargebacks, partial payments, recurring automatic collection, and subscription cancellation.
- Changing a workspace's plan or granting an entitlement directly from a client request. A later business-owner integration may consume the module's once-only confirmed-payment outcome.
- Issuing a government-recognized electronic tax invoice unless the required issuer, customer tax, and regulatory data are supplied by an approved billing integration.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Start a MoMo payment once (Priority: P1)

As an authorized workspace owner or administrator, I can start a MoMo payment for a server-approved payable item so that I can complete the purchase without entering an amount that differs from the approved charge.

**Why this priority**: A durable, correctly priced payment request is the prerequisite for every later result, fulfillment, and invoice.  
**Independent Test**: Create a payment for an eligible payable item as an authorized workspace administrator and verify that it has one stored pending payment record and a MoMo checkout instruction. Repeat the same request with the same idempotency key.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** an active owner or administrator and an eligible payable item with a server-calculated amount, **When** they submit a new payment request with a unique idempotency key, **Then** the system creates one pending MoMo payment, snapshots the approved charge, persists it, and returns the checkout information for that payment.
2. **Given** the same requester retries the same logical request with the same idempotency key, **When** the original request has already been accepted, **Then** the system returns the original payment outcome without creating a second payment or requesting a second MoMo checkout.
3. **Given** an idempotency key previously used for different payment details, **When** it is reused, **Then** the system rejects the request and leaves the original payment unchanged.
4. **Given** a requester who is not an active owner or administrator, or a payable item that is not eligible, **When** they request payment, **Then** the system rejects it without creating a payment record or exposing another workspace's payment information.

### User Story 2 - Process a verified MoMo result internally (Priority: P1)

As a workspace owner or operator, I need a payment to become successful or unsuccessful only after the backend verifies and processes MoMo's result, so that a repeated callback, browser return, or delayed message cannot grant a purchase twice or overwrite a final result.

**Why this priority**: The provider result is the financial source of truth; safe handling prevents duplicate charges, duplicate fulfillment, and incorrect account state.  
**Independent Test**: Deliver a valid MoMo success result, duplicate it, and then deliver a late failure result. Verify that exactly one internal success process and one invoice result exist. Repeat with a valid failure result and verify that no success-only effects occur.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a pending stored MoMo payment, **When** the backend receives a valid, signed success result whose payment identity, amount, currency, and merchant details match the stored payment, **Then** it records the verified result, marks the payment successful, and runs the internal success process exactly once.
2. **Given** a pending stored MoMo payment, **When** the backend receives a valid, signed unsuccessful result, **Then** it records the result, marks the payment unsuccessful, runs the internal failure process exactly once, and does not grant any success-only effect.
3. **Given** MoMo repeats a previously handled result, **When** the duplicate is received, **Then** the system acknowledges it safely without creating another payment, fulfillment, invoice, or audit outcome.
4. **Given** a late or conflicting result arrives after a payment is in a final state, **When** it does not represent a permitted correction from the provider, **Then** the final payment state remains unchanged and the event is retained for investigation.
5. **Given** an unsigned, invalidly signed, unknown, or mismatched provider result, **When** it is received, **Then** the system does not accept it as a payment outcome, does not run fulfillment, and records a safe rejection signal.

### User Story 3 - Obtain a successful-payment invoice (Priority: P2)

As an authorized workspace member, I can view and download an invoice/receipt for a confirmed successful payment so that I have a durable record of what was paid, by whom, and when.

**Why this priority**: A clear payment record reduces support effort and makes completed purchases traceable for customers and finance operations.  
**Independent Test**: Complete a payment successfully and retrieve its invoice as an active workspace member. Retry invoice generation and provider-result delivery, then confirm that the same invoice is returned and no duplicate invoice number exists.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a payment has completed successfully and its internal success process has finished, **When** invoice issuance is requested or triggered, **Then** the system creates exactly one invoice/receipt linked to that payment and preserves the charged amounts and item details as they were at payment time.
2. **Given** invoice issuance is retried after a timeout or duplicate payment result, **When** an invoice already exists for the payment, **Then** the system returns the existing invoice and does not assign another invoice number.
3. **Given** a payment is pending, unsuccessful, rejected, or otherwise not confirmed as successful, **When** someone requests an invoice, **Then** the system does not issue a successful-payment invoice.
4. **Given** an active member of the owning workspace, **When** they view or download a payment invoice, **Then** they can access it; a user outside the workspace cannot access its payment or invoice details.

### User Story 4 - Reconcile and support payment history (Priority: P3)

As an authorized finance or support operator, I can find the durable history of a payment and its provider result so that I can resolve a dispute without relying on transient logs or client screenshots.

**Why this priority**: Payment operations need explainable, traceable records even when an external request has timed out or arrives out of order.  
**Independent Test**: Locate a payment by its internal reference and provider reference, then verify its immutable charge snapshot, current state, invoice relationship, and non-sensitive state-transition history.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a stored payment, **When** an authorized operator retrieves its history, **Then** they can see its internal reference, provider reference, approved charge snapshot, current state, verified result summary, invoice relationship, and timestamps without secret credentials or raw signature data.
2. **Given** a payment initiation or result-processing attempt is temporarily uncertain, **When** it is retried or reconciled, **Then** the system continues the original payment safely rather than opening a duplicate charge.

## Edge Cases

- A client retry that reuses its idempotency key with a different workspace, payable item, amount, currency, or request meaning is rejected as a conflict; the original record is never modified.
- Concurrent first attempts for the same idempotency key resolve to one stored payment and one checkout instruction.
- A timeout while contacting MoMo is treated as uncertain until the stored payment is reconciled; the caller cannot create another payment for the same logical purchase merely because the first response was not received.
- The amount, currency, payable-item identity, merchant identity, and provider payment reference in a provider result must match the immutable payment snapshot before a success or failure state is accepted.
- A success result received more than once must not issue multiple invoices or execute fulfillment multiple times. A later failure must not regress an accepted final success.
- A failure result received more than once must not create repeated customer-facing notifications, support tasks, or other internal side effects.
- If the payment succeeds but invoice issuance is temporarily unavailable, the payment remains successful, the missing invoice is retried idempotently, and no replacement payment is created.
- An expired, cancelled, or provider-rejected payment cannot be completed locally; a new logical payment requires a new idempotency key and a newly approved charge.
- Price, tax, or product details changed after payment initiation do not change the payment or invoice: both retain the snapshot approved at initiation.
- Provider-result processing must tolerate delivery retries, delayed delivery, and a callback arriving before the user returns to the application.
- No raw provider signatures, shared secrets, full payment payloads containing unnecessary personal data, or sensitive card/account information are exposed in responses or routine logs.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide one API Gateway `payment` capability that creates, reads, and processes MoMo payments for server-approved payable items.
- **FR-002**: The system MUST create and persist a unique payment reference and an immutable snapshot of the payable item, amount, currency, payer workspace, and charge terms before it requests a MoMo checkout experience.
- **FR-003**: The system MUST use MoMo as the only payment method in this feature and MUST associate every provider payment reference with exactly one internal payment.
- **FR-004**: The system MUST require an idempotency key for every client payment-initiation request and scope it to the authenticated requester, owning workspace, and payment operation.
- **FR-005**: For a repeated initiation with the same key and identical normalized details, the system MUST return the original accepted payment result; for the same key with materially different details, it MUST reject the request without altering the original record.
- **FR-006**: The system MUST prevent concurrent retries, retry-after-timeout flows, and provider delays from creating more than one payment or more than one active checkout for one idempotent payment operation.
- **FR-007**: The system MUST accept a provider result only after verifying its authenticity and matching its payment reference, merchant identity, amount, currency, and other required transaction identifiers to the stored payment.
- **FR-008**: The system MUST treat provider-to-server result delivery as authoritative and MUST NOT treat a browser redirect or client-declared status as evidence that a payment succeeded or failed.
- **FR-009**: The system MUST store every accepted provider result and transition a payment through documented pending, successful, unsuccessful, expired/cancelled, and rejected states without allowing an invalid transition or a regression from a final state.
- **FR-010**: The system MUST process each accepted payment result internally exactly once for its business effect. A successful result MUST execute the success process and an unsuccessful result MUST execute the failure process; duplicate delivery MUST not repeat either process.
- **FR-011**: The system MUST persist sufficient outcome, correlation, retry, and timestamp information to resume safe internal processing after a temporary failure.
- **FR-012**: The system MUST create exactly one invoice/receipt for each confirmed successful payment, assign it a unique immutable invoice reference, and link it to the payment's immutable charge snapshot.
- **FR-013**: The system MUST allow authorized active workspace members to retrieve their workspace's payments and invoices, while restricting payment initiation to the workspace owner or administrator and preventing cross-workspace access.
- **FR-014**: The system MUST not create a successful-payment invoice for any payment that is not in a confirmed successful state.
- **FR-015**: The system MUST retain a non-sensitive, immutable audit history for payment creation, provider-result verification, state transitions, internal-processing attempts, and invoice issuance or failure.
- **FR-016**: The system MUST ensure that a rejected, invalid, unauthorized, mismatched, or failed payment result does not change a workspace entitlement or any other success-only business state.
- **FR-017**: The system MUST support authorized reconciliation of a payment in an uncertain state using its internal and provider references, without allowing reconciliation to create a duplicate payment.
- **FR-018**: The system MUST author tests before implementation for initiation idempotency, concurrent duplicate requests, provider-result verification, duplicate/out-of-order results, once-only internal processing, invoice uniqueness, authorization, and recovery from an incomplete invoice issuance.

### Cross-Service Contracts

- **Producer**: Authenticated API clients initiate a payment; MoMo delivers a signed payment result; the API Gateway creates a once-only internal outcome available to the owning business flow.
- **Consumer**: The API Gateway payment module consumes the MoMo result. A future subscription or other business module may consume the confirmed-payment outcome through an explicitly designed contract; no entitlement change is implicit in this feature.
- **Payload shape**: A payment-initiation request identifies only an eligible payable item and an idempotency key. A MoMo result identifies the provider transaction, outcome, amount/currency, merchant correlation, and proof of authenticity. Invoice views contain the immutable payment and charge summary appropriate to the requester.
- **Compatibility rule**: A new payment and invoice data model is required. Existing subscription and workspace behavior remains unchanged until a separate fulfillment contract is approved.
- **Validation rule**: Initiators must be authorized for the workspace; payable items and charge amounts are derived by the backend; every provider result must pass authenticity and stored-payment matching checks before it can affect state.

### Service Boundary Notes

- **API Gateway**: Owns payment authorization, payable-item validation, persistence, MoMo interaction, verified result intake, once-only internal processing, invoice issuance, reconciliation, and audit visibility.
- **CV Parser**: Unchanged.
- **Notification**: Unchanged. If a later notification is added for payment status, it must consume a deduplicated internal outcome rather than a raw MoMo result.

### Data / Schema Changes

- **Entity**: Payment — one durable attempt to collect a server-approved charge through MoMo.
- **Attributes**: Internal payment reference; workspace, requester, and payable-item references; immutable amount, currency, item and tax snapshot; payment state; MoMo payment and merchant references; initiation idempotency key and normalized request fingerprint; expiration; and lifecycle timestamps.
- **Entity**: Payment Result — a recorded, verified or rejected provider outcome associated with one payment.
- **Attributes**: Provider event and transaction references, received time, claimed outcome, verification decision, matching decision, safe reason code, processing state, and correlation information. It excludes secret verification material from ordinary access and logs.
- **Entity**: Payment Processing Record — the durable once-only record of the internal success or failure process.
- **Attributes**: Payment reference, outcome type, processing state, attempt count, safe failure reason, completion time, and an idempotency identity derived from the payment and outcome.
- **Entity**: Invoice — the immutable invoice/receipt for a confirmed successful payment.
- **Attributes**: Unique invoice reference, payment reference, issue time, payer and issuer display details supplied by approved business data, immutable charge/tax/line-item snapshot, total amount/currency, document state, and download location or rendered representation.
- **Entity**: Payment Audit Event — a non-sensitive chronological record of security-relevant and business-relevant actions.
- **Attributes**: Event identity, payment/invoice references, action type, prior and new state where applicable, actor category, correlation identity, timestamp, and safe reason code.
- **Ownership**: API Gateway.
- **Migration impact**: New persistence migration and test/seed fixtures are required. No backfill is required for pre-existing subscriptions because this feature does not infer historical payments.

### Operational Requirements

- **Security**: Reuse existing authentication and workspace authorization for customer-facing actions. Verify MoMo authenticity using protected runtime credentials. Never expose provider secrets, raw signatures, or unnecessary personal data. Treat all client-returned payment status as untrusted.
- **Observability**: Emit searchable, non-sensitive audit and operational signals for payment reference, provider reference, idempotency decision, verification decision, state transition, processing attempt, invoice reference, and reconciliation outcome. Alerts must be possible for verification failures, processing failures, and payments left uncertain beyond the configured recovery window.
- **Failure behavior**: Preserve the stored payment and its immutable charge snapshot on every failed or uncertain request. Retry internal processing and invoice issuance safely using their durable once-only identities. Do not mark a payment as failed solely because invoice generation failed after a verified success.
- **Config**: Require protected MoMo merchant credentials, verification material, return/result URLs, merchant identity, allowed currency/currencies, payment-expiry policy, recovery-window policy, and issuer data needed for the selected invoice/receipt type. Missing or invalid mandatory configuration prevents initiation or result acceptance safely.

### Validation Expectations

- **Gateway**: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`

The implementation must first create focused tests for: authorized payment creation; server-derived charge validation; idempotent retries including concurrent requests and key conflicts; timeout/reconciliation behavior; signed-result acceptance and rejection; duplicate, delayed, and contradictory provider results; once-only success/failure processing; invoice creation/retry uniqueness; cross-workspace authorization; and safe recovery when invoice issuance temporarily fails. These tests are the TDD gate for the feature.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of accepted payment-creation retries using the same idempotency key and the same request details return the original payment outcome and create no additional payment or MoMo checkout.
- **SC-002**: 100% of verified duplicate provider results leave exactly one final payment outcome, one execution of the corresponding internal process, and, for a success, one invoice/receipt.
- **SC-003**: 100% of provider results with an invalid proof, unknown payment reference, or mismatch against the stored charge are rejected without changing a payment to successful or granting a success-only business effect.
- **SC-004**: At least 99.9% of verified provider results complete their durable internal outcome processing within 60 seconds; any remaining result is visible for safe retry and reconciliation.
- **SC-005**: 100% of confirmed successful payments have one retrievable invoice/receipt within 60 seconds of successful internal processing, or have a visible, retryable issuance exception without changing the successful payment state.
- **SC-006**: In authorization tests, 100% of payment and invoice access attempts from a non-member or another workspace are denied without revealing payment details.

## Assumptions

- A payable item is created and priced by an authorized backend business flow; the payment module receives only a server-approved charge and never accepts client-supplied money values. The existing subscription feature is a likely future producer but is not changed by this feature.
- Vietnamese đồng (VND) is the initial permitted currency, matching the initial MoMo use case. Any additional currency requires an explicit pricing and provider-acceptance decision.
- The first release issues a commercial payment invoice/receipt. It does not claim to be a legally valid Vietnamese electronic tax invoice unless an approved billing integration supplies the required legal issuer and customer information.
- MoMo provides a verifiable provider-to-server payment result and stable transaction/correlation identifiers sufficient to detect duplicate and conflicting delivery.
- A workspace owner or administrator is authorized to initiate payments for that workspace; active members may view the workspace's payment history and invoices.
- API Gateway is the only service changed. Notification, refund, chargeback, and recurring billing workflows are intentionally deferred.
