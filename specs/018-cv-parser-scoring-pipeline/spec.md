# Feature Specification: CV Parser Scoring Pipeline (Phase 4 & 5)

**Feature Branch**: `018-cv-parser-scoring-pipeline`  
**Created**: 2026-06-24  
**Status**: Draft  
**Input**: User description: "Implement Phase 4 (Scoring & Event Publishing) and Phase 5 (Integration & Orchestration) for the cv-parser microservice — including AI scoring via Gemini, real DB persistence, correct RabbitMQ event payloads, short-transaction orchestration, exception classification, Prometheus metrics, and structured JSON logging with correlation IDs."

---

## Problem Statement

The `cv-parser` microservice completes document parsing and profile extraction (Phases 2 & 3) but publishes incomplete RabbitMQ events downstream. The `aiScore` field is hardcoded to `0`, `parsedData` is missing from `CvParsedEvent`, and `CvFailedEvent` lacks `retryable` and `failedAt` fields. Parse results are never persisted to the database. These gaps break the entire downstream notification pipeline: `api-gateway` receives corrupted `cv.parsed` events, cannot update `cvParsingStatus`, and cannot trigger real-time recruiter notifications.

Phase 4 completes the scoring loop and fixes event contracts. Phase 5 hardens the integration: transactional safety, structured exception routing, Prometheus observability, and correlation-aware JSON logging.

This work is primarily within the `cv-parser/` service boundary. Additionally, this PR introduces an **n8n email ingestion** feature in `api-gateway/` (Phase 1 of a separate email-ingestion automation effort) that feeds applications into the same pipeline: a public ingestion endpoint protected by an API key, an `ApiKeyGuard`, ingestion DTOs, idempotency handling, and a Prisma `externalMessageId` column. Those api-gateway changes are documented here for traceability but belong to the email-ingestion automation scope (see `docs/expansion/email-ingestion-automation.md`).

---

## Scope And Ownership

- **Primary service(s)**: CV Parser (core scoring pipeline); API Gateway (email ingestion endpoint consumed by the pipeline)
- **Runtime boundary**: RabbitMQ consumer (background worker, async)
- **Data boundary**: New Flyway-managed `cv_parse_results` table in cv-parser's own Postgres schema; RabbitMQ message contracts (`cv.parsed`, `cv.failed` on `talentflow.events`)
- **Active docs**: Use `.specify/` and `specs/` as the current planning surface; frozen sources are reference only.

---

## User Scenarios & Testing _(mandatory)_

User stories describe the observable system behavior from the perspective of a recruiter using the TalentFlow ATS, not internal implementation steps.

### User Story 1 – Recruiter receives a real AI score after CV upload (Priority: P1)

A recruiter submits a candidate CV for a specific job opening. After processing, the recruiter receives a real-time notification showing the candidate's AI compatibility score (0–100) and a brief reasoning string ("Strong match in NestJS…"), not a meaningless zero. The score reflects how well the candidate's extracted profile aligns with the job description.

**Why this priority**: The `aiScore = 0` bug corrupts the downstream notification flow for every CV upload. Fixing it is the top unblocking item for recruiters and `api-gateway` consumers.  
**Independent Test**: Publish a mock `cv.upload.requested` AMQP message with a known `applicationId` and `jobDescription`, consume the resulting `cv.parsed` event, and assert that `aiScore` is an integer in [1, 100] and `scoringReasoning` is a non-empty string.  
**Service Ownership**: CV Parser (producer); API Gateway (consumer, not changed here)

**Acceptance Scenarios**:

