---
status: migrated
---

# Feature Specification: API Gateway Users

**Feature Branch**: `002-api-gateway-users`  
**Created**: 2026-05-05  
**Status**: Migrated  
**Input**: Reverse-engineered from `api-gateway/src/users/**`, the gateway auth guards, and the users controller/service tests.

## Problem Statement

The API Gateway needs a user-management boundary that lets authenticated clients read and update profiles, lets admins list users, change roles, and soft-delete accounts, and keeps those actions aligned with the gateway's existing RBAC and soft-delete rules. This feature provides the canonical HTTP surface for user administration without exposing deleted users or allowing unsafe cross-user updates.

## Scope And Ownership

- **Primary service(s)**: API Gateway
- **Runtime boundary**: HTTP API
- **Data boundary**: Prisma user records
- **Legacy context**: Frozen planning sources may be consulted for background only; they are not active requirements.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse Users And Read Profiles (Priority: P1)

An authenticated client or admin can read user profiles, and an admin can browse the user list with pagination and filters.

**Why this priority**: Reading user records is the base management capability and the entry point for most administrative workflows.  
**Independent Test**: Call `GET /users/:id` with an authenticated session and `GET /users` with an admin session, then verify profile and paginated list responses match the current Prisma user data and exclude soft-deleted users.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a valid authenticated session, **When** the client requests a user profile by id, **Then** the gateway returns the profile or a not-found error if the user does not exist or is deleted.
2. **Given** an admin session, **When** the client requests a paginated list of users, **Then** the gateway returns matching users with the requested page, limit, search, role filter, and sort order.
3. **Given** a soft-deleted user, **When** the admin browses or reads profiles, **Then** the deleted user is excluded from list results and does not appear as an active profile.

### User Story 2 - Update Profile Data (Priority: P2)

A user can update their own profile name, and an admin can update another user's profile or role through the gateway.

**Why this priority**: Profile maintenance is the main write path, and role updates are the gateway's core admin control for access management.  
**Independent Test**: Call `PATCH /users/:id` as the owning user or admin, and `PATCH /users/:id/role` as an admin, then verify the updated user data is persisted and returned with the expected shape.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a user updates their own profile, **When** the client submits a valid name change, **Then** the gateway persists the change and returns the updated profile.
2. **Given** an admin updates another user's profile, **When** the client submits a valid request, **Then** the gateway allows the change and returns the updated profile.
3. **Given** a non-admin tries to update another user's profile, **When** the client submits the request, **Then** the gateway rejects it with forbidden status.

### User Story 3 - Administer Accounts (Priority: P3)

An admin can change a user's role and soft-delete a user account through the gateway.

**Why this priority**: Role changes and soft deletion are the highest-risk administrative actions and should be captured after the read and profile-edit paths.  
**Independent Test**: Call `PATCH /users/:id/role` and `DELETE /users/:id` with an admin session, then verify the role changes or the user is soft-deleted in Prisma.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** an admin session, **When** the client changes a user's role, **Then** the gateway updates the role and returns the updated user profile.
2. **Given** an admin session, **When** the client soft-deletes a user, **Then** the gateway marks the user deleted and returns no content.
3. **Given** a non-admin session, **When** the client attempts a role change or soft delete, **Then** the gateway rejects the request with forbidden status.

## Edge Cases

- Pagination inputs must stay within the supported minimum and maximum values.
- Search and role filters must not return soft-deleted users.
- A request to update another user's profile must fail unless the requester is that user or an admin.
- A request to change a role or delete a user must fail unless the requester is an admin.
- Requests for missing or deleted users must return not found rather than leaking stale data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The gateway MUST return paginated active users for admin list requests and MUST support search, role filtering, sorting, and paging.
- **FR-002**: The gateway MUST return a single active user profile by id and MUST reject requests for missing or deleted users.
- **FR-003**: The gateway MUST allow a user to update their own profile name and MUST allow admins to update another user's profile name.
- **FR-004**: The gateway MUST allow admins to change a user's role and soft-delete a user account.
- **FR-005**: The gateway MUST enforce the existing authenticated access and role-based guard rules at the controller boundary.
- **FR-006**: The gateway MUST validate all user query and update inputs using the existing DTO and class-validator rules.

### Cross-Service Contracts

- **Producer**: API Gateway user controller responses
- **Consumer**: Browser or API client using the gateway HTTP surface
- **Payload shape**: Paginated list payload with `data` plus `meta`; single profile payload with `id`, `email`, `fullName`, `role`, and timestamps; update payloads with `fullName` or `role`
- **Compatibility rule**: Backward-compatible for consumers that already use the existing routes, DTO fields, and response envelope
- **Validation rule**: Query parameters must pass pagination and enum validation; updates must pass string and enum validation before reaching Prisma

### Data / Schema Changes

- **Entity**: User record
- **Attributes**: `id`, `email`, `fullName`, `role`, `createdAt`, `updatedAt`, `deletedAt`
- **Ownership**: API Gateway Prisma schema and user service queries
- **Migration impact**: None for this slice; the feature uses the existing Prisma user model

### Operational Requirements

- **Security**: Protect list, update, role-change, and delete operations with the existing authenticated and role-based access rules; do not expose soft-deleted users as active records.
- **Observability**: Emit service logs for profile updates, role changes, and soft deletes.
- **Failure behavior**: Return not found or forbidden errors instead of silently ignoring invalid ownership or missing users.
- **Config**: No new runtime config is required for this slice.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can page through active users with filters and receive only non-deleted records.
- **SC-002**: A user can update their own name and see the persisted change in the returned profile.
- **SC-003**: An admin can change a user's role and soft-delete a user, and both operations are reflected in Prisma-backed reads.
- **SC-004**: Unauthorized cross-user updates and non-admin administrative actions are rejected consistently by the gateway.

## Assumptions

- The API Gateway remains the canonical HTTP surface for user administration.
- Prisma user records already exist and own the user identity data.
- Soft-deleted users should remain queryable only as historical records, not as active users.
- Clients are expected to rely on the gateway's existing JWT-based authentication and RBAC guards.