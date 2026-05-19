---
status: migrated
---

# Feature Specification: API Gateway Analytics

**Feature Branch**: `011-api-gateway-analytics`  
**Created**: 2026-05-05  
**Status**: Migrated  
**Input**: Reverse-engineered from `api-gateway/src/analytics/**`, the gateway auth/role guard stack, and the analytics service tests.

## Problem Statement

The API Gateway needs a reporting boundary that can provide recruiters and admins with recruitment overview stats, pipeline counts, application trends, and top-job rankings from the current Prisma data. This reporting layer must remain read-only, role-restricted, and consistent with the service's live response shapes and default query windows.

## Scope And Ownership

- **Primary service(s)**: API Gateway
- **Runtime boundary**: HTTP API
- **Data boundary**: Prisma jobs, candidates, and applications
- **Legacy context**: Frozen planning sources may be consulted for background only; they are not active requirements.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Recruitment Overview (Priority: P1)

Recruiters or admins can view overall recruitment statistics and pipeline counts.

**Why this priority**: Overview and pipeline metrics are the core snapshot needed to understand the current recruiting state at a glance.  
**Independent Test**: Call `GET /analytics/overview` and `GET /analytics/pipeline` as a recruiter or admin and verify the returned totals, hire rate, and stage counts match the current Prisma data.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a recruiter or admin session, **When** the client requests the overview endpoint, **Then** the gateway returns total jobs, open jobs, total candidates, total applications, hired count, and hire rate.
2. **Given** a recruiter or admin session, **When** the client requests the pipeline endpoint, **Then** the gateway returns counts for every pipeline stage even when a stage currently has zero applications.
3. **Given** a role that is not recruiter or admin, **When** the client requests these endpoints, **Then** the gateway rejects the request with forbidden status.

### User Story 2 - Analyze Application Trends (Priority: P2)

Recruiters or admins can inspect application trends over time.

**Why this priority**: Trend data helps the team understand whether application volume is rising or falling within a selected lookback window.  
**Independent Test**: Call `GET /analytics/trends` with and without a `days` value and verify the gateway returns a continuous date series using the default 30-day window or the requested range.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** no `days` parameter, **When** the client requests trends, **Then** the gateway returns the default 30-day trend series.
2. **Given** a valid `days` parameter between 7 and 90, **When** the client requests trends, **Then** the gateway returns the matching lookback window.
3. **Given** a request outside the allowed range, **When** the client supplies an invalid `days` value, **Then** the gateway rejects the request through DTO validation.

### User Story 3 - Rank Top Jobs (Priority: P3)

Recruiters or admins can inspect the jobs with the most applications.

**Why this priority**: Top-job rankings help the team identify the most attractive or active openings after the overview and trend slices are available.  
**Independent Test**: Call `GET /analytics/top-jobs` with and without a `limit` value and verify the gateway returns jobs ordered by application count.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** no limit parameter, **When** the client requests top jobs, **Then** the gateway returns the default top five jobs.
2. **Given** a valid limit between 1 and 20, **When** the client requests top jobs, **Then** the gateway returns that many jobs ordered by application count.
3. **Given** a request outside the allowed limit range, **When** the client supplies an invalid limit value, **Then** the gateway rejects the request through DTO validation.

## Edge Cases

- Overview hire rate must stay at zero when no applications exist.
- Pipeline counts must include every defined stage even if the count is zero.
- Trend output must return a continuous date series for the requested lookback window.
- Top jobs must preserve application-count ordering and return the configured number of rows.
- The analytics controller is role-restricted, so unauthorised roles must not receive reporting data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The gateway MUST return recruitment overview statistics including jobs, candidates, applications, hired count, and hire rate.
- **FR-002**: The gateway MUST return pipeline counts for every defined application stage, including zero-count stages.
- **FR-003**: The gateway MUST return a continuous application trend series for the requested lookback window.
- **FR-004**: The gateway MUST return top jobs ordered by application count and limited by the requested or default page size.
- **FR-005**: The gateway MUST restrict analytics access to the existing recruiter and admin roles.
- **FR-006**: The gateway MUST validate analytics query parameters through the existing DTO and class-validator rules.

### Cross-Service Contracts

- **Producer**: API Gateway analytics controller responses
- **Consumer**: Browser or API client using the gateway HTTP surface for reporting
- **Payload shape**: Overview payload with totals and hire rate; pipeline payload with stage/count pairs; trend payload with date/applications pairs; top-jobs payload with job id, title, department, status, and application count
- **Compatibility rule**: Backward-compatible for consumers already using the existing routes and DTO fields
- **Validation rule**: Requests must pass role checks and query DTO bounds before Prisma reads occur

### Data / Schema Changes

- **Entity**: Analytics aggregation derived from job, candidate, and application rows
- **Attributes**: Aggregated counts, hire rate, stage totals, date-series counts, and top-job application counts
- **Ownership**: API Gateway analytics service and Prisma read queries
- **Migration impact**: None

### Operational Requirements

- **Security**: Keep analytics endpoints behind recruiter/admin authorization.
- **Observability**: Preserve the service's existing read-only query paths so reporting remains traceable through normal gateway logs.
- **Failure behavior**: Reject invalid query bounds or forbidden roles and do not invent synthetic statistics when data exists.
- **Config**: No new runtime config is required for this slice.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Recruiters or admins can retrieve overview and pipeline stats that match the current Prisma data.
- **SC-002**: Trend queries return a continuous date series and respect the default and bounded lookback windows.
- **SC-003**: Top-job rankings return the expected number of jobs ordered by application count.
- **SC-004**: Unauthorized roles are consistently blocked from analytics data.

## Assumptions

- The API Gateway remains the canonical source of recruiting analytics for its own data.
- Analytics are read-only and derive entirely from existing Prisma records.
- The reported metrics are snapshots from live data, not cached historical warehouses.
- The existing recruiter/admin role restriction is the intended access model for this reporting surface.