1. **Given** a valid CV and a non-empty `jobDescription` in the upload request, **When** the cv-parser completes extraction and calls Gemini for scoring, **Then** the published `cv.parsed` event contains `aiScore` ∈ [1, 100] and a non-null `scoringReasoning`.
2. **Given** a valid CV but an empty or absent `jobDescription`, **When** scoring is skipped, **Then** the published `cv.parsed` event contains `aiScore = 0` and `scoringReasoning = null`, and `ScoringStatus = SKIPPED`.
3. **Given** Gemini scoring API returns an error or times out, **When** the fallback activates, **Then** the published `cv.parsed` event contains `aiScore = 50`, `scoringReasoning = "Scoring unavailable"`, and `ScoringStatus = FALLBACK` — the pipeline does NOT crash.

---

### User Story 2 – Parse results are durably stored for audit and correlation (Priority: P2)

After processing, the system stores the AI score, extracted profile, error codes, and status in the database. If the service restarts or a consumer replays a message, the result record prevents double-processing and provides an audit trail.

**Why this priority**: Without persistence, every parse result is lost on restart. The `aiScore` cannot be correlated to an `applicationId` later, and the audit trail for compliance is absent.  
**Independent Test**: After processing a valid CV, query the `cv_parse_results` table for the matching `applicationId` and assert that `status`, `aiScore`, `parsedData`, and `createdAt` are populated.  
**Service Ownership**: CV Parser

**Acceptance Scenarios**:

1. **Given** a successful CV parse and score, **When** the orchestrator completes, **Then** a `cv_parse_results` row exists with `status = SUCCESS`, a non-null `aiScore`, and `parsedData` containing at minimum `fullName`, `email`, and `skills`.
2. **Given** an unrecoverable parsing failure (e.g., unsupported document format), **When** the error handler runs, **Then** a `cv_parse_results` row exists with `status = FAILED`, `errorCode`, and `errorMessage` populated.
3. **Given** a DB write succeeds but the subsequent RabbitMQ publish fails, **When** the transaction is reviewed, **Then** the DB row is committed (not rolled back), ensuring no data loss.

---

### User Story 3 – Recruiter is correctly notified when CV processing fails (Priority: P3)

When a CV cannot be processed (unsupported format, too long, storage outage), the recruiter receives a failure notification with a human-readable reason. The system distinguishes between permanent failures (DLQ immediately) and transient ones (retry up to the configured limit).

**Why this priority**: Currently, `CvFailedEvent` is missing `retryable` and `failedAt`, so `api-gateway` cannot correctly update `cvParsingStatus = FAILED` or display a meaningful error to the recruiter.  
**Independent Test**: Submit an unsupported file format, consume the resulting `cv.failed` event, and assert that `retryable = false`, `failedAt` is a valid ISO-8601 timestamp, and `errorCode` matches the expected value.  
**Service Ownership**: CV Parser (producer); API Gateway (consumer, not changed here)

**Acceptance Scenarios**:

1. **Given** a non-retryable error (`UnsupportedDocumentFormatException`), **When** the exception handler processes it, **Then** a `cv.failed` event is published with `retryable = false` and `failedAt` timestamp, and the message is NACKed directly to DLQ (no requeue).
2. **Given** a transient error (`StorageException`), **When** the exception handler processes it and `retryCount < maxRetries`, **Then** the message is NACKed with `requeue = true`; no `cv.failed` event is published until `maxRetries` is exhausted.
3. **Given** `maxRetries` is exhausted on a transient error, **When** the final attempt fails, **Then** a `cv.failed` event is published with `retryable = true`, and the message is routed to DLQ.

---

### User Story 4 – Ops team can monitor CV processing health via Prometheus (Priority: P4)

Operations can query `/actuator/prometheus` to see parse throughput, error rates, Gemini API call outcomes, and OCR page counts — enabling alerts when the error rate spikes or the Gemini circuit breaker opens.

**Why this priority**: Without application-level metrics, oncall has no signal for scoring failures or pipeline degradation.  
**Independent Test**: After processing one successful and one failed CV, scrape `/actuator/prometheus` and assert that `cv_parsing_duration_seconds`, `gemini_api_calls_total`, and `cv_ocr_pages_total` counters/histograms are present with correct tag labels.  
**Service Ownership**: CV Parser

