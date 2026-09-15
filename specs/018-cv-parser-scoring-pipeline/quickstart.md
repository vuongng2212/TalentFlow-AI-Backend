# Quickstart: CV Parser Scoring Pipeline

**Feature**: `018-cv-parser-scoring-pipeline`  
**Date**: 2026-06-24

This document describes how to validate the feature end-to-end after implementation. It focuses on runnable scenarios, not implementation details.

---

## Prerequisites

- Docker Compose running (PostgreSQL, RabbitMQ, MinIO, Elasticsearch, Prometheus)
- CV Parser service running on port 8081 (`cd cv-parser && mvn spring-boot:run` or via Docker)
- RabbitMQ Management UI at http://localhost:15672 (rabbitmq/rabbitmq)
- Prometheus at http://localhost:9090

## Setup

```bash
# Start infrastructure
docker-compose up -d postgres rabbitmq minio

# Build and run cv-parser
cd cv-parser
mvn clean compile
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

---

## Validation Scenarios

### 1. AI Score Produced (not zero)

Publish a mock `cv.uploaded` message with a `jobDescription` to the `talentflow.events` exchange with routing key `cv.uploaded`.

```bash
# Using a RabbitMQ management HTTP API or a script
# Payload:
{
  "candidateId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "applicationId": "3fa85f64-5717-4562-b3fc-2c963f66afa7",
  "jobId": "3fa85f64-5717-4562-b3fc-2c963f66afa8",
  "bucket": "talentflow-cvs",
  "fileKey": "cvs/test/sample-cv.pdf",
  "mimeType": "application/pdf",
  "uploadedAt": "2026-06-24T10:00:00Z",
  "jobDescription": "Looking for a Senior Backend Engineer with 5+ years Node.js experience"
}
```

**Expected outcome**:
- A `cv.parsed` event appears on the exchange with routing key `cv.parsed`
- `aiScore` ∈ [1, 100] (real score, not hardcoded 0)
- `scoringReasoning` is a non-empty string
- `parsedData` contains `fullName`, `email`, `skills`

**Contract reference**: [cv.parsed contract](contracts/scoring-contract.md#published-cvparsed-routing-key)

### 2. Scoring SKIPPED (no job description)

Publish the same message **without** `jobDescription` field.

**Expected outcome**:
- A `cv.parsed` event with `aiScore = 0`, `scoringReasoning = null`
- No error or crash

### 3. Scoring FALLBACK (Gemini unavailable)

Stop the cv-parser, disable network access to Gemini, or use a mock that throws. Then publish a valid upload message.

**Expected outcome**:
- A `cv.parsed` event with `aiScore = 50`, `scoringReasoning = "Scoring unavailable"`
- Pipeline completes without crashing

### 4. Database Persistence

After any successful CV processing, query the database:

```bash
psql -h localhost -p 5433 -U postgres -d talentflow_dev -c \
  "SELECT application_id, status, ai_score, scoring_status, error_code FROM cv_parser.cv_parse_results;"
```

**Expected outcome**: Exactly one row exists for the processed `applicationId` with populated fields.

**Data model reference**: [data-model.md](data-model.md#entity-cvparseresult)

### 5. Failure Event Published

Upload an unsupported file format (e.g., `.png` referenced as `image/png` MIME type).

**Expected outcome**:
- A `cv.failed` event with `errorCode` matching the exception type
- `retryable = false` for non-recoverable errors (wrong format)
- `failedAt` is a valid ISO-8601 timestamp
- Message is NACKed directly to DLQ (`cv_parser.jobs.dlq`)

### 6. Retryable Error Behavior

Create a transient error (e.g., stop MinIO during processing) so S3 download fails.

**Expected outcome**:
- `retryCount < maxRetries`: message is NACKed with `requeue = true`, no `cv.failed` event
- `maxRetries` exhausted: `cv.failed` published with `retryable = true`, message routed to DLQ

### 7. Prometheus Metrics

After processing at least one successful and one failed CV:

```bash
curl -s http://localhost:8081/actuator/prometheus | grep -E "cv_parsing|gemini_api|cv_ocr"
```

**Expected counters present**:
- `cv_parsing_duration_seconds_count{status="success"}` — ≥ 1
- `gemini_api_calls_total{type="scoring",outcome="success"}` — ≥ 1
- `cv_ocr_pages_total{lang="eng"}` — or `vie`, depending on test file

### 8. Correlation ID in Logs

Run one CV processing cycle, then inspect the cv-parser's stdout (or log file):

```bash
# Each JSON log line should contain:
# {"correlationId":"<applicationId>","level":"INFO","logger":"...","message":"...","timestamp":"..."}
```

**Expected**: Every log line for the processing cycle shares `correlationId` = the `applicationId` from the event. No log line lacks this field.

---

## Running Tests

```bash
# All unit tests
cd cv-parser && mvn test
# Expected: All tests pass (≥80% line coverage for new scoring classes)

# Specific test classes
mvn test -Dtest=CandidateScoringUseCaseTest
mvn test -Dtest=GeminiScoringClientTest
mvn test -Dtest=CvParsingOrchestratorTest

# Coverage report
mvn verify
open target/site/jacoco/index.html
```

---

## Monitoring

| Endpoint | Purpose |
|---|---|
| `http://localhost:8081/actuator/health` | Health check + readiness probes |
| `http://localhost:8081/actuator/prometheus` | Prometheus metrics scrape |
| `http://localhost:8081/actuator/loggers` | Dynamic log level change |
| RabbitMQ DLQ (`cv_parser.jobs.dlq`) | Monitor for permanently failed messages |
