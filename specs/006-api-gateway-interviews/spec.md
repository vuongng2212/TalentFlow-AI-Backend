---
status: migrated
---

# Feature Specification: API Gateway Interviews

**Feature Branch**: `006-api-gateway-interviews`  
**Created**: 2026-05-05  
**Status**: Migrated  
**Input**: Reverse-engineered from `api-gateway/src/interviews/**`, the gateway auth/role guard stack, and the interviews controller/service tests.

## Problem Statement

The API Gateway needs an interview-scheduling boundary that lets recruiters and admins create, inspect, reschedule, and cancel interviews tied to applications, while enforcing future-date validation and interviewer existence checks. The feature must preserve role checks, support filtered browsing, and keep the runtime behavior where cancellation is represented by a status change instead of a hard delete.

## Scope And Ownership

- **Primary service(s)**: API Gateway
- **Runtime boundary**: HTTP API
- **Data boundary**: Prisma interview records plus linked application and interviewer references
- **Legacy context**: Frozen planning sources may be consulted for background only; they are not active requirements.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Schedule Interviews (Priority: P1)

Recruiters or admins can schedule interviews for existing applications.

**Why this priority**: Scheduling is the primary write path and the root of the interview workflow.  
**Independent Test**: Call `POST /interviews` with a recruiter or admin session and verify the interview is created only when the application exists and the scheduled time is in the future.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** an existing application and a future scheduled time, **When** the client submits a valid create-interview payload, **Then** the gateway creates the interview and returns the scheduled interview data.
2. **Given** an interviewer id is provided, **When** the client submits the request, **Then** the gateway verifies that the interviewer exists before creating the interview.
3. **Given** a missing application or a past scheduled time, **When** the client submits the request, **Then** the gateway rejects it with not found or bad request.

### User Story 2 - Browse Interviews (Priority: P2)

Recruiters, admins, and interviewers can browse interviews and inspect interview details with the linked application context.

**Why this priority**: Scheduling workflows need a way to review upcoming and past interviews, and the service already exposes filtered list and detail reads for internal roles.  
**Independent Test**: Call `GET /interviews` and `GET /interviews/:id` as an authorized internal role, then verify filtering, pagination, and relation data match the current runtime behavior.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** an authorized internal role, **When** the client requests the interview list, **Then** the gateway returns paginated interviews with the requested filters.
2. **Given** a valid interview id, **When** the client requests the detail view, **Then** the gateway returns the interview with application and interviewer context.
3. **Given** a missing interview id, **When** the client requests the detail view, **Then** the gateway returns not found.

### User Story 3 - Reschedule Or Cancel Interviews (Priority: P3)

Recruiters or admins can update interview details and cancel interviews.

**Why this priority**: Update and cancel actions are lifecycle controls that depend on the interview already existing.  
**Independent Test**: Call `PATCH /interviews/:id` and `DELETE /interviews/:id` as a recruiter or admin, then verify the interview is updated, rescheduled only to future times, or marked cancelled.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a recruiter or admin, **When** the client submits a valid update payload, **Then** the gateway persists the changed interview fields and returns the updated interview.
2. **Given** a valid future scheduled time is supplied on update, **When** the client reschedules the interview, **Then** the gateway accepts the new time; if the time is in the past, it rejects the request.
3. **Given** a recruiter or admin cancels the interview, **When** the client submits the delete request, **Then** the gateway marks the interview status as cancelled rather than removing the record.

## Edge Cases

- Interview creation must fail when the application does not exist or is deleted.
- Interview creation and rescheduling must fail when the scheduled time is not in the future.
- Interview creation must fail when the referenced interviewer does not exist.
- Interview list filters must stay consistent across application, interviewer, type, and status inputs.
- Cancellation must update status to `CANCELLED` rather than hard-deleting the interview.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The gateway MUST allow recruiters or admins to create interviews for existing applications.
- **FR-002**: The gateway MUST validate that interview times are in the future and that optional interviewer references exist before creating or updating interviews.
- **FR-003**: The gateway MUST expose filtered, paginated interview browsing for recruiters, admins, and interviewers.
- **FR-004**: The gateway MUST return interview detail records with linked application and interviewer context.
- **FR-005**: The gateway MUST allow recruiters or admins to update interview timing and metadata.
- **FR-006**: The gateway MUST cancel interviews by updating the interview status to `CANCELLED` rather than deleting the record.
- **FR-007**: The gateway MUST validate all interview query and mutation inputs using the existing DTO and class-validator rules.

### Cross-Service Contracts

- **Producer**: API Gateway interview controller responses
- **Consumer**: Browser or API client using the gateway HTTP surface, including application-management users who need scheduling data
- **Payload shape**: Create/update payloads with `applicationId`, `scheduledAt`, `duration`, `type`, `location`, `notes`, and optional `interviewerId`; response payloads with interview metadata plus linked application and interviewer summary data
- **Compatibility rule**: Backward-compatible for consumers already using the existing routes and DTO fields
- **Validation rule**: Requests must pass future-date checks, interviewer existence checks, and DTO validation before Prisma writes occur

### Data / Schema Changes

- **Entity**: Interview record
- **Attributes**: `applicationId`, `scheduledAt`, `duration`, `type`, `location`, `notes`, `status`, `interviewerId`, `createdAt`, `updatedAt`
- **Ownership**: API Gateway Prisma schema and runtime queries
- **Migration impact**: None for this slice; the feature uses the existing interview model

### Operational Requirements

- **Security**: Protect interview create, update, and cancel operations with the existing recruiter/admin role checks; keep browse endpoints constrained to authorized internal roles.
- **Observability**: Preserve the service logging already used for interview creation, updates, and cancellations.
- **Failure behavior**: Return not found or bad request for missing links and invalid times, and do not mutate records that do not exist.
- **Config**: No new runtime config is required for this slice.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Recruiters or admins can schedule interviews only for existing applications and future times.
- **SC-002**: Authorized internal roles can browse interviews with pagination and filters.
- **SC-003**: Recruiters or admins can reschedule or update interview metadata, and past-time updates are rejected.
- **SC-004**: Interview cancellation leaves a cancelled record in place rather than hard-deleting it.

## Assumptions

- The API Gateway remains the canonical HTTP surface for interview scheduling.
- Interviews are always tied to an application and optionally to an interviewer user.
- Cancellation is intentionally represented as a status change in the current runtime behavior.
- The existing JWT auth and RBAC guards remain the source of truth for access control.