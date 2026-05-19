---
status: migrated
---

# Feature Specification: API Gateway Queue

**Feature Branch**: `008-api-gateway-queue`  
**Created**: 2026-05-05  
**Status**: Migrated  
**Input**: Reverse-engineered from `api-gateway/src/queue/**`, the applications upload flow, and the queue service tests.

## Problem Statement

The API Gateway needs a queue boundary that can connect to RabbitMQ, publish CV upload events, expose queue health and stats, and recover safely from connection loss. This boundary is the message handoff to the CV parser, so it must preserve the current topology, the `cv.uploaded` routing key, and the `bucket + fileKey` contract that downstream consumers expect.

## Scope And Ownership

- **Primary service(s)**: API Gateway
- **Runtime boundary**: Queue producer / background messaging utility
- **Data boundary**: RabbitMQ exchange, queues, and published message payloads
- **Legacy context**: Frozen planning sources may be consulted for background only; they are not active requirements.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Establish Queue Topology (Priority: P1)

The gateway can connect to RabbitMQ and establish the topology needed for CV processing.

**Why this priority**: The queue topology must exist before any CV upload event can be safely published.  
**Independent Test**: Initialize the queue service and verify it connects, asserts the exchange and queues, and binds the CV upload routing key with the current dead-letter path.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a valid RabbitMQ URL, **When** the queue service initializes, **Then** the gateway connects and asserts the exchange, processing queue, and DLQ.
2. **Given** production runtime configuration, **When** the queue service initializes, **Then** the gateway requires an `amqps://` URL.
3. **Given** the queue service shuts down, **When** the module is destroyed, **Then** the gateway closes the channel and connection gracefully.

### User Story 2 - Publish CV Upload Events (Priority: P2)

The gateway can publish the CV upload event consumed by the parser service.

**Why this priority**: Publishing the upload event is the critical business handoff from the application flow to the CV parser.  
**Independent Test**: Call the publish method with a valid event payload and verify the message is sent to `talentflow.events` with routing key `cv.uploaded`.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a valid `CvUploadedEvent`, **When** the gateway publishes the message, **Then** the event is sent as persistent JSON to the CV upload routing key.
2. **Given** a payload that includes `bucket` and `fileKey`, **When** the event is published, **Then** the gateway preserves that contract and does not introduce a direct file URL.
3. **Given** the channel is not initialized or the buffer is full, **When** publish is attempted, **Then** the gateway rejects the publish with a clear error.

### User Story 3 - Observe And Recover Queue Health (Priority: P3)

The gateway can report queue health and recover from connection loss.

**Why this priority**: Queue observability and reconnection are operational safety features that keep the messaging path resilient.  
**Independent Test**: Call the health and stats methods and simulate connection loss to verify the service reports unhealthy, schedules reconnection, and returns queue stats when available.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** an initialized connection, **When** the health method is called, **Then** the gateway reports healthy.
2. **Given** the channel is initialized, **When** queue stats are requested, **Then** the gateway returns message and consumer counts for the processing queue and DLQ.
3. **Given** a connection error or close event, **When** the service detects the failure, **Then** the gateway cleans up state and schedules a reconnect.

## Edge Cases

- Missing `RABBITMQ_URL` must fail fast during connection setup.
- Production must reject non-`amqps://` RabbitMQ URLs.
- Connection error and close events must clear in-memory connection state before reconnecting.
- Queue stats should return an empty array when the channel is not initialized or queue inspection fails.
- CV upload events must remain JSON and persistent, and must not contain file URLs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The gateway MUST connect to RabbitMQ with the configured URL, heartbeat, timeout, and reconnect settings.
- **FR-002**: The gateway MUST assert the `talentflow.events` exchange, the CV processing queue, and the CV parser DLQ, and MUST bind the `cv.uploaded` routing key.
- **FR-003**: The gateway MUST publish CV upload events as persistent JSON messages to the `cv.uploaded` routing key.
- **FR-004**: The gateway MUST preserve the `bucket + fileKey` file-reference contract and MUST not publish a direct file URL in the event payload.
- **FR-005**: The gateway MUST expose queue health and queue stats methods for operational checks.
- **FR-006**: The gateway MUST close queue resources cleanly on module shutdown and schedule reconnects on connection loss.

### Cross-Service Contracts

- **Producer**: API Gateway queue service publishing `cv.uploaded`
- **Consumer**: CV Parser worker consuming from `cv_parser.jobs`
- **Payload shape**: `candidateId`, `applicationId`, `jobId`, `bucket`, `fileKey`, `mimeType`, `uploadedAt`
- **Compatibility rule**: Backward-compatible; preserve the existing exchange, routing key, and bucket/fileKey contract
- **Validation rule**: Only publish payloads that already satisfy the application upload pipeline and have a valid initialized channel

### Data / Schema Changes

- **Entity**: RabbitMQ exchange, processing queue, and DLQ topology
- **Attributes**: Exchange name, queue names, routing key, persistent message settings, reconnect metadata, and queue stats
- **Ownership**: API Gateway queue utility plus RabbitMQ broker configuration
- **Migration impact**: None

### Operational Requirements

- **Security**: Require `amqps://` in production and keep queue payloads free of raw file URLs.
- **Observability**: Preserve connection, publish, health, and queue-stat logging so messaging issues are traceable.
- **Failure behavior**: Fail fast on missing configuration, return publish errors when the channel is unavailable, and recover via scheduled reconnects after connection loss.
- **Config**: `RABBITMQ_URL`, `RABBITMQ_HEARTBEAT_SEC`, `RABBITMQ_RECONNECT_INITIAL_DELAY_MS`, `RABBITMQ_RECONNECT_MAX_DELAY_MS`, `TIMEOUT_MS`, and `NODE_ENV` must remain available and validated by existing config rules.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Queue initialization establishes the exchange, CV processing queue, and DLQ using the configured settings.
- **SC-002**: CV upload events are published as persistent JSON with the existing routing key and no file URL field.
- **SC-003**: Health and queue-stat calls return useful operational state when the channel is live and fail safely when it is not.
- **SC-004**: Connection loss triggers cleanup and reconnect scheduling rather than leaving the service in a broken state.

## Assumptions

- The API Gateway remains the producer of the CV upload event consumed by the parser service.
- RabbitMQ topology is managed by the gateway service rather than by a separate deployment step.
- The current queue names and routing key are the stable contract for the parser integration.
- The `bucket + fileKey` reference model remains the only supported file reference in the event payload.