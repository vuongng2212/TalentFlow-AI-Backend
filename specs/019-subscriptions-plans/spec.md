# Feature Specification: Subscriptions and Plan Entitlements

**Feature Branch**: `Bero/feat/billing-and-subscription`
**Created**: 2026-09-15
**Status**: Ready for Planning
**Input**: User description: "Create a Subscriptions module with Free, Plus, and Business plans; persist Plans and Subscriptions; default to Free; Business subscriptions enable `isBusiness`."

## Problem Statement

The API Gateway currently treats `workspace.isBusiness` as a client-controlled entitlement flag. It has no durable plan catalogue or subscription record, so the system cannot identify a workspace's current plan or derive Business capabilities from it. Recruiters and workspace administrators need a consistent set of plans and a workspace subscription that determines access to Business-only collaboration features.

## Scope And Ownership

- **Primary service(s)**: API Gateway
- **Runtime boundary**: Authenticated HTTP subscription and plan-management surface, plus workspace provisioning
- **Data boundary**: API Gateway persistence for plans, subscriptions, and the existing workspace entitlement flag
- **Active docs**: Use `.specify/` and `specs/` as the current planning surface; frozen sources are reference only.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Receive the default Free subscription (Priority: P1)

As a recruiter or administrator who creates a workspace, I receive a Free subscription automatically so that the workspace has a known plan from its first use.

**Why this priority**: A reliable default is the foundation for every plan display and entitlement decision.
**Independent Test**: Create a workspace and verify that its current subscription is Free and that Business collaboration is disabled. Repeat through the signup-created personal workspace flow.
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** no subscription exists for a new workspace, **When** the workspace is created, **Then** it receives one current Free subscription and `isBusiness` is `false`.
2. **Given** a new user receives a personal workspace during signup, **When** provisioning completes, **Then** that workspace has a current Free subscription and `isBusiness` is `false`.
3. **Given** a pre-existing workspace, **When** the feature is introduced, **Then** it receives a current subscription that preserves its present Business entitlement: Business for `isBusiness=true`, otherwise Free.

---

### User Story 2 - View the plan catalogue and current subscription (Priority: P2)

As an authenticated workspace member, I can view the Free, Plus, and Business plans and the workspace's current plan so that I understand the available choices and current entitlement.

**Why this priority**: Users need a stable, complete catalogue before they can make or understand a plan selection.
**Independent Test**: Request the plan catalogue and a workspace's subscription as an authorized member, and verify that the three plans are returned in the documented order with the current plan identified.
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** they view available plans, **Then** they receive exactly Free, Plus, and Business in that order.
2. **Given** an active member of a workspace, **When** they view that workspace's subscription, **Then** they receive its current plan and whether it enables Business capabilities.
3. **Given** a user who is not an active member of the workspace, **When** they request its subscription, **Then** access is denied without exposing subscription details.

---

### User Story 3 - Change the workspace plan (Priority: P3)

As a workspace owner or administrator, I can select another active plan for the workspace so that its Business entitlement always follows the selected plan.

**Why this priority**: This makes the catalogue actionable while retaining the existing workspace ownership rules.
**Independent Test**: As a workspace owner or administrator, switch a workspace from Free or Plus to Business and back; verify the current plan and entitlement after each change.
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a workspace on Free or Plus, **When** an owner or administrator selects Business, **Then** Business becomes the current plan and `isBusiness` becomes `true`.
2. **Given** a workspace on Business, **When** an owner or administrator selects Free or Plus, **Then** the selected plan becomes current and `isBusiness` becomes `false`.
3. **Given** a request from a non-owner/non-administrator or for an unavailable plan, **When** it attempts to change a workspace plan, **Then** the request is rejected and the current subscription remains unchanged.

## Edge Cases

