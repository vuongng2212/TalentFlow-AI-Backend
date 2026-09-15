# Implementation Plan: CV Parser Scoring Pipeline (Phase 4 & 5)

**Branch**: `018-cv-parser-scoring-pipeline` | **Date**: 2026-06-24 | **Spec**: [specs/018-cv-parser-scoring-pipeline/spec.md](specs/018-cv-parser-scoring-pipeline/spec.md)
**Input**: Feature specification from `specs/018-cv-parser-scoring-pipeline/spec.md`

## Summary

Complete the `cv-parser` scoring loop (Phase 4) and harden its integration (Phase 5): add real Gemini AI scoring, persist results to a new `cv_parse_results` PostgreSQL table via Flyway, publish correct `cv.parsed`/`cv.failed` event payloads with all fields populated, implement short-transaction orchestration with post-commit publishing, classify all exceptions as retryable/non-retryable, add Prometheus metrics via Micrometer, and enable structured JSON logging with correlation IDs propagated across all thread pool executors. All changes are contained within `cv-parser/`.

## Technical Context

**Primary Runtime**: cv-parser (Spring Boot 3.3 / Java 17 — async RabbitMQ worker)
**Language/Version**: Java 17 (OpenJDK)
**Primary Dependencies**: Spring Boot 3.3, Spring AMQP, Spring Data JPA, Spring Actuator, Flyway, PostgreSQL, Resilience4j 2.2 (geminiApi circuit breaker + retry + rate limiter — existing, reused), Micrometer (Prometheus registry — NEEDS ADD), WebClient (Reactor), Jackson, Logback (JSON encoding — NEEDS ADD)
**Storage**: PostgreSQL (cv-parser schema), RabbitMQ (talentflow.events topic exchange), MinIO/S3 (file storage)
**Testing**: `cd cv-parser && mvn test` (JUnit 5 + Mockito); JaCoCo for coverage
**Target Platform**: Linux containers (Docker Compose local dev)
**Project Type**: Polyglot backend services — this feature is cv-parser only
**Performance Goals**:
  - Gemini scoring API call completes within the existing `geminiApi` timeout config (30s overall circuit breaker, 8s default per call)
  - Post-commit publish adds <50ms overhead to the success path
  - MDC propagation does not measurably affect throughput (validated by existing thread pool latency characteristics)
**Constraints**:
  - **No changes** to `api-gateway/` or `notification/` — this is cv-parser only
  - Existing Resilience4j `geminiApi` instance must be reused (no new circuit breaker config)
  - `CvUploadedEvent` DTO currently has **NO `jobDescription` field** — scoring requires job description text. NEEDS CLARIFICATION on how to obtain it.
  - Existing exception hierarchy already has `retryable` flags — classification must be systematic, not ad-hoc
  - No Flyway dependency or migration directory currently exists in cv-parser
  - No Micrometer/Prometheus or Logstash-JSON dependencies currently in pom.xml
  - Thread pool beans (`parsingExecutor`, `ocrExecutor`, `ocrPageExecutor`, `llmExecutor`) are defined without `MDCTaskDecorator`
**Scale/Scope**: 1 new entity (`CvParseResult`), 1 Flyway migration, 1 new use case (`CandidateScoringUseCase`), 1 new scoring client, modifications to `CvParsingUseCaseImpl` and `CvParserListener`

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Runtime code and current Spec Kit artifacts are authoritative.** ✅ — All plan references are from `.specify/` and `specs/018-cv-parser-scoring-pipeline/`.
- **Frozen legacy sources are context only.** ✅ — No frozen sources referenced.
- **Service boundaries must remain explicit.** ✅ — All changes within `cv-parser/`. No api-gateway or notification code changes.
- **Cross-service changes require producer and consumer alignment.** ✅ — Event payload contracts are clarified but additive only; existing api-gateway consumer already handles the corrected fields (they were simply never populated before).
- **Schema changes in the gateway require schema and migration updates together.** ✅ — Not applicable; the new `cv_parse_results` table is in cv-parser's own PostgreSQL schema, not api-gateway's Prisma schema. Flyway migration covers it.
- **Validation, logging, and failure behavior must remain boundary-focused.** ✅ — All boundary validation is at Gemini response intake (existing `GeminiResponseValidator`) and at event publish (annotated DTOs with Jakarta Validation).
- **Tests and TDD: Non-trivial work requires TDD.** ✅ — Three required test classes identified in spec. TDD gate applies in Phase 2+.

