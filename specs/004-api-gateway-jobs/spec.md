---
status: migrated
---

# Feature Specification: API Gateway Jobs

**Feature Branch**: `004-api-gateway-jobs`  
**Created**: 2026-05-05  
**Status**: Migrated  
**Input**: Reverse-engineered from `api-gateway/src/jobs/**`, the gateway auth/role guard stack, and the jobs controller/service tests.

## Problem Statement

The API Gateway needs a jobs boundary that lets recruiters and admins create and maintain job postings while keeping public read access for browsing and filtering active jobs. The feature must preserve owner/admin write rules, soft-delete behavior, and the structured requirements JSON that the application flow relies on.

## Scope And Ownership

- **Primary service(s)**: API Gateway
- **Runtime boundary**: HTTP API
- **Data boundary**: Prisma job records
- **Legacy context**: Frozen planning sources may be consulted for background only; they are not active requirements.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Job Postings (Priority: P1)

A recruiter or admin can create a new job posting with structured requirements.

**Why this priority**: Creating jobs is the root of the job lifecycle and the basis for applications.  
**Independent Test**: Call `POST /jobs` with a recruiter or admin session and verify the job is created with the expected fields, including the structured requirements JSON when provided.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a recruiter or admin session, **When** the client submits a valid create-job payload, **Then** the gateway creates the job and returns the created record.
2. **Given** a create-job payload with structured requirements, **When** the client submits the request, **Then** the gateway stores the nested skills and experience data in the job requirements JSON.
3. **Given** a request from a user without recruiter or admin role, **When** the client submits the request, **Then** the gateway rejects it with forbidden status.

### User Story 2 - Browse Active Jobs (Priority: P2)

Anyone can browse open jobs and inspect a job by id with filters and pagination.

**Why this priority**: Public browse and detail views are the primary discovery path for candidates and the main read workload for the service.  
**Independent Test**: Call `GET /jobs` and `GET /jobs/:id`, then verify active jobs are returned with pagination, search, salary, skills, and status filters, and deleted jobs are excluded.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a public request, **When** the client requests the jobs list, **Then** the gateway returns a paginated set of active jobs.
2. **Given** search and filter parameters, **When** the client requests the jobs list, **Then** the gateway applies title/description search, status, employment type, department, salary, and skill filters.
3. **Given** a deleted or missing job id, **When** the client requests the job detail view, **Then** the gateway returns not found.

### User Story 3 - Update And Remove Jobs (Priority: P3)

The job owner or an admin can update or soft-delete a job posting.

**Why this priority**: Maintenance and deactivation are critical lifecycle controls, but they depend on a job already existing.  
**Independent Test**: Call `PUT /jobs/:id` and `DELETE /jobs/:id` as the owner or admin, then verify the updated fields or soft-delete state in Prisma.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** the job owner or an admin, **When** the client submits an update payload, **Then** the gateway persists the job changes and returns the updated record.
2. **Given** the job owner or an admin, **When** the client deletes the job, **Then** the gateway marks the job deleted and returns no content.
3. **Given** a non-owner and non-admin session, **When** the client attempts to update or delete the job, **Then** the gateway rejects the request with forbidden status.

## Edge Cases

- Deleted jobs must not appear in public lists or detail responses.
- Salary filters must behave as range overlap checks rather than exact matching.
- Skill filtering must match the normalized comma-separated input against the requirements JSON skills array.
- Create and update payloads must accept nested requirements data only through the structured DTO.
- Missing jobs must return not found instead of leaking stale data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The gateway MUST allow recruiters or admins to create jobs with validated job fields and optional nested requirements.
- **FR-002**: The gateway MUST expose public job list and detail reads that exclude soft-deleted jobs.
- **FR-003**: The gateway MUST support search, pagination, status, employment type, department, salary range, and skill filters on job listings.
- **FR-004**: The gateway MUST allow only the job owner or an admin to update a job or soft-delete a job.
- **FR-005**: The gateway MUST store structured requirements as JSON and preserve the existing job response shape returned by the service.
- **FR-006**: The gateway MUST validate all job query and mutation inputs through the existing DTO and class-validator rules.

### Cross-Service Contracts

- **Producer**: API Gateway job controller responses
- **Consumer**: Browser or API client using the gateway HTTP surface, including the applications flow that depends on active jobs
- **Payload shape**: Job create/update payloads with core fields plus nested requirements; job list/detail responses with job data, creator metadata, and the existing service-returned count metadata
- **Compatibility rule**: Backward-compatible for consumers already using the existing routes and DTO fields
- **Validation rule**: Requests must satisfy DTO validation and ownership checks before Prisma writes occur

### Data / Schema Changes

- **Entity**: Job record
- **Attributes**: `title`, `description`, `department`, `location`, `employmentType`, `salaryMin`, `salaryMax`, `status`, `requirements`, `createdById`, `deletedAt`
- **Ownership**: API Gateway Prisma schema and runtime queries
- **Migration impact**: None for this slice; the feature uses the existing job model

### Operational Requirements

- **Security**: Protect create, update, and delete operations with the existing recruiter/admin role checks; keep browse endpoints public only where currently coded.
- **Observability**: Preserve the service's existing query and ownership paths so admins and recruiters can trace job changes through the gateway logs.
- **Failure behavior**: Return not found or forbidden errors for missing jobs and unauthorized ownership violations; do not mutate deleted records.
- **Config**: No new runtime config is required for this slice.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A recruiter or admin can create a job and receive the created job record, including requirements when provided.
- **SC-002**: Public job list and detail reads return only active jobs and support the documented filters.
- **SC-003**: Only the job owner or an admin can update or soft-delete a job.
- **SC-004**: Deleted jobs are excluded from public browsing and cannot be mutated through the gateway.

## Assumptions

- The API Gateway remains the canonical HTTP surface for job management.
- The application flow depends on open jobs being discoverable through the public listing and detail routes.
- Prisma job records already exist and own the job lifecycle state.
- The existing structured requirements JSON is the source of truth for job skill and experience metadata.