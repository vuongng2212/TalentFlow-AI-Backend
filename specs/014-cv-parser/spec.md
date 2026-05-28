---
status: migrated
---

# Feature Specification: CV Parser Worker

**Feature Branch**: `014-cv-parser`  
**Created**: 2026-05-05  
**Status**: Migrated  
**Input**: Reverse-engineered from `cv-parser/src/main/java/com/talentflow/cvparser/**`, the RabbitMQ topology, storage safety checks, extraction pipeline, and existing worker tests.

## Problem Statement

The CV Parser service must consume uploaded-CV events from RabbitMQ, download the referenced file safely from S3-compatible storage, parse the document text, extract structured candidate data with a hybrid LLM/rule-based strategy, and publish success or failure events back onto the shared event exchange. The runtime is a queue worker, not an HTTP service, and the documentation must reflect the live event contract, the current storage-bucket resolution behavior, the security guardrails, and the fact that persistence is currently a no-op placeholder.

## Scope And Ownership

- **Primary service(s)**: CV Parser
- **Runtime boundary**: RabbitMQ consumer, S3-compatible storage access, document parsing, OCR, extraction, and event publication
- **Data boundary**: `CvUploadedEvent` (including `bucket` and `fileKey`), `CvParsedEvent`, `CvFailedEvent`, temp files, and the parse-result repository placeholder
- **Legacy context**: Frozen planning sources may be consulted for background only; they are not active requirements.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Process an Uploaded CV Event Safely (Priority: P1)

When a CV upload event arrives, the worker downloads the referenced object from the configured storage bucket, parses the document text, and does not trust direct file URLs.

**Why this priority**: Safe event ingestion is the entry point for every downstream parsing and extraction step.  
**Independent Test**: Deliver a `CvUploadedEvent` with a valid `bucket` and `fileKey` through the RabbitMQ queue or listener and verify the worker downloads the object, parses text, and acknowledges the message on success.  
**Service Ownership**: CV Parser

**Acceptance Scenarios**:

1. **Given** a well-formed `CvUploadedEvent`, **When** the listener receives the message, **Then** the worker logs the candidate, application, and file identifiers and begins the pipeline.
2. **Given** an event that contains a path-traversal or otherwise invalid file key, **When** the worker validates storage access, **Then** the worker rejects the input instead of attempting a direct URL fetch.
3. **Given** an unsupported document type, oversized document, or path-traversal key, **When** the worker processes the event, **Then** the worker fails the message deterministically and routes it to the failure path.
4. **Given** a valid PDF or DOCX file, **When** the worker downloads and parses the object, **Then** the temporary file is deleted after parsing completes or fails.

### User Story 2 - Extract and Publish Parsed CV Data (Priority: P2)

The worker extracts candidate data from the parsed text and publishes a structured parsed event for downstream consumers.

**Why this priority**: The extracted structured output is the primary business payload produced by the parser.  
**Independent Test**: Feed a parseable CV through the worker and verify the pipeline saves the parse result placeholder, publishes `CvParsedEvent`, and maps the extracted profile into `ParsedCvData`.  
**Service Ownership**: CV Parser

**Acceptance Scenarios**:

1. **Given** parsed text that exceeds the minimum LLM threshold, **When** the worker runs extraction, **Then** it uses the Gemini-backed path and falls back to rule-based extraction when Gemini fails or times out.
2. **Given** parsed text that is too short for LLM extraction, **When** the worker runs extraction, **Then** it skips the LLM round-trip and uses rule-based extraction directly.
3. **Given** a successful extraction, **When** the pipeline completes, **Then** the worker publishes `CvParsedEvent` with the parsed candidate data and the current placeholder score value.
4. **Given** a successful pipeline run, **When** the parse result repository is invoked, **Then** the worker calls the repository hook even though the current implementation is no-op.

### User Story 3 - Publish Deterministic Failures (Priority: P3)

When the pipeline fails, the worker publishes a failure event and dead-letters the message instead of silently dropping it.

**Why this priority**: Deterministic failure handling protects the queue from poison messages and gives downstream services a stable failure contract.  
**Independent Test**: Force the parsing pipeline to throw and verify the worker publishes `CvFailedEvent` with the expected error code and nacks the message to the DLQ.  
**Service Ownership**: CV Parser

**Acceptance Scenarios**:

1. **Given** any exception during parsing or extraction, **When** the listener handles the failure, **Then** the worker publishes `CvFailedEvent` with `errorCode=PARSING_FAILED`.
2. **Given** a failure path, **When** the listener finishes handling the message, **Then** the worker negatively acknowledges the delivery and sends it to the dead-letter queue.
3. **Given** the failure event is published, **When** the error message is recorded, **Then** the worker omits stack traces and treats the failure as non-retryable.