## Project Structure

### Documentation (this feature)

```text
specs/018-cv-parser-scoring-pipeline/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── scoring-contract.md
└── tasks.md             ← Phase 2+ input (generated separately)
```

### Source Code (repository root)

```text
cv-parser/
├── src/main/java/com/talentflow/cvparser/
│   ├── extractor/
│   ├── listener/
│   ├── parser/
│   ├── scoring/           ← NEW PACKAGE: ScoringService, CandidateScoringService
│   ├── repository/
│   ├── shared/
│   │   ├── config/
│   │   ├── dto/
│   │   ├── exception/
│   │   ├── util/
│   │   └── validation/
│   ├── storage/
│   └── usecase/
├── src/main/resources/
│   ├── db/migration/      ← NEW: Flyway migrations
│   ├── logback-spring.xml ← NEW: JSON logging config
│   ├── application.yml
│   └── cv-extraction-schema.json
├── src/test/java/com/talentflow/cvparser/
│   ├── scoring/           ← NEW test package
│   ├── extractor/
│   ├── listener/
│   ├── parser/
│   ├── repository/
│   ├── shared/
│   ├── storage/
│   └── usecase/
└── pom.xml
```

**Structure Decision**: The feature is owned entirely by `cv-parser/`. No api-gateway or notification changes. A new `scoring/` package is created alongside existing `extractor/` and `parser/`.

### Ownership Check

