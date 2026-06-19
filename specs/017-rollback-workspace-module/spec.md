# Feature Specification: Rollback Workspace Module

**Feature Branch**: `017-rollback-workspace-module`  
**Created**: 2026-06-19  
**Status**: Draft  
**Input**: User description: "spec 017, reference specs 015 and 016, rollback the workspace module as though it had not been created"

## Problem Statement

TalentFlow AI needs to realign the active product scope after the subscription work was narrowed. Spec 015 introduced Business subscription behavior that depended on real workspace entitlement, member invitations, role assignment, and shared workspace usage. Spec 016 intentionally reduced that scope to subscription billing only, using a predefined mock Business workspace identifier for subscription records and explicitly excluding real workspace lifecycle behavior.

This feature defines the rollback of the active workspace module so the runtime behaves as though workspace management was never created for this release. The business value is to keep subscription billing deliverable, avoid removed workspace behavior leaking into users or tests, and remove active runtime/data contracts that conflict with the narrower billing-only subscription scope.

## Clarifications

### Session 2026-06-19

- Q: Should workspace-related APIs merely be unsupported, or removed from the active API surface? -> A: Remove workspace-related APIs from the active API surface.

## Scope And Ownership

- **Primary service(s)**: API Gateway
- **Runtime boundary**: HTTP API cleanup and active subscription runtime contract
- **Data boundary**: Workspace management routes, workspace membership state, workspace-related configuration, and subscription records that may carry a mock Business workspace identifier
- **Active docs**: Use `.specify/` and `specs/` as the current planning surface; frozen sources are reference only.

## User Scenarios & Testing _(mandatory)_

User stories are ordered by business priority and independently testable. Each story names the service boundary it touches.

### User Story 1 - Remove Active Workspace Management Surface (Priority: P1)

A product user or client cannot call workspace-related APIs to create, list, invite into, or administer workspaces because those APIs are removed from the active API Gateway release.

**Why this priority**: The rollback is only meaningful if workspace actions are deleted from the active API surface rather than left as reachable but unsupported behavior.  
**Independent Test**: Inspect and exercise every previously exposed workspace management action and verify the related API is absent from the active product contract.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** the active API contract, **When** a client searches for workspace creation, member listing, member invitation, role assignment, or workspace administration actions, **Then** no workspace-related API operation is present.
2. **Given** an authenticated user, **When** the user attempts to call a previously known workspace API path, **Then** the request is not handled by a workspace API and no workspace state changes.
3. **Given** a client generated from the active API contract, **When** the client searches available product actions, **Then** workspace management actions are absent from the supported contract.

### User Story 2 - Preserve Subscription Billing Without Workspace Lifecycle (Priority: P2)

A signed-in user can still view plans, start paid subscription checkout, and receive an activated Plus or Business subscription according to spec 016, without triggering real workspace creation or membership behavior.

**Why this priority**: The rollback must not break the billing-only subscription scope that replaced the broader workspace entitlement direction.  
**Independent Test**: Complete the subscription billing flows from spec 016 and verify Business activation uses only the predefined mock Business workspace identifier.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** the user views subscription plans, **Then** Free, Plus, and Business remain available according to the active billing scope.
2. **Given** a paid subscription payment is internally confirmed, **When** the subscription becomes active, **Then** activation follows the billing-only contract and does not create or mutate real workspace state.
3. **Given** a Business subscription becomes active, **When** the subscription record is inspected, **Then** it may contain the predefined mock Business workspace identifier and no real workspace lifecycle action has occurred.

### User Story 3 - Clean Active Data Contract And Migration Expectations (Priority: P3)

An operator or developer can verify that active schema, seed data, documentation, and generated runtime contracts no longer treat workspace management as a supported module for this release.

**Why this priority**: Rollback must be visible in the source of truth so future planning and implementation do not accidentally depend on removed workspace behavior.  
**Independent Test**: Inspect the active runtime contract, persistence contract, seed expectations, and active specs to confirm workspace management is not required for the release, while subscription billing remains intact.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** the active runtime and data contract are reviewed, **When** workspace-specific management entities or member-management requirements appear, **Then** they are identified as removed from the current release scope unless needed only as historical migration cleanup.
2. **Given** active API documentation or generated client contracts are reviewed, **When** workspace endpoints or workspace management payloads appear, **Then** the release is considered incomplete until those active references are removed.
3. **Given** subscription billing artifacts are reviewed, **When** the predefined mock Business workspace identifier appears, **Then** it is documented as subscription-only placeholder data and not as proof of a real workspace module.

## Edge Cases