## Edge Cases

- The message contract still includes `bucket` plus `fileKey`, but the current storage adapter resolves the bucket from configuration rather than the event payload.
- Unsupported MIME types must be rejected before parsing begins.
- PDFs exceeding the configured page limit must fail fast with a parsing error.
- DOCX files that exceed the configured text size must be rejected.
- OCR fallback must return an empty string on timeout or OCR failure instead of crashing the worker.
- The parse-result repository is currently a no-op, so persistence is logged but not stored yet.
- Gemini extraction may fail or time out, and the worker must still produce a deterministic fallback profile.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The worker MUST consume `CvUploadedEvent` messages from the RabbitMQ queue.
- **FR-002**: The worker MUST require `fileKey` in the inbound event and MUST not rely on direct file URLs.
- **FR-003**: The worker MUST download the referenced object from S3-compatible storage using the configured storage bucket and the file key from the event.
- **FR-004**: The worker MUST validate the file key, MIME type, and size constraints before parsing or downloading beyond the configured guardrails.
- **FR-005**: The worker MUST parse PDF and DOCX documents using the MIME-aware parser routing.
- **FR-006**: The worker MUST use OCR fallback when parsed text is below the configured threshold and the document type supports OCR.
- **FR-007**: The worker MUST run hybrid extraction with Gemini first for sufficiently long text and rule-based fallback on timeout or failure.
- **FR-008**: The worker MUST map extracted profile data into `ParsedCvData` and publish `CvParsedEvent` on success.
- **FR-009**: The worker MUST publish `CvFailedEvent` and dead-letter the message when the pipeline fails.
- **FR-010**: The worker MUST delete temporary files after parsing completes or fails.
- **FR-011**: The worker MUST preserve the current startup validation and fail-fast config checks for production-required storage, RabbitMQ, and Gemini settings.

### Cross-Service Contracts

- **Producer**: API Gateway or upstream CV upload publisher emitting `CvUploadedEvent`
- **Consumer**: CV Parser listener, downstream services consuming `CvParsedEvent` or `CvFailedEvent`
- **Payload shape**: Inbound upload event with `candidateId`, `applicationId`, `jobId`, `bucket`, `fileKey`, `mimeType`, and `uploadedAt`; success event with `candidateId`, `applicationId`, `jobId`, `aiScore`, `parsedData`, `scoringReasoning`, and `parsedAt`; failure event with `candidateId`, `applicationId`, `jobId`, `errorCode`, `errorMessage`, `retryable`, and `failedAt`
- **Runtime note**: The current listener does not yet consume the event `bucket` value during download; the storage adapter resolves the bucket from configuration.
- **Compatibility rule**: Backward-compatible for consumers already using the current exchange name and routing keys
- **Validation rule**: Inbound events are modeled by DTO constraints, but the current listener does not yet enforce full Rabbit payload validation at the queue boundary.

### Data / Schema Changes

- **Entity**: Parsed CV result placeholder and queued event records
- **Attributes**: Candidate identity, application identity, job identity, extracted profile fields, score placeholder, and failure metadata
- **Ownership**: CV Parser worker and the shared RabbitMQ exchange
- **Migration impact**: None for the current runtime slice; parse-result persistence remains a no-op placeholder

### Operational Requirements

- **Security**: Reject path traversal keys, unsupported document formats, and insecure S3 endpoints; never trust direct file URLs.
- **Observability**: Preserve the current worker logs for queue receipt, download, parse, extraction, persistence placeholder, success publish, and failure publish paths.
- **Failure behavior**: Ack on success, publish a failure event on exceptions, and nack to the DLQ when the pipeline cannot complete.
- **Config**: Honor the existing RabbitMQ, S3, OCR, parser, and LLM configuration defaults and fail fast when production-required settings are missing.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A valid CV upload event is processed end-to-end from queue receipt through safe download and parsing.
- **SC-002**: Successful parsing produces a structured `CvParsedEvent` with mapped candidate data.
- **SC-003**: Failures produce a deterministic `CvFailedEvent` and dead-letter the message.
- **SC-004**: Startup validation prevents the worker from running with missing critical production configuration.

## Assumptions

- The API Gateway or another upstream service is responsible for publishing `CvUploadedEvent` messages.
- The current listener does not validate the full Rabbit payload at the queue boundary; storage and parser guardrails enforce the active protections.
- The parse-result repository is intentionally a no-op placeholder in the current runtime, so persistence is not yet a contract guarantee.
- `aiScore` is currently a placeholder value rather than a real scoring model output.
- Gemini and OCR are enhancement paths, but the worker must still complete with rule-based fallback when those paths fail.
- The event `bucket` field is retained in the contract, but the current worker still uses the configured storage bucket at download time.