- ✅ Parsing, OCR, extraction, queue consumption → `cv-parser/` (current location)
- ✅ Queue production (cv.parsed, cv.failed) → `cv-parser/` (already publishes from here)
- ✅ Database persistence → `cv-parser/` (new Flyway + JPA, cv-parser's own schema)
- ✅ Metrics exposure → `cv-parser/` (Actuator already configured, add Micrometer registry)
- ❌ No changes to HTTP, auth, Prisma schema, email, or WebSocket → excluded

## Delivery Phases

### Phase 0: Discovery And Contract Check (research.md)

- Confirm the owning service boundary: cv-parser only.
- Resolve NEEDS CLARIFICATION items:
  1. **How to obtain `jobDescription` for scoring** — current `CvUploadedEvent` lacks this field.
  2. **Flyway + JPA dependency setup** — pom.xml has `spring-boot-starter-data-jpa` but no Flyway.
  3. **Logstash JSON logging configuration** — which encoder to add (logstash-logback-encoder vs native logback).
  4. **Micrometer Prometheus dependency** — Actuator endpoint enabled in YAML but `micrometer-registry-prometheus` not in pom.xml.
  5. **MDCTaskDecorator pattern** — best approach for existing ThreadPoolTaskExecutor beans.
  6. **Exception classification matrix** — which existing exceptions are retryable vs non-retryable.
  7. **Post-commit publish pattern** — `@TransactionalEventListener` vs manual `TransactionSynchronization` vs `afterCommit`.
  8. **Gemini scoring endpoint** — reuse `GeminiLlmClient` or create a dedicated scoring client.
  9. **Idempotency check** — is a row in `cv_parse_results` with SUCCESS status a hard skip, or can re-processing overwrite?
  10. **cv-parser database** — does it reuse the api-gateway Postgres or have its own instance? (Spec says dedicated, confirm.)

### Phase 1: Design And Data Shape (data-model.md, contracts/, quickstart.md)

- Capture the `CvParseResult` entity, `CvParseResultRepository` JPA interface, and `ScoringResult` value object.
- Define `CandidateScoringUseCase` contract (interface + impl).
- Define Gemini scoring prompt + response validator contract.
- Define exception classification rules.
- Define new env vars / config properties.
- Define event payload contracts (verified against existing DTOs).
- Update agent context file to reference the plan.

### Phase 2: Implementation By Service

- **scoring/ package**:
  - `GeminiScoringClient` — calls Gemini via existing WebClient/Resilience4j with scoring-specific prompt
  - `GeminiScoreResponseValidator` — validates score is 0–100 integer
  - `CandidateScoringUseCase` + `CandidateScoringService` — orchestrates scoring, fallback, SKIPPED logic
- **repository/ package**:
  - `CvParseResult` JPA entity + `CvParseResultJpaRepository` (Spring Data)
  - Replace `NoOpCvParseResultRepository` with real JPA-backed impl
- **Flyway**:
  - `V1__create_cv_parse_results.sql`
- **usecase/**:
  - Refactor `CvParsingUseCaseImpl` to: add scoring step, post-commit publish, idempotency check, exception classification
- **listener/**:
  - Refactor `CvParserListener` to: classify exceptions, NACK with requeue for transient, NACK to DLQ for permanent
- **shared/config/**:
  - Add `MDCTaskDecorator` to `parsingExecutor`, `llmExecutor`, `ocrPageExecutor`
  - Add `ScoringConfig` properties class
- **shared/dto/**:
  - Add `jobDescription` to `CvUploadedEvent` (or document how it's fetched)
- **shared/exception/**:
  - Systematic retryable/non-retryable classification across all exception types
- **Observability**:
  - Add `micrometer-registry-prometheus` to pom.xml
  - Add Prometheus metrics in `CandidateScoringService`, `CvParsingUseCaseImpl`, `TesseractOcrImpl`
  - Add `logstash-logback-encoder` to pom.xml
  - Configure `logback-spring.xml` for JSON output + correlation ID via MDC
- **PII masking**:
  - Wire `PiiRedactor` into logging statements (email masking)

### Phase 3: Verification And Hardening

- Test classes (TDD):
  - `CandidateScoringUseCaseTest` — score range validation, fallback, SKIPPED path
  - `GeminiScoringClientTest` — valid response, invalid JSON, score out of range, API timeout
  - `CvParsingOrchestratorTest` — success, failure, transaction isolation
- Run `cd cv-parser && mvn test` — all tests pass with ≥80% line coverage for new classes
- Verify `logback-spring.xml` produces valid JSON with `correlationId` through MDC
- Verify `/actuator/prometheus` exposes counters

## Validation Commands

- CV Parser: `cd cv-parser && mvn test` (unit + integration)
- CV Parser: `cd cv-parser && mvn compile` (build)
- Coverage: `cd cv-parser && mvn verify` (JaCoCo report at `target/site/jacoco/index.html`)

## Local Verification Strategy

- Run the narrowest unit test first (`mvn test -Dtest=CandidateScoringUseCaseTest`)
- Run all cv-parser tests before any cross-service validation
- Metrics: start the service locally with `docker-compose up -d` and hit `curl localhost:8081/actuator/prometheus`
- No `api-gateway` or `notification` verification needed

## Complexity Tracking

| Violation                       | Why Needed | Simpler Alternative Rejected Because        |
| ------------------------------- | ---------- | ------------------------------------------- |
| New PostgreSQL table in cv-parser schema | cv-parser currently has no persistence — `NoOpCvParseResultRepository` logs and discards results. Without a table, scores and parse results are lost on restart, violating SC-002. | Config-only persistence (file or in-memory) would not survive restart and would lack queryability for audit. |
| New Flyway migration in cv-parser | cv-parser has no migration infrastructure. Spring Boot + Flyway is the standard pattern used across the org and matches the existing `ddl-auto: validate` JPA config. | Manual schema management would drift. |
| New `jobDescription` field needed in incoming event | Gemini scoring requires job requirements text to compute the match score. The current `CvUploadedEvent` only carries `jobId`, not the description. | Fetching from the jobs service introduces a synchronous HTTP dependency in an async worker, increasing latency and failure surface. Passing it in the event is simpler and follows the existing pattern where all needed data is in the message payload. |
