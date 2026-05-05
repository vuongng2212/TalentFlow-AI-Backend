---
status: migrated
---

# Feature Specification: Notification Service

**Feature Branch**: `013-notification`  
**Created**: 2026-05-05  
**Status**: Migrated  
**Input**: Reverse-engineered from `notification/src/**`, the service auth stack, the email delivery layer, health checks, and the existing unit tests.

## Problem Statement

The Notification service needs to send email notifications through the current Mailer/Handlebars pipeline, expose authenticated notification lookup routes, and report health for the service, database, and RabbitMQ connection. The runtime is partially scaffolded, so this spec must reflect the live HTTP and email behavior without claiming a persisted notification store or working event consumer that the code does not yet provide.

## Scope And Ownership

- **Primary service(s)**: Notification service
- **Runtime boundary**: HTTP API, email delivery, health endpoints, and RabbitMQ connectivity checks
- **Data boundary**: Synthetic notification response objects, Mailer output, and RabbitMQ readiness state
- **Legacy context**: Frozen planning sources may be consulted for background only; they are not active requirements.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Send an Email Notification (Priority: P1)

An authenticated caller can send an email notification using either a plain body or a template-backed payload.

**Why this priority**: Email dispatch is the core runtime behavior currently implemented in the service.  
**Independent Test**: Call `POST /api/notifications/send` with a valid JWT and verify the Mailer service receives the expected body or rendered template input and the controller returns a notification response.  
**Service Ownership**: Notification service

**Acceptance Scenarios**:

1. **Given** a valid authenticated user, **When** the client sends a plain-body notification request, **Then** the service sends a direct email and returns a response with `status=sent`.
2. **Given** a valid authenticated user, **When** the client sends a template-backed notification request, **Then** the service resolves the template ID from the request type and renders the matching Handlebars template.
3. **Given** a request that omits `body` and `templateId`, **When** the client submits the payload, **Then** DTO validation rejects the request.
4. **Given** the Mailer transport fails transiently, **When** the service retries the email send, **Then** it attempts delivery up to three times and eventually succeeds or fails with service unavailable.
5. **Given** the Mailer transport fails on all attempts, **When** the service exhausts retries, **Then** the service returns a service unavailable error.

### User Story 2 - Retrieve a Notification View (Priority: P2)

An authenticated caller can retrieve a notification view by ID.

**Why this priority**: The service exposes a read route today, even though the backing record is synthesized rather than persisted.  
**Independent Test**: Call `GET /api/notifications/:id` with a valid JWT and verify the response shape matches the notification DTO.  
**Service Ownership**: Notification service

**Acceptance Scenarios**:

1. **Given** a valid authenticated user, **When** the client requests a notification by ID, **Then** the service returns a notification response payload.
2. **Given** a valid authenticated user, **When** the client requests a notification by ID, **Then** the response includes the caller's user ID and a stable view model shape.
3. **Given** an invalid or missing JWT, **When** the client requests the notification route, **Then** the request is rejected by the JWT guard.

### User Story 3 - Check Service Readiness And RabbitMQ Health (Priority: P3)

Operators can verify the service is alive and ready, including database and RabbitMQ dependencies.

**Why this priority**: The service is deployed with health and connectivity checks, and those checks are part of the runtime contract.  
**Independent Test**: Call `/health`, `/health/ready`, and `/health/live` and verify liveness succeeds while readiness depends on database and RabbitMQ health.  
**Service Ownership**: Notification service

**Acceptance Scenarios**:

1. **Given** the service is running, **When** an operator calls the liveness route, **Then** the service returns `status=ok`.
2. **Given** the database and RabbitMQ are healthy, **When** an operator calls the readiness route, **Then** the service returns `status=ok`.
3. **Given** the database or RabbitMQ is unavailable, **When** an operator calls the readiness route, **Then** the service returns service unavailable.

## Edge Cases

- Notification responses are synthesized in memory and do not persist to a repository yet.
- Template-backed notifications must use the resolved Handlebars template corresponding to the notification type.
- The email layer retries transient failures with exponential backoff before returning service unavailable.
- RabbitMQ health must fail cleanly if the queue check cannot be performed.
- The empty notification consumer and gateway are scaffold placeholders and must not be described as working delivery paths.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The service MUST allow authenticated callers to send email notifications through `POST /api/notifications/send`.
- **FR-002**: The service MUST support either plain-body email content or template-backed rendering from the notification request DTO.
- **FR-003**: The service MUST retry transient email delivery failures up to three attempts before returning service unavailable.
- **FR-004**: The service MUST return a notification response payload with the live DTO shape after sending an email.
- **FR-005**: The service MUST allow authenticated callers to retrieve a notification view by ID through `GET /api/notifications/:id`.
- **FR-006**: The service MUST protect the notification routes with the existing JWT guard.
- **FR-007**: The service MUST expose liveness and readiness health checks under `/health`, `/health/ready`, and `/health/live`.
- **FR-008**: The readiness check MUST verify both the database and RabbitMQ dependencies.
- **FR-009**: The service MUST validate notification send payloads with class-validator DTO rules.
- **FR-010**: The service MUST keep the current notification type-to-template mapping aligned with the available email templates.

### Cross-Service Contracts

- **Producer**: Notification controller responses, email delivery, and health endpoints
- **Consumer**: Browser or API client using the notification HTTP surface, and operators monitoring readiness
- **Payload shape**: Send notification payload with `to`, `subject`, `type`, optional `channel`, optional `body`, optional `templateId`, and optional `templateData`; notification response payload with `id`, `userId`, `type`, `channel`, `title`, `message`, `recipient`, `subject`, `status`, `read`, `sentAt`, and `createdAt`
- **Compatibility rule**: Backward-compatible for consumers already using the existing routes and DTO fields
- **Validation rule**: Requests must pass DTO validation and JWT auth before the service attempts email delivery

### Data / Schema Changes

- **Entity**: In-memory notification response object and email template assets
- **Attributes**: Notification `id`, `userId`, `type`, `channel`, `title`, `message`, `recipient`, `subject`, `status`, `read`, `sentAt`, and `createdAt`
- **Ownership**: Notification service and email delivery layer
- **Migration impact**: None

### Operational Requirements

- **Security**: Keep notification routes behind JWT authentication and preserve throttling on the send endpoint.
- **Observability**: Preserve the current retry logs, mail-sending logs, and health check logs so delivery and dependency failures remain traceable.
- **Failure behavior**: Return unauthorized for missing JWTs, service unavailable for exhausted email retries, and service unavailable for readiness failures.
- **Config**: Reuse the existing app, SMTP, RabbitMQ, and JWT config surfaces with their validated defaults.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Authenticated callers can send plain-body and template-backed emails through the notification route.
- **SC-002**: Email retry behavior either succeeds within the configured attempts or fails deterministically with service unavailable.
- **SC-003**: Authenticated callers can retrieve the live notification response shape by ID.
- **SC-004**: Operators can distinguish liveness from readiness, and readiness fails when RabbitMQ or database checks fail.

## Assumptions

- The notification service remains an API gateway-adjacent runtime shell rather than a full persisted notification system.
- The email pipeline is the only fully implemented delivery path today.
- The existing RabbitMQ and websocket scaffolds are placeholders until a real event-driven delivery flow is wired.
- The JWT-protected routes are the intended public notification surface for the current release.
