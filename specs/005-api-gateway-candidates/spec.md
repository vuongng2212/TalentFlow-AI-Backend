---
status: migrated
---

# Feature Specification: API Gateway Candidates

**Feature Branch**: `005-api-gateway-candidates`  
**Created**: 2026-05-05  
**Status**: Migrated  
**Input**: Reverse-engineered from `api-gateway/src/candidates/**`, the gateway auth/role guard stack, and the candidates controller/service tests.

## Problem Statement

The API Gateway needs a candidate-management boundary that lets authorized internal roles browse candidate records, inspect candidate application history, update candidate contact details, and remove candidates when necessary. The feature must preserve role checks, support search and pagination, and reflect the current runtime behavior where candidate deletion is a hard delete that cascades to related applications.

## Scope And Ownership

- **Primary service(s)**: API Gateway
- **Runtime boundary**: HTTP API
- **Data boundary**: Prisma candidate records plus related application rows through cascade delete behavior
- **Legacy context**: Frozen planning sources may be consulted for background only; they are not active requirements.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse Candidate Records (Priority: P1)

Authorized internal roles can browse candidate records and inspect a candidate's application history.

**Why this priority**: Candidate browsing is the entry point for recruiter and interviewer workflows that need to inspect talent and related application history.  
**Independent Test**: Call `GET /candidates` and `GET /candidates/:id` as a recruiter, admin, or interviewer, then verify search, pagination, and candidate detail data with application history are returned as expected.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a recruiter, admin, or interviewer session, **When** the client requests the candidates list, **Then** the gateway returns paginated candidates with application counts and search filtering.
2. **Given** a valid candidate id, **When** the client requests the candidate detail view, **Then** the gateway returns the candidate plus their non-deleted application history with job summaries.
3. **Given** a missing candidate id, **When** the client requests the detail view, **Then** the gateway returns not found.

### User Story 2 - Update Candidate Information (Priority: P2)

Recruiters or admins can update a candidate's contact and profile details.

**Why this priority**: Candidate contact data changes are common maintenance work and should remain controlled to trusted roles.  
**Independent Test**: Call `PATCH /candidates/:id` as a recruiter or admin and verify the candidate record is updated with the supplied name, phone, or LinkedIn URL.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a recruiter or admin session, **When** the client submits a valid update payload, **Then** the gateway persists the candidate changes and returns the updated record.
2. **Given** a missing candidate id, **When** the client submits the update, **Then** the gateway returns not found.
3. **Given** a request from a role that is not recruiter or admin, **When** the client attempts an update, **Then** the gateway rejects the request with forbidden status.

### User Story 3 - Remove Candidates (Priority: P3)

An admin can delete a candidate record when removal is required.

**Why this priority**: Candidate deletion is a destructive administrative action and should be captured after the read and update flows.  
**Independent Test**: Call `DELETE /candidates/:id` as an admin and verify the candidate is removed and related applications are cascaded according to the current Prisma behavior.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** an admin session, **When** the client deletes a candidate, **Then** the gateway removes the candidate record and cascades related applications.
2. **Given** a missing candidate id, **When** the client submits delete, **Then** the gateway returns not found.
3. **Given** a non-admin session, **When** the client attempts delete, **Then** the gateway rejects the request with forbidden status.

## Edge Cases

- Candidate search must match name or email and remain case-insensitive.
- Candidate detail responses must omit soft-delete semantics because the model is hard-deleted rather than archived.
- Deleting a candidate must cascade related applications rather than leaving orphaned rows.
- Candidate list responses include application counts, so count metadata must stay in sync with the current application relationship.
- Missing candidates must return not found instead of exposing stale data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The gateway MUST allow recruiters, admins, and interviewers to browse paginated candidate lists and search by name or email.
- **FR-002**: The gateway MUST return candidate detail views with related non-deleted applications and job summary data.
- **FR-003**: The gateway MUST allow recruiters or admins to update candidate contact and profile fields.
- **FR-004**: The gateway MUST allow only admins to delete a candidate.
- **FR-005**: The gateway MUST preserve the current hard-delete and cascade-delete behavior for candidates and related applications.
- **FR-006**: The gateway MUST validate candidate query and update inputs using the existing DTO and class-validator rules.

### Cross-Service Contracts

- **Producer**: API Gateway candidate controller responses
- **Consumer**: Browser or API client using the gateway HTTP surface, including the applications flow that reads candidate history
- **Payload shape**: Paginated candidate lists with counts; candidate detail responses with applications and job summaries; update payloads with `fullName`, `phone`, and `linkedinUrl`
- **Compatibility rule**: Backward-compatible for consumers already using the existing routes and DTO fields
- **Validation rule**: Query parameters and update payloads must pass DTO validation before Prisma writes occur

### Data / Schema Changes

- **Entity**: Candidate record
- **Attributes**: `id`, `fullName`, `email`, `phone`, `linkedinUrl`, `resumeUrl`, `createdAt`, `updatedAt`
- **Ownership**: API Gateway Prisma schema and runtime queries
- **Migration impact**: None for this slice; the feature uses the existing candidate model and existing cascade behavior

### Operational Requirements

- **Security**: Protect candidate list, detail, update, and delete operations with the existing JWT auth and role checks.
- **Observability**: Preserve the service logging already used for candidate updates and deletions so destructive actions remain traceable.
- **Failure behavior**: Return not found for missing candidates and forbidden for unauthorized operations; do not partially delete a candidate.
- **Config**: No new runtime config is required for this slice.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Recruiters, admins, and interviewers can page through searchable candidate lists and see application counts.
- **SC-002**: Recruiters or admins can update candidate profile data and receive the persisted result.
- **SC-003**: Admins can delete candidates, and related applications are removed through the existing cascade behavior.
- **SC-004**: Unauthorized update or delete attempts are consistently rejected by the gateway.

## Assumptions

- The API Gateway remains the canonical HTTP surface for candidate management.
- Candidate deletion is intentionally destructive and does not use a soft-delete field in the current model.
- Candidate application history is read from the existing Prisma relationship and only includes non-deleted applications.
- The existing JWT auth and RBAC guards remain the source of truth for access control.