# Feature Specification: API Gateway CV Event Orchestration

**Feature Branch**: `[017-api-gateway-cv-event-orchestration]`  
**Created**: 2026-06-18  
**Status**: Draft  
**Input**: User description: "Giúp tôi đọc và phân tích đặc tả về kế hoạch refactor contract @docs/contracts/cv-parsing-notification-contract.md . Xác định các công việc phía api-gateway cần thực hiện và thực hiện viết spec cho chúng"

## Problem Statement

The current event-driven workflow for CV parsing lacks business context when communicating between the isolated CV Parser background worker and the Notification service. The CV Parser operates without direct access to the main database, leading to a "Context Data Deficit" where it cannot provide job details or recruiter information necessary for notifications. 

To solve this, the API Gateway must act as an Orchestrator and Enricher. It will consume raw parsing events, persist the results into the database, enrich the events with business context (recruiter ID, job title, applicant details), and publish enriched domain events for the Notification service to consume and deliver real-time feedback to recruiters.

## Scope And Ownership

- **Primary service(s)**: API Gateway
- **Runtime boundary**: queue consumer, queue producer
- **Data boundary**: Prisma schema, message contract
- **Active docs**: Use `.specify/` and `specs/` as the current planning surface; frozen sources are reference only.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Process Successful CV Parsing Event (Priority: P1)

As the API Gateway, I need to consume the raw CV parsing success event, update the application record with parsing results, enrich the event with job and recruiter context, and publish a successful processed event so that the notification service can inform the recruiter.

**Why this priority**: This is the primary happy path for the core CV analysis workflow, unblocking real-time feedback for recruiters.
**Independent Test**: The message consumer in the API Gateway can be tested in isolation by injecting a mock success message, verifying the database update, and asserting that the enriched success message is published to the event bus.
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** an existing application with a pending parsing status, **When** the gateway receives a successful parsing event for this application, **Then** the application's parsing status is updated to completed along with its AI score and data, AND the gateway publishes an enriched success event containing job and applicant details.

### User Story 2 - Process Failed CV Parsing Event (Priority: P1)

As the API Gateway, I need to consume the raw CV parsing failure event, update the application record to reflect the failure, enrich the event with context, and publish a failed processed event so that the notification service can inform the recruiter of the issue.

**Why this priority**: Handling failures gracefully is essential for a robust system and good user experience. Recruiters must know if a CV failed to process.
**Independent Test**: The message consumer in the API Gateway can be tested by injecting a mock failure message, verifying the status update to failed, and asserting that the enriched failure message is published.
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** an existing application with a pending parsing status, **When** the gateway receives a failure event, **Then** the application's parsing status is updated to failed, AND the gateway publishes an enriched failure event containing context data and error details.

## Edge Cases

- What happens if the raw parsing event refers to an application ID that does not exist in the database?
- How does the system handle concurrent duplicate events for the same application?
- What happens if the database transaction fails while updating the application status?
- What if the job or recruiter information cannot be found during the enrichment process?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST update the Application database schema to include a CV parsing status (Pending, Processing, Completed, Failed), AI score, scoring reasoning, and parsed JSON data.
- **FR-002**: System MUST consume raw successful CV parsing messages from the event bus.
- **FR-003**: System MUST consume raw failed CV parsing messages from the event bus.
- **FR-004**: System MUST enrich raw events by querying the recruiter ID, job title, applicant email, and applicant name from the database.
- **FR-005**: System MUST publish an enriched success event when parsing succeeds and the database is updated.
- **FR-006**: System MUST publish an enriched failure event when parsing fails and the database is updated.
- **FR-007**: System MUST process database updates and event publishing within a resilient transaction boundary where applicable to prevent data inconsistency.

### Cross-Service Contracts

- **Producer**: CV Parser -> **Consumer**: API Gateway
- **Producer**: API Gateway -> **Consumer**: Notification Service
- **Payload shape**: 
  - Raw Success: `{ candidateId, applicationId, jobId, aiScore, parsedData, scoringReasoning, parsedAt }`
  - Raw Failure: `{ candidateId, applicationId, jobId, errorCode, errorMessage, retryable, failedAt }`
  - Enriched Success: `{ applicationId, recruiterId, jobTitle, applicantEmail, applicantName, aiScore, timestamp }`
  - Enriched Failure: `{ applicationId, recruiterId, jobTitle, applicantEmail, applicantName, errorMessage, timestamp }`
- **Compatibility rule**: Migration required. The Notification service must be updated to consume enriched events instead of raw events.
- **Validation rule**: Validate incoming raw event payloads against expected schemas before processing.

### Service Boundary Notes

- **API Gateway**: Prefer NestJS modules, RabbitMQ controllers/listeners, DTOs, and Prisma schema changes under `api-gateway/src/` and `api-gateway/prisma/`.

### Data / Schema Changes

- **Entity**: Application
- **Attributes**: 
  - CV Parsing Status (enum, default Pending)
  - AI Score (optional number)
  - Scoring Reasoning (optional text)
  - Parsed Data (optional JSON)
- **Ownership**: API Gateway
- **Migration impact**: Migration needed. Existing application records may need the parsing status backfilled to a sensible default.

### Operational Requirements

- **Observability**: Log incoming raw events, enrichment process success/failure, and outgoing published events.
- **Failure behavior**: Messages that fail to process (e.g., application not found, DB errors) should be rejected and routed to a Dead Letter Queue (DLQ) after retries.

### Validation Expectations

- **Gateway**: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`

Note: Tests MUST be authored before implementation for non-trivial user stories (TDD). The spec MUST list the minimal tests that will be created and used as the gating criteria for implementation.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: API Gateway successfully consumes and acknowledges 100% of valid raw parsing events.
- **SC-002**: 100% of successfully consumed events result in correctly updated Application records in the database.
- **SC-003**: API Gateway successfully publishes 100% of enriched events following successful database updates.
- **SC-004**: Database migrations execute successfully with zero data loss or downtime.

## Assumptions

- The Notification service updates to consume enriched events will be coordinated with or handled separately but aligned with this contract.
- The CV Parser already publishes the raw events in the exact format defined in the shared documentation.
- The API Gateway already has a working RabbitMQ connection and infrastructure to consume and publish events.