- A request may not create a custom plan or supply an entitlement flag; entitlement is derived only from the selected plan.
- A missing, unavailable, or unknown plan cannot be selected.
- Re-selecting the current plan is idempotent and must not leave duplicate current subscriptions.
- The migration must give every existing workspace a subscription and preserve its current `isBusiness` behavior.
- Downgrading a workspace does not remove existing members automatically; it prevents future operations already restricted to Business workspaces.
- The feature has no payment provider, checkout, invoice, or webhook scope. A plan change takes effect as an internal entitlement change only.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST maintain one canonical, active catalogue containing exactly the Free, Plus, and Business plans in a stable display order.
- **FR-002**: Each plan MUST have a stable unique identity, display name, display order, availability state, and an explicit indicator of whether it enables Business capabilities.
- **FR-003**: The system MUST persist a workspace's current subscription and associate it with exactly one plan.
- **FR-004**: The system MUST create the Free subscription as part of creating every new workspace, including the default personal workspace created during signup.
- **FR-005**: The system MUST let active workspace members view the plan catalogue and their workspace's current subscription.
- **FR-006**: The system MUST allow only workspace owners or administrators to change the workspace's current plan to an available plan.
- **FR-007**: The system MUST update the subscription selection and `workspace.isBusiness` as one all-or-nothing operation; `isBusiness` is `true` if and only if the current plan is Business, and is `false` for Free and Plus.
- **FR-008**: The system MUST not grant or revoke Business entitlement from a client-supplied `isBusiness` value; this value is derived from the selected plan.
- **FR-009**: The system MUST migrate existing workspaces to a current subscription without changing their current Business entitlement.
- **FR-010**: The system MUST preserve the current subscription when a plan-change request is unauthorized, invalid, or otherwise unsuccessful.
- **FR-011**: The system MUST record plan changes in operational logs without including sensitive user data.
- **FR-012**: Tests for subscription provisioning, plan visibility, authorization, plan changes, and entitlement synchronization MUST be written before implementing the corresponding behavior.

### Cross-Service Contracts

- **Producer**: API Gateway HTTP surface and workspace provisioning flow
- **Consumer**: Authenticated API clients and existing API Gateway workspace entitlement checks
- **Payload shape**: Plan identity and presentation fields; current workspace subscription and its selected plan; a plan-selection request containing only the requested plan identity
- **Compatibility rule**: Migration required for existing workspaces. No queue, CV Parser, or Notification contract changes are in scope.
- **Validation rule**: The selected plan must be active; the requester must be an owner or administrator for a plan change and an active member for subscription viewing.

### Service Boundary Notes

- **API Gateway**: Owns the plan catalogue, workspace subscriptions, plan selection, authorization, persistence migration, and synchronization of the existing workspace Business entitlement.
- **CV Parser**: Unchanged.
- **Notification**: Unchanged.

### Data / Schema Changes

- **Entity**: Plan — a canonical subscription offering available to workspaces.
- **Attributes**: Stable plan identity, name, display order, availability, and Business-entitlement indicator.
- **Entity**: Subscription — the current plan selection for a workspace, including its lifecycle state and audit timestamps.
- **Attributes**: Workspace reference, selected plan reference, current state, start timestamp, and update timestamp.
- **Ownership**: API Gateway.
- **Migration impact**: A data migration and deterministic plan seed are required. Existing Business workspaces map to Business; all other workspaces map to Free.

### Operational Requirements

- **Security**: Reuse existing authentication and workspace-member authorization. Never accept a client-controlled Business entitlement during workspace or subscription changes.
- **Observability**: Record successful plan changes and rejected invalid/unauthorized changes with workspace and plan identifiers suitable for support investigation.
- **Failure behavior**: If subscription persistence or entitlement synchronization fails, neither change may take effect; callers receive a clear error and the previous subscription remains current.
- **Config**: No payment-provider configuration is introduced in this feature.

### Validation Expectations

- **Gateway**: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`

The implementation must first create focused tests for plan catalogue seeding, Free default provisioning, migration preservation, workspace authorization, plan changes, and `isBusiness` synchronization. These tests are the TDD gate for the feature.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of newly created workspaces, including signup-created personal workspaces, have a current Free subscription when provisioning finishes.
- **SC-002**: Every authenticated catalogue view contains exactly the three plans Free, Plus, and Business in the same order.
- **SC-003**: 100% of successful plan changes leave the workspace Business entitlement consistent with its selected plan immediately after the change.
- **SC-004**: 100% of unauthorized or invalid plan-change attempts preserve the workspace's existing subscription and entitlement.

## Assumptions

- The subscription is owned by a workspace, because the existing Business entitlement is workspace-scoped.
- Only the Business plan enables `isBusiness`; Free and Plus leave it disabled.
- This feature provides internal plan selection and entitlement management only. Payment collection, prices, tax, invoices, refunds, and payment-provider integration are out of scope.
- The initial catalogue is fixed to Free, Plus, and Business; no plan-administration interface is required.
- Existing active members remain after a downgrade, while future member-management actions continue to follow the resulting Business entitlement.
- The API Gateway is the only service changed by this feature.
