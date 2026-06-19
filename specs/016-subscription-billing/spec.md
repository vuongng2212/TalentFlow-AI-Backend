# Feature Specification: Subscription Billing

**Feature Branch**: `016-subscription-billing`  
**Created**: 2026-06-12  
**Status**: Draft  
**Input**: User description: "Only implement billing and subscription. Dev and Prod both use Momo Billing. Reduce subscription scope to creating plans, payment, and internal confirmation. Each user has a personal workspaceId outside this feature. When a user registers for Business, create mock data for a business workspace id in constants so it is easy to change. Only build the subscription module; do not involve the workspace module, and use the mock business workspace id for subscription only."

## Problem Statement

TalentFlow AI needs a smaller subscription delivery slice focused on billing, plan purchase, and activation. The previous subscription direction expanded into workspace ownership, invitations, roles, and workspace lifecycle. This feature narrows the work to subscription billing only: define the purchasable plans, send paid plan checkout through Momo Billing in both development and production, confirm successful payment through an internal confirmation path, and activate the subscription state.

This feature belongs primarily in the API Gateway because users initiate subscription purchases through the product boundary, operators need an internal confirmation path, and active subscription state must be available to the rest of the runtime. Workspace creation, workspace membership, role management, invitations, and real workspace lifecycle behavior are explicitly out of scope.

## Scope And Ownership

- **Primary service(s)**: API Gateway
- **Runtime boundary**: HTTP API for plan listing, checkout initiation, subscription status, and internal payment confirmation
- **Data boundary**: Subscription plan catalog, payment transaction records, user subscription state, and a mock Business workspace identifier used only by subscription
- **Active docs**: Use `.specify/` and `specs/` as the current planning surface; frozen sources are reference only.

## User Scenarios & Testing _(mandatory)_

User stories are ordered by business priority and independently testable. Each story names the service boundary it touches.

### User Story 1 - View Available Subscription Plans (Priority: P1)

A signed-in user can view the active subscription plans that are available for purchase, including which plans require payment and which plan is free.

**Why this priority**: Checkout cannot be reliable until the product has a clear plan catalog and users can choose a valid plan.  
**Independent Test**: Request the available subscription plans and verify that only supported plans for this release are returned with enough information to start checkout.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** the user requests subscription plans, **Then** the system returns the active Free, Plus, and Business plans for this release.
2. **Given** a plan is not active or not supported for this release, **When** a user views available plans, **Then** the plan is not offered for checkout.
3. **Given** a user selects a paid plan, **When** checkout begins, **Then** the selected plan must match an active paid plan from the catalog.

### User Story 2 - Pay For A Subscription Through Momo (Priority: P2)

A signed-in user can start payment for a paid subscription plan, and the system routes the payment through Momo Billing in both development and production environments.

**Why this priority**: The core business goal is paid subscription activation through the selected billing provider, with no separate fake or manual payment path for development.  
**Independent Test**: Start checkout for Plus and Business in a development-like environment and a production-like environment, then verify each payment attempt is created for Momo Billing and remains pending until confirmation.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a signed-in user selects Plus, **When** the user starts checkout, **Then** the system creates a pending Momo Billing payment for the Plus subscription.
2. **Given** a signed-in user selects Business, **When** the user starts checkout, **Then** the system creates a pending Momo Billing payment for the Business subscription.
3. **Given** a payment attempt is pending, **When** no valid confirmation has been received, **Then** no paid subscription becomes active.
4. **Given** the runtime is development or production, **When** checkout is started for a paid plan, **Then** the payment provider used is Momo Billing.

### User Story 3 - Confirm Payment Internally And Activate Subscription (Priority: P3)

An authorized internal actor or internal process can confirm a successful Momo Billing payment and activate the matching subscription for the purchasing user.

**Why this priority**: Activation must be controlled by trusted confirmation rather than client claims, so paid access only starts after the payment is verified.  
**Independent Test**: Create a pending payment, confirm it through the internal confirmation path with valid payment details, and verify that the subscription becomes active exactly once.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a pending Momo payment matches the selected plan, purchaser, amount, and provider reference, **When** internal confirmation marks the payment successful, **Then** the matching subscription becomes active.
2. **Given** a user or client sends an untrusted claim that payment succeeded, **When** no valid internal confirmation exists, **Then** the subscription remains inactive.
3. **Given** the same successful payment is confirmed more than once, **When** duplicate confirmation is processed, **Then** the subscription remains active once and no duplicate subscription period is created.
4. **Given** a payment is failed, cancelled, expired, or does not match the expected plan or amount, **When** confirmation is attempted, **Then** the system does not activate the paid subscription.

