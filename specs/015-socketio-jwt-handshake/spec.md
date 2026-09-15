# Feature Specification: Socket.IO Handshake & Authentication

**Feature Branch**: `015-socketio-jwt-handshake`  
**Created**: 2026-05-25  
**Status**: Draft  
**Input**: User description: "Create a feature specification for GitHub Issue #50: US-001 Socket.IO Handshake & Authentication inside the notification service."

## Problem Statement

Users need a secure real-time connection to the Notification service so they can receive timely updates without relying only on polling or delayed refreshes. The Notification service must accept only authenticated real-time clients, associate each connection with the correct user identity, and reject unauthenticated or invalid connection attempts before any user-specific updates are delivered.

The feature belongs primarily in the `notification` service boundary. It may require cross-service contract alignment only if the token currently issued by API Gateway does not match the authentication expectations used by Notification.

## Clarifications

### Session 2026-05-25

- Q: Which auth token contract should Notification validate for real-time connection authentication? → A: Use the project's existing JWT authentication standard: Notification must validate the same API Gateway access token, reject missing, invalid, expired, or malformed tokens during handshake, attach authenticated user identity after successful validation, and inspect API Gateway only if needed for JWT contract alignment.
- Q: Which token transport locations should be supported during the real-time connection handshake? → A: Support `handshake.auth.token` as the primary method, support `Authorization: Bearer <token>` as fallback, and reject query-string tokens such as `?token=...` for security reasons.
- Q: Which minimum user identity fields are required for an authenticated socket identity? → A: The authenticated socket identity must include at least `sub`, `email`, and `role`, aligned with the current auth identity shape used by API Gateway and Notification service.

## Scope And Ownership

- **Primary service(s)**: Notification service
- **Runtime boundary**: Real-time client connection boundary
- **Data boundary**: API Gateway access token contract and connected user identity; no persistence change expected
- **Active docs**: Use `.specify/` and `specs/` as the current planning surface; frozen sources are reference only.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Establish Secure Real-Time Connection (Priority: P1)

An authenticated user can open a secure real-time connection to the Notification service and be recognized as that user for future notification delivery.

**Why this priority**: This is the core user value for the issue. Without an authenticated connection, no reliable or private real-time notification delivery can happen.  
**Independent Test**: Attempt to connect as a user with a valid API Gateway access token using the supported token transport locations and verify the connection is accepted and associated with that same user identity.  
**Service Ownership**: Notification service

**Acceptance Scenarios**:

1. **Given** a user has a valid API Gateway access token in `handshake.auth.token`, **When** the user opens the real-time notification connection, **Then** the connection is accepted.
2. **Given** a user has a valid API Gateway access token in `Authorization: Bearer <token>`, **When** the user opens the real-time notification connection, **Then** the connection is accepted.
3. **Given** a valid API Gateway access token contains `sub`, `email`, and `role`, **When** the connection is accepted, **Then** the Notification service associates the connection with that authenticated user identity.
4. **Given** the connection is accepted, **When** the user is ready to receive updates, **Then** the service can target updates to that user's connection without relying on a user ID supplied by the client during room selection.

### User Story 2 - Reject Unauthenticated Or Invalid Connections (Priority: P1)

A user without a valid authentication token cannot establish a real-time notification connection.

**Why this priority**: Real-time updates can contain user-specific information, so the service must fail closed before exposing a connected channel.  
**Independent Test**: Attempt to connect with no token, an invalid token, an expired token, and a malformed identity payload; verify each attempt is rejected.  
**Service Ownership**: Notification service

**Acceptance Scenarios**:

1. **Given** a connection attempt has no auth token, **When** it reaches the Notification service, **Then** the connection is rejected.
2. **Given** a connection attempt has an invalid or expired auth token, **When** it reaches the Notification service, **Then** the connection is rejected.
3. **Given** a connection attempt has a token that lacks `sub`, `email`, or `role`, **When** it reaches the Notification service, **Then** the connection is rejected.
4. **Given** a connection attempt provides the token only in the query string, **When** it reaches the Notification service, **Then** the connection is rejected.

### User Story 3 - Verify Connection Establishment Operationally (Priority: P2)

Operators and developers can confirm whether real-time notification connections are being accepted or rejected for the expected reasons.

**Why this priority**: The team needs confidence that the handshake is working in the Notification service and can diagnose auth failures without exposing sensitive token values.  
**Independent Test**: Exercise accepted and rejected connection attempts and verify the service exposes observable outcomes for connection success and failure while masking sensitive user data.  
**Service Ownership**: Notification service

**Acceptance Scenarios**:

