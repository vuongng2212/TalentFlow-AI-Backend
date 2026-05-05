---
status: migrated
---

# Feature Specification: API Gateway Auth

**Feature Branch**: `001-api-gateway-auth`  
**Created**: 2026-05-05  
**Status**: Migrated  
**Input**: Reverse-engineered from `api-gateway/src/auth/**`, related guards/strategies, Redis session handling, and auth unit tests.

## Problem Statement

The API Gateway needs a secure, cookie-based authentication boundary that supports registration, login, token refresh, profile lookup, and logout without exposing raw tokens in request bodies or URLs. The feature also needs brute-force protection, user-deletion checks, and audit logging so the gateway can remain the canonical HTTP auth surface for the system.

## Scope And Ownership

- **Primary service(s)**: API Gateway
- **Runtime boundary**: HTTP API
- **Data boundary**: Prisma users data plus Redis-backed session and blacklist state
- **Legacy context**: Frozen planning sources may be consulted for background only; they are not active requirements.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register And Sign In (Priority: P1)

A client can create a new account and immediately authenticate with the gateway using email and password.

**Why this priority**: Registration and login are the entry point for every other authenticated capability.  
**Independent Test**: Call `POST /auth/signup` and `POST /auth/login` with valid DTOs and verify the user is created, credentials are validated, cookies are issued, and security audit events are recorded.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** an email that does not already exist, **When** the client submits a valid signup payload, **Then** the gateway creates the user, hashes the password, and returns the created profile.
2. **Given** a valid email/password pair, **When** the client submits a login request, **Then** the gateway returns the user profile and sets access and refresh cookies.
3. **Given** an email that already exists or a bad password, **When** the client submits the request, **Then** the gateway rejects the attempt with a clear auth error and records a failed security event.

### User Story 2 - Maintain Session And Read Profile (Priority: P2)

An authenticated client can keep a session alive with the refresh cookie and read the current user profile through the gateway.

**Why this priority**: Session continuity and profile lookup are the core authenticated read flows after sign-in.  
**Independent Test**: Call `POST /auth/refresh` with a valid refresh cookie and `GET /auth/me` with an authenticated access token, then verify new cookies are issued and the profile shape matches the authenticated user.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a valid refresh cookie that matches Redis state, **When** the client calls refresh, **Then** the gateway issues a new access token and refresh token and stores the new refresh token server-side.
2. **Given** an authenticated request, **When** the client calls the profile endpoint, **Then** the gateway returns the current user id, email, full name, and role.
3. **Given** a missing, mismatched, or revoked refresh token, **When** the client calls refresh, **Then** the gateway rejects the request with unauthorized status.

### User Story 3 - Logout And Resist Brute Force (Priority: P3)

An authenticated client can log out, revoke the current refresh token, and the gateway can temporarily lock an account after repeated failed login attempts.

**Why this priority**: Logout and lockout protect session integrity and reduce credential-stuffing risk after the primary auth flow is in place.  
**Independent Test**: Call `POST /auth/logout` with an authenticated session and verify the cookies are cleared and the refresh token is blacklisted; then simulate repeated failed login attempts and verify the lockout threshold is enforced.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** an authenticated session with a refresh token id, **When** the client calls logout, **Then** the gateway clears both cookies, deletes the stored refresh token, and blacklists the token id.
2. **Given** repeated failed login attempts for the same email, **When** the attempt count reaches the configured threshold, **Then** the gateway blocks further login attempts until the Redis TTL expires.
3. **Given** a deleted user account or a token that has been revoked, **When** the client attempts to authenticate, **Then** the gateway rejects the request and logs the security failure.

## Edge Cases

- Duplicate email signup must fail with a conflict response.
- Deleted users must not be able to log in or refresh a session.
- Missing JWT secrets must fail fast during strategy or token generation setup.
- A refresh token must match both the cookie value and the Redis-stored token before it is accepted.
- A blacklisted token id must be rejected even if the cookie is otherwise valid.
- Login attempts must be counted and timed out in Redis so lockout state does not live only in process memory.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The gateway MUST allow signup with validated email, password, full name, and role data, and MUST reject duplicate emails.
- **FR-002**: The gateway MUST authenticate login requests with password verification, soft-delete awareness, and account lockout after the configured failed-attempt threshold.
- **FR-003**: The gateway MUST issue access and refresh JWTs as `httpOnly` cookies using the configured cookie settings and expiration windows.
- **FR-004**: The gateway MUST refresh sessions only when the refresh cookie matches the Redis-stored refresh token and the token id is not blacklisted.
- **FR-005**: The gateway MUST expose the current authenticated user profile and support logout that clears cookies, deletes the stored refresh token, and blacklists the active token id.
- **FR-006**: The gateway MUST emit security audit events for signup, login success/failure, refresh success/failure, logout, and lockout conditions.

### Cross-Service Contracts

- **Producer**: API Gateway auth controller responses and auth cookies
- **Consumer**: Browser or API client using the gateway HTTP surface
- **Payload shape**: JSON login/signup bodies with `email`, `password`, `fullName`, and `role` where applicable; response bodies with `message` plus user profile data; cookie pair for `access_token` and `refresh_token`
- **Compatibility rule**: Backward-compatible for consumers that already send the existing DTO fields and read the existing cookie names
- **Validation rule**: Inputs must pass class-validator DTO rules, JWT secrets must exist, and refresh requests must pass Redis token and blacklist checks

### Data / Schema Changes

- **Entity**: User session state
- **Attributes**: Access token, refresh token, token id blacklist entry, login attempt counter, TTL metadata
- **Ownership**: API Gateway runtime state in Redis; user records remain in Prisma
- **Migration impact**: None

### Operational Requirements

- **Security**: Use `httpOnly` cookies, guard public routes explicitly, reject deleted users, and keep the refresh-token blacklist path enforced.
- **Observability**: Emit security audit events and retain structured login/refresh/logout context such as IP and user agent.
- **Failure behavior**: Return unauthorized or conflict errors for invalid credentials, missing secrets, invalid refresh state, or lockout conditions; do not silently degrade to unauthenticated access.
- **Config**: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION`, and Redis-backed lockout/session storage must be available.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A valid signup request creates a user and a valid login request returns an authenticated user plus two cookies with the expected names.
- **SC-002**: Five failed login attempts for the same email trigger a temporary lockout that remains enforced until Redis TTL expiry.
- **SC-003**: Refresh requests fail when the refresh cookie is missing, mismatched, or blacklisted, and succeed when Redis state matches.
- **SC-004**: Security audit logging captures the key auth events for signup, login, refresh, logout, and lockout without relying on ad hoc console output.

## Assumptions

- The API Gateway remains the canonical HTTP auth surface for the repository.
- Redis is available for login-attempt tracking, refresh-token storage, and blacklist state.
- The Prisma users table already exists and continues to own the user identity record.
- Clients are expected to handle auth via cookies rather than manually copying bearer tokens out of response bodies.