- A client still calls a previously known workspace route: the route must not exist as an active workspace API, and the runtime must not create, update, or expose workspace state.
- Existing local, staging, or historical workspace records may exist from earlier work: they must not become active product behavior after rollback.
- A Business subscription is activated after rollback: the activation must still succeed under spec 016 using the mock Business workspace identifier only.
- A Plus subscriber also has historical workspace-related data: personal subscription behavior must not depend on that data.
- Spec 015 workspace entitlement language remains useful background, but spec 016 and this spec supersede the workspace lifecycle portion for the active release.
- Spec 012 described the prior API Gateway workspace behavior; this rollback removes that behavior from the active release contract rather than extending it.
- Any CV upload or parser queue work must continue to use bucket plus file key where applicable; rollback must not introduce direct file URL contracts.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST delete workspace-related APIs for workspace creation, workspace member invitation, workspace member listing, workspace role assignment, and workspace administration from the active release capability set.
- **FR-002**: The system MUST NOT create real workspaces, workspace memberships, workspace roles, workspace invitations, or workspace permission changes during subscription billing or activation.
- **FR-003**: The system MUST preserve spec 016 subscription billing behavior for plan listing, paid checkout initiation, internal payment confirmation, subscription activation, and subscription status.
- **FR-004**: The system MUST allow Business subscription records to use the predefined mock Business workspace identifier only as subscription placeholder data.
- **FR-005**: The system MUST ensure the mock Business workspace identifier is not treated as a real workspace that can be managed, invited into, assigned roles, or used for member access.
- **FR-006**: The system MUST remove workspace API references from the user-facing runtime contract and active generated API documentation for this release.
- **FR-007**: The system MUST remove workspace management from active seed expectations, release validation, and feature completeness claims for the current release.
- **FR-008**: The system MUST keep historical or migrated workspace planning material from becoming active requirements unless a future feature explicitly reintroduces workspace management.
- **FR-009**: The system MUST fail closed for any call to a previously known workspace API path, so no partial workspace data mutation occurs.
- **FR-010**: The system MUST keep subscription state understandable to users and operators after rollback, including the distinction between Business subscription activation and real workspace lifecycle behavior.
- **FR-011**: The system MUST preserve existing CV upload queue contract rules, including bucket plus file key references where applicable.
- **FR-012**: The system MUST define rollback verification so the release can prove that workspace APIs have been removed while billing-only subscriptions remain available.

### Cross-Service Contracts

- **Producer**: API Gateway subscription billing and status flows
- **Consumer**: Browser or API client using the gateway subscription contract; internal subscription status consumers inside the API Gateway runtime
- **Payload shape**: Subscription plan, purchaser, payment state, subscription status, active period, and mock Business workspace identifier when the activated plan is Business
- **Compatibility rule**: Breaking for any client depending on workspace-related APIs; compatible with spec 016 billing-only subscription behavior.
- **Validation rule**: Subscription activation may reference only the mock Business workspace identifier for Business; no request may use that identifier to perform real workspace management.

### Service Boundary Notes

- **API Gateway**: Owns the rollback of active workspace management behavior and preservation of subscription billing behavior.
- **CV Parser**: Out of scope; rollback must not change CV parsing, OCR, extraction, or queue handling.
- **Notification**: Out of scope unless a later feature adds subscription lifecycle notifications.

### Data / Schema Changes

- **Entity**: Workspace management contract
- **Attributes**: workspace identity, membership, invitation, role, business entitlement, and member administration behavior
- **Ownership**: API Gateway
- **Migration impact**: Removal or deactivation from the active release contract; historical cleanup may be needed for environments that already created workspace data.

- **Entity**: Subscription state
- **Attributes**: user, plan, status, active period, payment reference, and mock Business workspace identifier when applicable
- **Ownership**: API Gateway
- **Migration impact**: Must remain available and aligned with spec 016.

- **Entity**: Mock Business workspace identifier
- **Attributes**: predefined identifier value used only by subscription billing
- **Ownership**: API Gateway subscription billing scope
- **Migration impact**: No real workspace migration; this value must remain a placeholder and must not create workspace records.

### Operational Requirements

- **Security**: No user, client, or internal actor may gain workspace management access through leftover routes, stale contracts, or subscription activation side effects.
- **Observability**: Rejected workspace management attempts, rollback cleanup decisions, and Business subscription activations using the mock identifier must be auditable.
- **Failure behavior**: Leftover workspace requests must fail without mutating workspace-related data; subscription billing failures continue to follow spec 016 payment verification behavior.
- **Config**: Workspace-management-specific configuration must not be required for the active release; subscription billing configuration and the mock Business workspace identifier remain required where defined by spec 016.

### Validation Expectations

- **Gateway**: Validate workspace-related APIs are absent from the active contract, calls to previously known workspace paths do not mutate state, billing flows still pass, Business activation uses only the mock identifier, and active API documentation matches the rollback scope.
- **Parser**: No validation expected unless implementation unexpectedly changes AI or CV parsing contracts.
- **Notification**: No validation expected unless implementation adds subscription lifecycle notifications.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 0 workspace-related API operations for creation, invitation, member listing, role assignment, or workspace administration are exposed in the current release contract.
- **SC-002**: 100% of subscription billing scenarios from spec 016 remain passable after rollback.
- **SC-003**: 100% of Business subscription activations use the predefined mock Business workspace identifier without creating or mutating real workspace state.
- **SC-004**: 100% of calls to previously known workspace API paths fail without workspace data mutation.
- **SC-005**: 0 active API documentation entries describe workspace management as a supported release capability.
- **SC-006**: Operators can distinguish every Business subscription activation from real workspace lifecycle behavior using stored subscription and audit information.

## Assumptions

- Spec 016 is the active subscription scope for this release and supersedes the broader workspace entitlement behavior from spec 015.
- Workspace management may be reintroduced later through a new feature, but it is not part of this rollback scope.
- The mock Business workspace identifier is required only to keep Business subscription records stable during the billing-only release.
- Historical workspace data, if present in non-production or transitional environments, can be ignored, cleaned, or made inert during implementation planning as long as it cannot drive active release behavior.
- No cross-service queue, storage, CV parsing, or notification contract changes are required for this rollback.