### User Story 4 - Attach Mock Business Workspace Id For Business Activation (Priority: P4)

When a Business subscription becomes active, the subscription record is associated with a predefined mock Business workspace identifier so later integration can replace it without changing the subscription flow.

**Why this priority**: Business billing needs a workspace-like identifier for subscription records, but this release must not implement or modify workspace behavior.  
**Independent Test**: Activate a Business subscription and verify that the subscription contains the configured mock Business workspace identifier while no real workspace lifecycle action occurs.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a Business payment is confirmed successfully, **When** the Business subscription becomes active, **Then** the subscription is associated with the predefined mock Business workspace identifier.
2. **Given** a Plus payment is confirmed successfully, **When** the Plus subscription becomes active, **Then** no Business workspace identifier is attached.
3. **Given** Business activation completes, **When** the result is inspected, **Then** no workspace is created, invited users are not changed, roles are not assigned, and workspace membership is not modified.
4. **Given** the mock Business workspace identifier changes before deployment, **When** a new Business subscription is activated, **Then** the new active subscription uses the updated identifier.

## Edge Cases

- A user attempts to start checkout for an unsupported or inactive plan: the request is rejected before any payment attempt is created.
- A user attempts to activate a paid subscription without a trusted confirmation result: the subscription remains inactive.
- Momo Billing returns a pending, cancelled, expired, failed, or unknown payment outcome: the payment record reflects the outcome and no paid subscription is activated unless success is confirmed.
- Momo Billing confirmation references the wrong user, plan, amount, currency, or transaction: the confirmation is rejected and marked for operator review.
- The same Momo transaction is confirmed multiple times due to retry or delayed delivery: activation is idempotent and does not create duplicate active periods.
- A user starts multiple payment attempts for the same plan: only a successfully confirmed payment activates a subscription; stale pending attempts remain non-active.
- A Business subscription is activated while the real workspace module is unavailable or incomplete: activation still succeeds using the predefined mock Business workspace identifier.
- A request tries to invite members, assign roles, create a workspace, or manage workspace permissions from this feature: the request is out of scope and must not be handled by subscription billing.
- Momo Billing configuration is missing for development or production: paid checkout cannot start and the failure is visible to operators.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST maintain an active subscription plan catalog for this release containing Free, Plus, and Business.
- **FR-002**: The system MUST distinguish free plans from paid plans before checkout starts.
- **FR-003**: The system MUST allow a signed-in user to initiate checkout only for an active paid plan.
- **FR-004**: The system MUST use Momo Billing for paid subscription checkout in both development and production environments.
- **FR-005**: The system MUST create a pending payment record for each paid checkout attempt before redirecting or handing control to Momo Billing.
- **FR-006**: The pending payment record MUST include the purchaser, selected plan, expected amount, expected currency, provider name, provider reference when available, status, and timestamps needed for reconciliation.
- **FR-007**: The system MUST keep paid subscriptions inactive until a trusted internal confirmation verifies payment success.
- **FR-008**: The system MUST validate confirmation details against the pending payment before activating a subscription, including purchaser, plan, amount, currency, provider reference, and payment status.
- **FR-009**: The system MUST reject confirmation attempts that do not match the pending payment or do not represent a successful payment.
- **FR-010**: The system MUST make payment confirmation idempotent so duplicate successful confirmations do not create duplicate active subscription periods.
- **FR-011**: The system MUST activate the matching subscription after successful confirmation and record the active period, plan, user, payment reference, and activation timestamp.
- **FR-012**: The system MUST associate an active Business subscription with a predefined mock Business workspace identifier used only by subscription billing.
- **FR-013**: The system MUST NOT create workspaces, invite workspace members, assign workspace roles, alter workspace membership, or manage workspace permissions as part of this feature.
- **FR-014**: The system MUST treat each user's existing personal workspace identifier as external context and MUST NOT create or mutate it in subscription billing.
- **FR-015**: The system MUST expose the user's current subscription status, including whether a paid payment is pending, active, failed, cancelled, or expired.
- **FR-016**: The system MUST record enough audit information for operators to reconcile payment attempts, confirmation outcomes, activation decisions, and rejected confirmations.
- **FR-017**: The system MUST fail closed when payment state cannot be verified, so no paid subscription is activated from incomplete or inconsistent billing data.

### Cross-Service Contracts