**Acceptance Scenarios**:

1. **Given** a successful CV parse, **When** the orchestrator completes, **Then** `cv_parsing_duration_seconds{status="success"}` is incremented and `gemini_api_calls_total{type="scoring",outcome="success"}` is incremented.
2. **Given** a Gemini scoring fallback activates, **When** the fallback path runs, **Then** `gemini_api_calls_total{type="scoring",outcome="fallback"}` is incremented.
3. **Given** an OCR page is processed, **When** the OCR engine runs, **Then** `cv_ocr_pages_total{lang="eng"}` or `cv_ocr_pages_total{lang="vie"}` is incremented by the number of pages processed.

---

### User Story 5 – Logs for all CV processing steps share a single correlation ID (Priority: P5)

When a recruiter reports that a specific CV was mishandled, ops can search Kibana/Grafana Loki for the `applicationId` and see every log line from download → parse → extract → score → persist → publish, even across multiple thread pools.

**Why this priority**: Plain-text non-JSON logs with no correlation ID make it impossible to trace a single CV through async thread boundaries.  
**Independent Test**: Process one CV, capture all log output, parse it as JSON, and assert that every log line contains a `correlationId` field matching the `applicationId` from the request.  
**Service Ownership**: CV Parser

**Acceptance Scenarios**:

1. **Given** a CV processing request begins, **When** `CvParserListener` receives the AMQP message, **Then** `MDC.put("correlationId", applicationId)` is set and propagated to `parsingExecutor`, `llmExecutor`, and `ocrPageExecutor` child threads.
2. **Given** JSON logging is configured, **When** any logger in the processing chain emits a message, **Then** the log line is a valid JSON object containing `correlationId`, `level`, `message`, and `timestamp`.
3. **Given** processing completes or fails, **When** the finally block runs, **Then** MDC is cleared to prevent correlationId leakage to subsequent messages.

---

## Edge Cases

- **Gemini returns a score outside [0, 100]**: The validator rejects the response and falls back to `ScoringResult(50, "Scoring unavailable", FALLBACK)` — invalid scores must not propagate.
- **DB write succeeds, RabbitMQ publish fails**: The DB row is committed (post-commit publish pattern). The event is lost; ops must rely on the persisted DB record for recovery. No rollback of DB row occurs.
- **Duplicate AMQP message delivery**: If `applicationId` already has a `cv_parse_results` row with `status = SUCCESS`, the idempotency check prevents re-processing.
- **Missing `jobDescription` in the message payload**: Scoring is skipped gracefully (`SKIPPED` status), not treated as an error.
- **OCR produces empty text for all pages**: Rule-based fallback extraction runs; the result is persisted and published with whatever fields were extractable.
- **PII in log output**: Email addresses in log messages must be masked to `***@domain.tld`; phone numbers must not appear in log output. Stack traces must not contain raw CV text.
- **Thread pool exhaustion**: If `parsingExecutor` queue is full, the AMQP message must not be silently dropped — `RejectedExecutionException` must be surfaced and trigger NACK with requeue.
- **Flyway migration conflict**: If the `cv_parse_results` table already partially exists from a previous failed migration, Flyway must fail fast with a clear error, not silently skip.

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST calculate a real integer `aiScore` (0–100) via a dedicated Gemini API call and publish it in every `cv.parsed` event.
- **FR-002**: The system MUST persist every parse result (success, partial, or failed) to the `cv_parse_results` table before publishing the downstream event.
- **FR-003**: The system MUST publish the RabbitMQ event **after** the database transaction commits, using a post-commit synchronization hook.
- **FR-004**: The `cv.parsed` event payload MUST include `parsedData` containing at minimum `fullName`, `email`, `skills`, `experience`, and `education` as extracted from the CV.
- **FR-005**: The `cv.failed` event payload MUST include `retryable (boolean)` and `failedAt (Instant)` fields.
- **FR-006**: The system MUST classify all exceptions as retryable or non-retryable before routing to DLQ; non-retryable errors must NACK directly to DLQ within one attempt.
- **FR-007**: On any Gemini scoring failure, the system MUST apply the fallback (`aiScore = 50`, `scoringReasoning = "Scoring unavailable"`, `ScoringStatus = FALLBACK`) without propagating the exception to the AMQP listener.
- **FR-008**: The system MUST expose `cv_parsing_duration_seconds`, `gemini_api_calls_total`, and `cv_ocr_pages_total` metrics at `/actuator/prometheus`.
- **FR-009**: All log output MUST be Logstash-compatible JSON, and every log line for a single CV processing request MUST share the same `correlationId` (`applicationId`) across all thread pool boundaries.
- **FR-010**: Email addresses in log output MUST be masked (`***@domain.tld`); phone numbers and raw CV text MUST NOT appear in logs.

