# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`  
**Created**: [DATE]  
**Status**: Draft  
**Input**: User description: "$ARGUMENTS"

## Problem Statement

[Describe the problem in terms of the runtime system, the impacted service boundary, and the business value. Call out whether the work belongs in `api-gateway/`, `cv-parser/`, `notification/`, or spans services.]

## Scope And Ownership

- **Primary service(s)**: [API Gateway | CV Parser | Notification | cross-service]
- **Runtime boundary**: [HTTP API | queue consumer | scheduled job | background worker | mixed]
- **Data boundary**: [Prisma schema | file storage | message contract | none]
- **Active docs**: Use `.specify/` and `specs/` as the current planning surface; frozen sources are reference only.

## User Scenarios & Testing _(mandatory)_

User stories must be ordered by business priority and independently testable. Each story should name the service boundary it touches.

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language.]

**Why this priority**: [Explain the value and why it is the top slice.]  
**Independent Test**: [Describe how this can be tested on its own, including the service or contract touched.]  
**Service Ownership**: [API Gateway / CV Parser / Notification / cross-service]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language.]  
**Why this priority**: [Explain the value.]  
**Independent Test**: [Describe the isolated verification path.]  
**Service Ownership**: [service boundary]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language.]  
**Why this priority**: [Explain the value.]  
**Independent Test**: [Describe the isolated verification path.]  
**Service Ownership**: [service boundary]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

## Edge Cases

- What happens when the request hits the wrong service boundary?
- How does the system handle duplicate queue messages, retries, or delayed delivery?
- What happens when file metadata, config, or contract fields are missing or invalid?
- How is backward compatibility handled if a producer or consumer changes first?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST [specific capability tied to the runtime boundary].
- **FR-002**: System MUST validate all external input at the edge using explicit types or DTOs.
- **FR-003**: System MUST persist or publish the minimum data required for the feature contract.
- **FR-004**: System MUST preserve existing service responsibilities and not introduce an unnecessary shared abstraction.
- **FR-005**: System MUST log, trace, or emit operational signals needed to support the feature safely.
- **FR-006**: System MUST [NEEDS CLARIFICATION: fill in any unresolved rule, limit, or behavior].

### Cross-Service Contracts

- **Producer**: [service, event, endpoint, or job]
- **Consumer**: [service or external integration]
- **Payload shape**: [summarize the contract fields]
- **Compatibility rule**: [backward-compatible / breaking / migration required]
- **Validation rule**: [what must be checked before accepting data]

### Service Boundary Notes

- **API Gateway**: Prefer NestJS controllers, DTOs, guards, interceptors, Prisma schema changes, and queue/storage adapters under `api-gateway/src/` and `api-gateway/prisma/`.
- **CV Parser**: Prefer RabbitMQ listeners, parser implementations, and use-case classes under `cv-parser/src/main/java/com/talentflow/cvparser/` and tests under `cv-parser/src/test/java/com/talentflow/cvparser/`.
- **Notification**: Prefer NestJS modules, mailer/websocket/rabbitmq services, and Prisma wiring under `notification/src/` and `notification/prisma/`.

### Data / Schema Changes

- **Entity**: [what it represents]
- **Attributes**: [key fields only]
- **Ownership**: [which service owns it]
- **Migration impact**: [none / migration needed / seed update / backfill]

### Operational Requirements

- **Security**: [auth, signature, file, or queue security rule]
- **Observability**: [logs, metrics, tracing, audit trail]
- **Failure behavior**: [retry, DLQ, rollback, user-visible error]
- **Config**: [environment variable or runtime config requirement]

### Validation Expectations

- **Gateway**: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`
- **Parser**: `mvn test`
- **Notification**: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: [Measurable outcome for the business result]
- **SC-002**: [Measurable runtime or quality outcome]
- **SC-003**: [Measurable contract or operational outcome]
- **SC-004**: [Measurable support, reliability, or adoption outcome]

## Assumptions

- [Assumption about target users or operators]
- [Assumption about the affected service boundary]
- [Assumption about data, queue, or storage availability]
- [Assumption about compatibility with the current runtime truth]
