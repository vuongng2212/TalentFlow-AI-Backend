---
status: migrated
---

# Feature Specification: API Gateway Applications

**Feature Branch**: `003-api-gateway-applications`  
**Created**: 2026-05-05  
**Status**: Migrated  
**Input**: Reverse-engineered from `api-gateway/src/applications/**`, the storage and queue boundary, and the applications controller/service tests.

## Problem Statement

The API Gateway needs an application-management boundary that lets authenticated users submit applications, optionally upload CVs, inspect applications through role-based access, and update or withdraw applications without breaking the existing storage and queue contracts. This feature is also the gateway's main producer of the CV upload event consumed by the parser service, so the contract must stay explicit and safe.

## Scope And Ownership

- **Primary service(s)**: API Gateway
- **Runtime boundary**: HTTP API plus queue producer
- **Data boundary**: Prisma application and candidate records, plus R2/MinIO file storage and RabbitMQ message state
- **Legacy context**: Frozen planning sources may be consulted for background only; they are not active requirements.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit Applications (Priority: P1)

An authenticated user can submit a job application with a cover letter or a CV upload, and the gateway will create the application, persist the linked candidate record when needed, and publish the CV upload event for downstream processing.

**Why this priority**: Application submission is the primary business flow and the entry point for the parser pipeline.  
**Independent Test**: Call `POST /applications` and `POST /applications/upload` with a valid authenticated user, then verify the application is created, duplicate submissions are rejected, CV files are stored, and the queue event is published with the expected contract.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** an open job and an authenticated user, **When** the client submits a valid application payload, **Then** the gateway creates the application and returns the saved application data.
2. **Given** a valid CV file and job id, **When** the client submits a multipart upload request, **Then** the gateway stores the file, creates the application, and publishes a `cv.uploaded` event that includes `bucket` and `fileKey`.
3. **Given** the user has already applied to the same job, **When** the client submits another application or upload, **Then** the gateway rejects the duplicate with a conflict response.

### User Story 2 - Browse Applications (Priority: P2)

Authenticated users can browse and inspect applications using role-based visibility rules.

**Why this priority**: Users and recruiters need to see application status and progress after submission, and the gateway already contains the visibility rules that control that access.  
**Independent Test**: Call `GET /applications` and `GET /applications/:id` as different roles, then verify list filtering, pagination, and access checks match the current runtime behavior.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** an admin session, **When** the client requests a list of applications, **Then** the gateway returns the paginated application set and allows the candidate filter.
2. **Given** a recruiter or candidate session, **When** the client requests the application list, **Then** the gateway returns only the applications visible to that role.
3. **Given** a user who is not the applicant, recruiter, or admin, **When** the client requests a specific application, **Then** the gateway rejects the request with forbidden status.

### User Story 3 - Update And Withdraw Applications (Priority: P3)

Recruiters, applicants, and admins can update application details within the gateway's role rules, and applicants or admins can withdraw applications.

**Why this priority**: Updates and withdrawals are important lifecycle controls, but they depend on the application already existing and being visible.  
**Independent Test**: Call `PUT /applications/:id` and `DELETE /applications/:id` with the appropriate role and verify the returned application data, reviewed timestamp behavior, and soft-delete/withdrawal state.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a recruiter or admin, **When** the client updates stage, status, or notes, **Then** the gateway persists the update and sets `reviewedAt` when the status changes.
2. **Given** an applicant, **When** the client updates the cover letter, **Then** the gateway persists the cover letter change while preserving authorization boundaries.
3. **Given** an applicant or admin, **When** the client withdraws the application, **Then** the gateway marks it deleted and changes the status to withdrawn.

## Edge Cases

- A submission must fail when the job does not exist, is deleted, or is not open.
- Duplicate application submissions must fail with a conflict response.
- CV uploads must reject invalid file types, file signatures, or files larger than 10MB.
- If CV storage succeeds but queue publish fails, the gateway must roll back the created application and delete the uploaded file.
- If presigned URL generation fails, the gateway should still return the application response and omit the optional presigned URL.
- Application list filters must respect role-based visibility and must not surface deleted applications.
- Candidate id filtering is admin-only.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The gateway MUST allow authenticated users to submit applications for open jobs and MUST reject submissions for missing, deleted, closed, or duplicate applications.
- **FR-002**: The gateway MUST support CV upload submissions that store the file, create the application, and publish a queue event for downstream CV processing.
- **FR-003**: The gateway MUST publish CV upload events with `bucket` and `fileKey` and MUST not publish direct file URLs in the event payload.
- **FR-004**: The gateway MUST support role-based application browsing and detail access for admin, recruiter, applicant, and other authenticated users according to the existing rules.
- **FR-005**: The gateway MUST allow recruiters or admins to update stage, status, and notes, allow applicants to update cover letters, and set `reviewedAt` when status changes.
- **FR-006**: The gateway MUST allow applicants or admins to withdraw applications and MUST mark withdrawn applications as deleted with withdrawn status.
- **FR-007**: The gateway MUST validate file metadata, multipart inputs, query parameters, and DTO fields at the HTTP boundary before touching storage, queue, or Prisma state.

### Cross-Service Contracts

- **Producer**: API Gateway queue service publishing `cv.uploaded`
- **Consumer**: CV Parser worker consuming from `cv_parser.jobs`
- **Payload shape**: `candidateId`, `applicationId`, `jobId`, `bucket`, `fileKey`, `mimeType`, `uploadedAt`
- **Compatibility rule**: Backward-compatible; keep `bucket + fileKey` as the file reference contract and do not reintroduce file URLs
- **Validation rule**: Only publish after the application is created and the file has passed type, size, and signature validation

### Data / Schema Changes

- **Entity**: Application record and candidate record
- **Attributes**: `jobId`, `candidateId`, `stage`, `status`, `cvFileKey`, `cvFileUrl`, `coverLetter`, `notes`, `appliedAt`, `reviewedAt`, `deletedAt`
- **Ownership**: API Gateway Prisma schema and runtime queries
- **Migration impact**: None for this slice; the feature uses the existing application and candidate models

### Operational Requirements

- **Security**: Keep application reads and writes behind the existing JWT auth and role checks; protect CV upload with strict file validation.
- **Observability**: Emit logs for upload failures, queue failures, and rollback behavior; sanitize errors before logging sensitive details.
- **Failure behavior**: Roll back created applications and uploaded files when queue publishing fails; return clear not-found, forbidden, conflict, or bad-request errors for invalid input and authorization failures.
- **Config**: `RABBITMQ_URL`, `RABBITMQ_HEARTBEAT_SEC`, `RABBITMQ_RECONNECT_INITIAL_DELAY_MS`, `RABBITMQ_RECONNECT_MAX_DELAY_MS`, `R2_ENDPOINT` or `R2_ACCOUNT_ID`, `R2_BUCKET`, and optional `R2_PUBLIC_URL` must be available as configured today.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authenticated user can submit a standard application or a CV-upload application for an open job, and duplicate submissions are rejected.
- **SC-002**: A CV upload request stores the file, creates the application, and emits a queue event that includes `bucket` and `fileKey`.
- **SC-003**: Application browsing respects the role-based visibility rules and excludes deleted applications.
- **SC-004**: Update and withdraw actions enforce the current authorization rules and persist the expected lifecycle state changes.

## Assumptions

- The API Gateway remains the canonical HTTP surface for application lifecycle management.
- The CV Parser consumes the queue event produced by the gateway and depends on the `bucket + fileKey` file reference contract.
- R2/MinIO storage is already available for file upload and signed URL generation.
- The existing application and candidate Prisma models remain the source of truth for persisted application state.