1. **Given** a valid authenticated connection is established, **When** the service records operational output, **Then** it indicates a successful connection without exposing the raw token.
2. **Given** an invalid connection attempt is rejected, **When** the service records operational output, **Then** it indicates an authentication failure without exposing the raw token.
3. **Given** connection verification is performed during release validation, **When** both valid and invalid attempts are tested, **Then** the team can determine whether the Notification service accepts only authenticated users.

## Edge Cases

- A connection attempt provides no auth token.
- A connection attempt provides an expired, malformed, or invalid API Gateway access token.
- A token is validly signed but does not contain `sub`, `email`, or `role`.
- A token is supplied only in an unsupported query-string location that could leak through logs or browser history.
- API Gateway and Notification disagree on the accepted access token contract.
- A client attempts to select or spoof another user's notification channel after connecting.
- Multiple active connections are opened by the same authenticated user.
- A valid connection is disconnected and later reconnects with the same or refreshed auth token.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The Notification service MUST require the project's existing API Gateway access token before accepting a real-time notification connection.
- **FR-002**: The Notification service MUST reject connection attempts that have no auth token.
- **FR-003**: The Notification service MUST reject connection attempts with invalid, expired, malformed, or unverifiable auth tokens.
- **FR-004**: The Notification service MUST reject tokens that do not identify the user with at least `sub`, `email`, and `role`.
- **FR-005**: The Notification service MUST associate every accepted connection with the authenticated user identity derived from the validated API Gateway access token.
- **FR-006**: The Notification service MUST ensure user-specific real-time delivery targets are derived from the authenticated user identity, not from client-supplied user identifiers.
- **FR-007**: The Notification service MUST preserve the existing Notification service responsibility boundary and inspect API Gateway only if needed to align the JWT access token contract.
- **FR-008**: The Notification service MUST provide observable success and failure outcomes for connection establishment while preventing raw token values from appearing in operational output.
- **FR-009**: The feature MUST keep real-time authentication compatible with the project's existing JWT authentication standard used by authenticated users of the platform.
- **FR-010**: The Notification service MUST accept auth tokens from `handshake.auth.token` as the primary transport and `Authorization: Bearer <token>` as fallback.
- **FR-011**: The Notification service MUST reject auth tokens supplied only through query-string parameters.

### Cross-Service Contracts

- **Producer**: API Gateway auth flow, only if the existing access token contract needs alignment.
- **Consumer**: Notification service real-time connection boundary.
- **Payload shape**: The existing API Gateway access token that identifies the user with at least `sub`, `email`, and `role`.
- **Compatibility rule**: Prefer backward-compatible alignment with the existing authenticated user token. A breaking token contract change requires coordinated producer and consumer updates in the same change window.
- **Validation rule**: Notification must accept only API Gateway access tokens that satisfy the project's existing JWT authentication standard, arrive via supported transport locations, and include `sub`, `email`, and `role`; it must reject tokens that are missing, invalid, expired, malformed, query-string-only, or fail identity checks.

### Data / Schema Changes

- **Entity**: Connected user identity for a real-time session.
- **Attributes**: User identifier from `sub`, user `email`, and user `role`.
- **Ownership**: Notification service for connection state; API Gateway for token issuance if contract alignment is needed.
- **Migration impact**: None expected.

### Operational Requirements

- **Security**: Connections must fail closed when authentication is missing, invalid, expired, malformed, query-string-only, or insufficient to identify the user through `sub`, `email`, and `role`.
- **Observability**: Connection success and rejection must be visible enough for release verification and support triage without exposing raw tokens or sensitive personal data.
- **Failure behavior**: Rejected connection attempts must not create an authenticated user session or user-specific delivery target.
- **Config**: Runtime configuration must allow Notification to validate the same access token issued by API Gateway.

### Validation Expectations

- **Notification**: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`
- **API Gateway**: Validate only if token contract alignment requires producer changes.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of tested valid authenticated users can establish a real-time notification connection during release verification.
- **SC-002**: 100% of tested missing, invalid, expired, malformed, query-string-only, or insufficient-token connection attempts are rejected before becoming authenticated connections.
- **SC-003**: 100% of accepted test connections are associated with the same user identity represented by the API Gateway access token.
- **SC-004**: Release verification can distinguish successful connection establishment from authentication rejection without exposing raw auth token values.

## Assumptions

- Users already obtain an API Gateway access token through the existing platform authentication flow.
- This issue covers connection establishment and authentication only; actual notification payload delivery is outside this feature unless needed to verify the established connection.
- No persistence, notification schema, email delivery, or RabbitMQ message contract change is expected for this feature.
- Notification remains the owner of real-time connection handling.