### Cross-Service Contracts

- **Producer**: `cv-parser` — publishes to `talentflow.events` topic exchange
- **Consumer**: `api-gateway` — consumes `cv.parsed` (routing key) and `cv.failed` (routing key)
- **Payload shape — `cv.parsed`**:
  ```json
  {
    "candidateId": "<UUID>",
    "applicationId": "<UUID>",
    "jobId": "<UUID>",
    "aiScore": 85,
    "parsedData": { "fullName": "...", "email": "...", "skills": [...], "experience": [...], "education": [...] },
    "scoringReasoning": "Strong match in NestJS...",
    "parsedAt": "2026-06-24T10:00:00Z"
  }
  ```
- **Payload shape — `cv.failed`**:
  ```json
  {
    "candidateId": "<UUID>",
    "applicationId": "<UUID>",
    "jobId": "<UUID>",
    "errorCode": "EXTRACTION_FAILED",
    "errorMessage": "...",
    "retryable": false,
    "failedAt": "2026-06-24T10:00:05Z"
  }
  ```
- **Compatibility rule**: Additive changes only — `api-gateway` consumer must not break if additional optional fields are added. Removing or renaming existing fields is a breaking change requiring coordinated update.
- **Validation rule**: `cv-parser` must validate all Gemini JSON responses against a schema before using them. `api-gateway` must validate event payloads before updating DB state.

### Service Boundary Notes

- **CV Parser**: Core changes are within `cv-parser/src/main/java/com/talentflow/cvparser/` and `cv-parser/src/test/`.
- **API Gateway**: This PR also adds the n8n email ingestion entry point (endpoint + `ApiKeyGuard` + DTOs + Prisma `externalMessageId`), which submits applications that later flow into the cv-parser pipeline. This is part of the email-ingestion automation scope and is intentionally included here for end-to-end traceability. No changes to the existing `cv.parsed`/`cv.failed` consumer logic.
- **Notification**: No changes.

### Data / Schema Changes

- **Entity**: `CvParseResult` — represents one CV processing attempt for a given `applicationId`
- **Attributes**: `id (UUID PK)`, `applicationId (UUID)`, `candidateId (UUID)`, `jobId (UUID)`, `status (ENUM: SUCCESS/PARTIAL/FAILED)`, `aiScore (Integer nullable)`, `scoringReasoning (TEXT nullable)`, `parsedData (JSONB nullable)`, `errorCode (VARCHAR nullable)`, `errorMessage (TEXT nullable)`, `createdAt (TIMESTAMPTZ)`
- **Ownership**: `cv-parser` — this table lives in cv-parser's dedicated Postgres schema, not shared with api-gateway
- **Migration impact**: New table, created by Flyway migration `V1__create_cv_parse_results.sql`; no backfill required; no api-gateway schema changes

### Operational Requirements