- **Producer**: API Gateway checkout initiation and internal payment confirmation
- **Consumer**: Momo Billing as the external payment provider; subscription status consumers inside the API Gateway runtime
- **Payload shape**: purchaser identifier, selected plan, expected amount, expected currency, provider name, provider transaction reference, payment status, confirmation timestamp, and mock Business workspace identifier when the activated plan is Business
- **Compatibility rule**: No CV upload, queue, storage, workspace membership, invitation, role, or real workspace lifecycle contract changes are included in this feature.
- **Validation rule**: A subscription may become active only after the confirmed provider result matches the pending payment and the requested plan.

### Service Boundary Notes

- **API Gateway**: Owns plan catalog, paid checkout initiation, payment transaction state, internal confirmation, subscription activation, subscription status, and the mock Business workspace identifier used by subscription billing.
- **CV Parser**: Out of scope; this feature must not change CV parsing, OCR, extraction, or queue handling.
- **Notification**: Out of scope unless a later feature adds payment or subscription lifecycle notifications.

### Data / Schema Changes

- **Entity**: Subscription plan catalog
- **Attributes**: plan code, display name, paid/free flag, billing period, active status, price, currency, and checkout eligibility
- **Ownership**: API Gateway
- **Migration impact**: Migration or seed update needed if the plan catalog is persisted

- **Entity**: Payment transaction
- **Attributes**: purchaser, plan, expected amount, expected currency, provider name, provider reference, status, confirmation details, rejection reason, and timestamps
- **Ownership**: API Gateway
- **Migration impact**: Migration needed for payment tracking and reconciliation

- **Entity**: User subscription
- **Attributes**: user, plan, status, period start, period end, activation timestamp, payment reference, and Business mock workspace identifier when applicable
- **Ownership**: API Gateway
- **Migration impact**: Migration needed for active subscription state

- **Entity**: Mock Business workspace identifier
- **Attributes**: stable identifier value and change history or deployment note
- **Ownership**: API Gateway subscription billing scope
- **Migration impact**: No real workspace migration; seed or runtime configuration update only

### Operational Requirements

- **Security**: Only authenticated users can start their own checkout; only authorized internal actors or trusted internal processes can confirm payments; untrusted client claims must never activate paid subscriptions.
- **Observability**: Payment initiation, provider handoff, confirmation attempts, rejected confirmations, successful activations, and Business mock workspace identifier assignment must be auditable.
- **Failure behavior**: Payment verification failures, provider mismatches, missing configuration, and inconsistent confirmation data must leave the subscription inactive with a clear operator-visible reason.
- **Config**: Momo Billing credentials and environment settings are required for development and production; the Business mock workspace identifier must be a single predefined value that is easy to change.

### Validation Expectations

- **Gateway**: Validate plan listing, paid checkout initiation, Momo provider selection in development and production, pending payment creation, successful confirmation, failed confirmation, idempotent duplicate confirmation, subscription status display, and Business mock workspace identifier assignment.
- **Parser**: No validation expected unless a later implementation explicitly changes AI or CV parsing contracts.
- **Notification**: No validation expected unless a later implementation adds subscription lifecycle notifications.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of paid subscription activations occur only after a matching successful internal confirmation exists.
- **SC-002**: 100% of paid checkout attempts in both development and production are routed to Momo Billing.
- **SC-003**: Duplicate successful confirmations for the same payment result in exactly one active subscription period.
- **SC-004**: 100% of confirmed Business subscriptions include the predefined mock Business workspace identifier.
- **SC-005**: 0 workspace creation, invitation, role assignment, or membership mutation actions occur during subscription billing tests.
- **SC-006**: 100% of failed, cancelled, expired, mismatched, or unverified payment attempts leave the paid subscription inactive.
- **SC-007**: Operators can reconcile every payment activation or rejection from stored payment and confirmation records.

## Assumptions

- Free, Plus, and Business remain the product plan names for this release.
- Free does not require Momo Billing checkout.
- Plus and Business are paid plans with one active subscription period per successful payment.
- Momo Billing is available for both development and production, using environment-specific credentials or settings while keeping the provider consistent.
- Internal confirmation means a trusted operator-only or system-only confirmation path that verifies Momo payment results before activation.
- The Business mock workspace identifier is a temporary subscription-only value and does not represent a real workspace lifecycle operation.
- Personal workspace identifiers already exist outside this feature and are not created or changed by subscription billing.
- Taxes, invoices, refunds, chargebacks, automatic renewal, dunning, workspace creation, workspace invitations, workspace roles, workspace quotas, and member management are out of scope for this specification.
- Existing CV upload queue contracts continue to use bucket and file key where applicable; this subscription feature must not introduce direct file URL contracts.
