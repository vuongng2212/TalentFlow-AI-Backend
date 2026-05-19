---
status: migrated
---

# Feature Specification: API Gateway Workspaces

**Feature Branch**: `012-api-gateway-workspaces`  
**Created**: 2026-05-05  
**Status**: Migrated  
**Input**: Reverse-engineered from `api-gateway/src/workspaces/**`, the gateway auth/role guard stack, the workspace DTOs, and the workspace service tests.

## Problem Statement

The API Gateway needs a workspace boundary that lets recruiters and admins create workspaces, invite members, and list active members through the existing Prisma-backed membership model. This surface must remain role-restricted, respect the current business-entitlement proxy, and enforce the live membership cap used by the service.

## Scope And Ownership

- **Primary service(s)**: API Gateway
- **Runtime boundary**: HTTP API
- **Data boundary**: Prisma workspace, workspace member, and user records
- **Legacy context**: Frozen planning sources may be consulted for background only; they are not active requirements.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Create a Workspace (Priority: P1)

Recruiters or admins can create a workspace and automatically become its active owner.

**Why this priority**: Workspace creation is the entry point for the membership flow and establishes the owner relationship used by later management actions.  
**Independent Test**: Call `POST /workspaces` as a recruiter or admin and verify the gateway creates the workspace and the owner membership in a single transaction.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a recruiter or admin session, **When** the client submits a valid workspace payload, **Then** the gateway creates the workspace and an active owner membership for the requester.
2. **Given** a request with `isBusiness=true`, **When** the workspace is created, **Then** the gateway stores the business entitlement flag on the workspace record.
3. **Given** a request from a role that is not recruiter or admin, **When** the client calls the create route, **Then** the gateway rejects the request through the existing role guard.

### User Story 2 - Add a Workspace Member (Priority: P2)

Recruiters or admins who are workspace owners or admins can invite an existing user into a business-enabled workspace.

**Why this priority**: Membership management is the main follow-up action after workspace creation and depends on workspace state, access control, and member-cap validation.  
**Independent Test**: Call `POST /workspaces/:id/members` as an owner or admin and verify the gateway adds or reactivates the member when all constraints pass.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a workspace that does not exist, **When** the client requests member creation, **Then** the gateway returns not found.
2. **Given** a workspace that is not business-enabled, **When** the client requests member creation, **Then** the gateway rejects the request with forbidden status.
3. **Given** a recruiter or admin requester who is not an active owner or admin of the workspace, **When** the client requests member creation, **Then** the gateway rejects the request with forbidden status.
4. **Given** an invited email that does not belong to an existing active user, **When** the client requests member creation, **Then** the gateway returns not found.
5. **Given** an existing inactive workspace-member row, **When** the client invites that user again, **Then** the gateway reactivates the record instead of creating a duplicate.
6. **Given** the configured member cap is reached, **When** the client requests member creation, **Then** the gateway rejects the request with conflict status.

### User Story 3 - List Active Members (Priority: P3)

Recruiters or admins who are active members of a workspace can list the active members in that workspace.

**Why this priority**: Member visibility is the read-side companion to the invite flow and is required for workspace administration and review.  
**Independent Test**: Call `GET /workspaces/:id/members` as an active member and verify the gateway returns active members ordered by creation time.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a workspace that does not exist, **When** the client requests the member list, **Then** the gateway returns not found.
2. **Given** a recruiter or admin requester who is not an active member of the workspace, **When** the client requests the member list, **Then** the gateway rejects the request with forbidden status.
3. **Given** an active member request, **When** the client requests the member list, **Then** the gateway returns only active members with their user details.
4. **Given** active members exist, **When** the client requests the member list, **Then** the gateway orders results by `createdAt` ascending.

## Edge Cases

- Workspace creation must create the workspace and owner membership in one transaction so the owner is never orphaned.
- All workspace routes are currently class-level restricted to recruiter and admin roles; workspace-local owner/admin and membership checks happen in the service layer.
- Business-plan enforcement currently uses `workspace.isBusiness` as the entitlement proxy until billing exists.
- Member invitations must reject soft-deleted users even when an email match exists.
- The member cap must be enforced from the live `WORKSPACE_MAX_ACTIVE_MEMBERS` configuration value.
- Existing inactive member rows should be reactivated rather than duplicated.
- Listing members must return active members only.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The gateway MUST allow recruiters and admins to create workspaces through the HTTP API.
- **FR-002**: The gateway MUST create the workspace owner membership automatically when a workspace is created.
- **FR-003**: The gateway MUST store the workspace business entitlement flag from the request payload when provided.
- **FR-004**: The gateway MUST allow workspace owners or admins to add members only to business-enabled workspaces.
- **FR-005**: The gateway MUST reject member invitations for missing workspaces, missing users, soft-deleted users, or unauthorized requesters.
- **FR-006**: The gateway MUST reactivate an existing non-active workspace-member row instead of creating a duplicate row.
- **FR-007**: The gateway MUST enforce the configured maximum number of active workspace members.
- **FR-008**: The gateway MUST allow recruiter or admin callers who are active workspace members to list active members in ascending creation order.
- **FR-009**: The gateway MUST validate workspace and member request payloads through class-validator DTO rules.
- **FR-010**: The gateway MUST keep role restriction aligned with the existing recruiter/admin guard stack.

### Cross-Service Contracts

- **Producer**: API Gateway workspace controller responses
- **Consumer**: Browser or API client using the gateway HTTP surface for workspace management
- **Payload shape**: Workspace create payload with `name` and optional `isBusiness`; member invite payload with `email` and optional `role`; member list payload with user identity and workspace-member fields
- **Compatibility rule**: Backward-compatible for consumers already using the existing routes and DTO fields
- **Validation rule**: Requests must pass DTO validation and the existing role guard before Prisma writes occur

### Data / Schema Changes

- **Entity**: Workspace and workspace-member rows in Prisma
- **Attributes**: Workspace `name` and `isBusiness`; workspace-member `workspaceId`, `userId`, `role`, `status`, and `invitedById`
- **Ownership**: API Gateway workspace service and Prisma read/write queries
- **Migration impact**: None

### Operational Requirements

- **Security**: Keep workspace routes behind recruiter/admin authorization and member access checks.
- **Observability**: Preserve the service's existing transactional write path and read-only member listing path so normal gateway logs still trace the flow.
- **Failure behavior**: Return not found, forbidden, or conflict responses when workspace state, membership state, or member-cap constraints fail.
- **Config**: Use `WORKSPACE_MAX_ACTIVE_MEMBERS` as the live cap value with a default of `50`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Recruiters or admins can create a workspace and the owner membership is created automatically.
- **SC-002**: Authorized owners or admins can add members only when the workspace is business-enabled and the member cap is not exceeded.
- **SC-003**: Active workspace members can list the current active member set in ascending creation order.
- **SC-004**: Unauthorized roles or invalid membership conditions are consistently rejected.

## Assumptions

- The API Gateway remains the canonical HTTP surface for workspace management.
- The `isBusiness` flag is the current entitlement proxy for member management.
- Workspace membership is derived from live Prisma records rather than a separate membership service.
- The existing recruiter/admin role restriction is the intended access model for all workspace routes, while membership management adds active owner/admin and active member checks on top of that.