- **Security**: PII masking in logs (email, phone). No stack traces containing raw CV text. Existing Resilience4j `geminiApi` circuit breaker and rate limiter must be reused for the scoring call — no new Resilience4j config.
- **Observability**: Prometheus counters/histograms exposed via Actuator; Logstash JSON logs with MDC `correlationId`; MDC propagated to all three executor thread pools via `MDCTaskDecorator`; MDC cleared in `finally` block.
- **Failure behavior**: Non-retryable exceptions → publish `CvFailedEvent` → NACK to DLQ immediately. Transient exceptions → NACK with `requeue = true` up to `maxRetries` (from config); on exhaustion, publish `CvFailedEvent` → NACK to DLQ. Gemini scoring failure → fallback result, pipeline continues.
- **Config**: `maxRetries` must be configurable via `application.yml` / environment variable, not hardcoded.

### Validation Expectations

- **Parser**: `cd cv-parser && mvn test` — unit tests must cover `CandidateScoringUseCase`, `GeminiScoringClient`, and `CvParsingOrchestrator` at ≥ 80% line coverage.
- Tests must be authored before implementation (TDD: RED → GREEN → REFACTOR) for all non-trivial classes.
- Minimal required test classes:
  - `CandidateScoringUseCaseTest` — score range validation, fallback behavior, SKIPPED path
  - `GeminiScoringClientTest` — valid response, invalid JSON, score out of range, API timeout
  - `CvParsingOrchestratorTest` — success path (DB write + post-commit publish), failure path (CvFailedEvent published before NACK), transaction isolation

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every `cv.parsed` event delivered to `api-gateway` contains a real `aiScore` in [0, 100] — zero hardcoded values reach production after this feature ships.
- **SC-002**: Every CV parse attempt (success or failure) produces a durable `cv_parse_results` record within the same processing cycle, with no data loss on service restart.
- **SC-003**: Non-retryable failures reach the DLQ within one NACK attempt; transient failures retry up to the configured `maxRetries` limit before DLQ routing — no silent message drops.
- **SC-004**: Operations can query `/actuator/prometheus` and observe parse throughput, error rates, and Gemini call outcomes without manual log scraping.
- **SC-005**: All log lines for a single CV processing request share a `correlationId` field in structured JSON format, enabling single-query trace reconstruction across thread pools in Kibana or Grafana Loki.
- **SC-006**: Unit test coverage for `CandidateScoringUseCase`, `GeminiScoringClient`, and `CvParsingOrchestrator` reaches ≥ 80%, verified by `mvn test` with JaCoCo.

---

## Assumptions

- The `api-gateway` consumer (`cv.parsed` / `cv.failed` listener) already handles the corrected contract fields (`retryable`, `failedAt`, `parsedData`) — it was simply receiving incomplete data before this fix. No api-gateway code changes are required.
- The cv-parser has a dedicated Postgres database instance (separate from api-gateway's PostgreSQL). Flyway migrations run against the cv-parser DB only.
- The existing Resilience4j `geminiApi` instance (CircuitBreaker + Retry + RateLimiter) in Phase 3 is reusable for the scoring call — it is not duplicated, only referenced.
- The `jobDescription` field is present in the incoming AMQP message payload when a job is associated with the application. If absent, scoring is skipped (`SKIPPED` status), not failed.
- Logstash-compatible JSON output is sufficient for the current logging infrastructure (no OpenTelemetry tracing is required in this phase).
- `MDCTaskDecorator` is the correct Spring mechanism for propagating MDC context across `ThreadPoolTaskExecutor` boundaries in the existing codebase.
- The three thread pool executor beans (`parsingExecutor`, `llmExecutor`, `ocrPageExecutor`) are already defined — this feature adds `MDCTaskDecorator` to each, not new pools.
- Idempotency is enforced at the application layer: if a `cv_parse_results` row already exists for a given `applicationId` with `status = SUCCESS`, re-processing is skipped. This assumption may need revisiting if the existing listener does not support this check.
