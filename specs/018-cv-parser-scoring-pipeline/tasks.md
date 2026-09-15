---
description: "Task list for CV Parser Scoring Pipeline (Phase 4 & 5)"
---

# Tasks: CV Parser Scoring Pipeline (Phase 4 & 5)

**Input**: Design documents from `specs/018-cv-parser-scoring-pipeline/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/scoring-contract.md, quickstart.md

**Organization**: Tasks are grouped by service boundary and then by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on another task
- **[Story]**: Which user story this task belongs to, such as US1, US2, or US3
- Always include exact file paths in the description

## Path Conventions

- CV Parser: `cv-parser/src/main/java/com/talentflow/cvparser/`, `cv-parser/src/test/java/com/talentflow/cvparser/`
- CV Parser resources: `cv-parser/src/main/resources/`, `cv-parser/src/main/resources/db/migration/`
- Shared planning docs: `specs/018-cv-parser-scoring-pipeline/`

## Service Routing

- All changes are within `cv-parser/` — no api-gateway or notification changes.
- Queue-consuming, parsing, scoring, persistence, metrics, and logging work are all cv-parser owned.

---

## Phase 1: Setup And Contract Lock

**Purpose**: Confirm runtime ownership, lock the contract surface, and create only the files required for the feature slice.

- [X] T001 Review the cv-parser runtime entrypoint and affected service files: `CvParserListener`, `CvParsingUseCaseImpl`, `NoOpCvParseResultRepository`, `CvUploadedEvent`, `CvParsedEvent`, `CvFailedEvent`, `ThreadPoolConfig`, `application.yml`
- [X] T002 [P] Update contract notes in `specs/018-cv-parser-scoring-pipeline/contracts/scoring-contract.md` — confirm `cv.parsed` and `cv.failed` event payload contracts are accurate for the scoring pipeline
- [X] T003 [P] Add scoring-specific configuration keys to `cv-parser/src/main/resources/application.yml` (flyway schema, jpa default_schema, prometheus exposure, logback profile)

---

## Phase 2: Foundational Work

**Purpose**: Build the shared prerequisites that block all user stories for this feature.

- [X] T004 Add Flyway, Micrometer Prometheus registry, and Logstash-logback-encoder dependencies to `cv-parser/pom.xml`:
  - `org.flywaydb:flyway-core` (Spring-managed version)
  - `org.flywaydb:flyway-database-postgresql` (Spring-managed version)
  - `io.micrometer:micrometer-registry-prometheus` (Spring-managed version)
  - `net.logstash.logback:logstash-logback-encoder` (latest stable)
- [X] T005 [P] Create Flyway migration `cv-parser/src/main/resources/db/migration/V1__create_cv_parse_results.sql` with `cv_parser` schema, `cv_parse_results` table, CHECK constraints, UNIQUE constraint on `application_id`, and indexes
- [X] T006 [P] Update `cv-parser/src/main/resources/application.yml` with Flyway config (`spring.flyway.schemas: cv_parser`, `spring.jpa.properties.hibernate.default_schema: cv_parser`) and `cv-parser/src/test/resources/application-test.yml` with `spring.flyway.enabled: false`
- [X] T007 [P] Create `MdcTaskDecorator` in `cv-parser/src/main/java/com/talentflow/cvparser/shared/util/MdcTaskDecorator.java` implementing `TaskDecorator` with MDC capture/restore/clear; wire into `parsingExecutor`, `ocrExecutor`, `ocrPageExecutor`, `llmExecutor` beans in `ThreadPoolConfig`
- [X] T008 [P] Add `jobDescription` (nullable `String`) field to `CvUploadedEvent` DTO in `cv-parser/src/main/java/com/talentflow/cvparser/shared/dto/CvUploadedEvent.java`

**Checkpoint**: The service boundary is ready and user story work can begin.

---

## Phase 3: User Story 1 — AI Scoring (P1)

**Goal**: Recruiter receives a real AI score (0–100) and reasoning after CV upload — not a hardcoded zero.

**Independent Test**: Publish a mock `cv.upload.requested` AMQP message with a known `applicationId` and `jobDescription`, consume the resulting `cv.parsed` event, and assert that `aiScore` is an integer in [1, 100] and `scoringReasoning` is a non-empty string.

### Tests for User Story 1 (TDD — RED before GREEN)

- [X] T009 [P] [US1] Write `GeminiScoreResponseValidatorTest` in `cv-parser/src/test/java/com/talentflow/cvparser/scoring/GeminiScoreResponseValidatorTest.java` — cover valid score, score out of range, non-integer response, null response. Run and confirm RED.
- [X] T010 [P] [US1] Write `CandidateScoringServiceTest` in `cv-parser/src/test/java/com/talentflow/cvparser/scoring/CandidateScoringServiceTest.java` — cover success path, Gemini exception triggers FALLBACK, empty jobDescription triggers SKIPPED, score out-of-range triggers FALLBACK. Run and confirm RED.

### Implementation for User Story 1

- [X] T011 [P] [US1] Create `ScoringResult` value object in `cv-parser/src/main/java/com/talentflow/cvparser/scoring/ScoringResult.java` with `aiScore`, `scoringReasoning`, `scoringStatus` fields and builder
- [X] T012 [P] [US1] Create `GeminiScoreResponseValidator` in `cv-parser/src/main/java/com/talentflow/cvparser/scoring/GeminiScoreResponseValidator.java` — validates score string is an integer in [0, 100]; throws `ScoringException` on invalid
- [X] T013 [P] [US1] Create `CandidateScoringUseCase` interface in `cv-parser/src/main/java/com/talentflow/cvparser/scoring/CandidateScoringUseCase.java` with `ScoringResult score(CandidateProfile profile, String jobDescription)` method
- [X] T014 [US1] Implement `CandidateScoringService` in `cv-parser/src/main/java/com/talentflow/cvparser/scoring/CandidateScoringService.java` — calls Gemini via existing `WebClient` + `geminiApi` Resilience4j instance, validates response, applies FALLBACK/SKIPPED logic, never throws
- [X] T015 [US1] Create `ScoringConfig` configuration properties class in `cv-parser/src/main/java/com/talentflow/cvparser/shared/config/ScoringConfig.java` with `@ConfigurationProperties(prefix = "llm.scoring")` holding `timeout-seconds`, `fallback-score`, `fallback-reason`
- [X] T016 [US1] Wire scoring step into `CvParsingUseCaseImpl` in `cv-parser/src/main/java/com/talentflow/cvparser/usecase/CvParsingUseCaseImpl.java` — call `CandidateScoringUseCase.score()` after extraction, store result for event publishing

**Checkpoint**: User Story 1 should now be fully functional and independently testable.

---

## Phase 4: User Story 2 — Durable Persistence (P2)

**Goal**: Parse results (score, profile, status) are stored in `cv_parse_results` table for audit, correlation, and restart survival.

**Independent Test**: After processing a valid CV, query `cv_parser.cv_parse_results` for the matching `applicationId` and assert that `status`, `aiScore`, `parsedData`, and `createdAt` are fully populated.

### Tests for User Story 2

- [X] T017 [P] [US2] Write `CvParseResultJpaRepositoryTest` in `cv-parser/src/test/java/com/talentflow/cvparser/repository/CvParseResultJpaRepositoryTest.java` — cover save, find by applicationId, exists-by-application-and-status. Confirm RED.
- [X] T018 [US2] Write `CvParsingOrchestratorIntegrationTest` in `cv-parser/src/test/java/com/talentflow/cvparser/usecase/CvParsingOrchestratorIntegrationTest.java` — cover success path (DB write + post-commit publish), failure path (CvFailedEvent before NACK), transaction isolation. Confirm RED.

### Implementation for User Story 2

- [X] T019 [P] [US2] Create `ParseStatus` enum in `cv-parser/src/main/java/com/talentflow/cvparser/shared/dto/ParseStatus.java` with values `SUCCESS`, `PARTIAL`, `FAILED`
- [X] T020 [P] [US2] Create `ScoringStatus` enum in `cv-parser/src/main/java/com/talentflow/cvparser/shared/dto/ScoringStatus.java` with values `SUCCESS`, `FALLBACK`, `SKIPPED`
- [X] T021 [P] [US2] Create `CvParseResultEntity` JPA entity in `cv-parser/src/main/java/com/talentflow/cvparser/repository/CvParseResultEntity.java` — maps to `cv_parser.cv_parse_results` table with all columns and lifecycle callbacks
- [X] T022 [P] [US2] Create `CvParseResultJpaRepository` in `cv-parser/src/main/java/com/talentflow/cvparser/repository/CvParseResultJpaRepository.java` extending `JpaRepository` with `findByApplicationId` and `existsByApplicationIdAndStatus` queries
- [X] T023 [US2] Replace `NoOpCvParseResultRepository` reference with `CvParseResultJpaRepository` in `CvParsingUseCaseImpl`; add idempotency check at orchestrator start (skip if `status = SUCCESS` already exists); implement post-commit publish via `TransactionSynchronizationManager.registerSynchronization()`

**Checkpoint**: User Story 2 should now be fully functional alongside User Story 1.

---

## Phase 5: User Story 3 — Failure Notification (P3)

**Goal**: When CV processing fails, the system publishes `cv.failed` with correct `retryable` and `failedAt` fields, routing non-retryable errors to DLQ immediately and transient errors after max retries.

**Independent Test**: Submit an unsupported file format, consume the resulting `cv.failed` event, and assert that `retryable = false`, `failedAt` is a valid ISO-8601 timestamp, and `errorCode` matches the expected value.

### Tests for User Story 3

- [X] T024 [P] [US3] Write `CvParserListenerExceptionTest` in `cv-parser/src/test/java/com/talentflow/cvparser/listener/CvParserListenerExceptionTest.java` — cover non-retryable exception → DLQ, retryable exception → requeue, maxRetries exhaustion → DLQ + CvFailedEvent. Confirm RED.

### Implementation for User Story 3

- [X] T025 [P] [US3] Add `retryable` classification to all existing exception classes in `cv-parser/src/main/java/com/talentflow/cvparser/shared/exception/` per exception matrix in research.md (R-06) — ensure `isRetryable()` returns correct value for each exception constructor path
- [X] T026 [P] [US3] Populate `retryable` and `failedAt` fields in `CvFailedEvent` DTO in `cv-parser/src/main/java/com/talentflow/cvparser/shared/dto/CvFailedEvent.java` when constructing failure events
- [X] T027 [US3] Add `maxRetries` configuration property to `cv-parser/src/main/resources/application.yml` (default: 3); update `CvParserListener` in `cv-parser/src/main/java/com/talentflow/cvparser/listener/CvParserListener.java` to classify exceptions via `isRetryable()`, NACK with `requeue = true` for retryable within limit, NACK to DLQ for non-retryable or exhausted retries, publish `CvFailedEvent` on final failure

**Checkpoint**: User Story 3 should now be fully functional alongside User Stories 1 and 2.

---

## Phase 6: User Story 4 — Prometheus Metrics (P4)

**Goal**: Operations can query `/actuator/prometheus` to see parse throughput, error rates, Gemini API call outcomes, and OCR page counts.

**Independent Test**: After processing one successful and one failed CV, scrape `/actuator/prometheus` and assert that `cv_parsing_duration_seconds`, `gemini_api_calls_total`, and `cv_ocr_pages_total` counters/histograms are present with correct tag labels.

### Tests for User Story 4

- [X] T028 [P] [US4] Write meter-binding tests in `cv-parser/src/test/java/com/talentflow/cvparser/scoring/ScoringMetricsTest.java` — verify `gemini_api_calls_total` is incremented with correct tags on success, fallback, and error. Confirm RED.

### Implementation for User Story 4

- [X] T029 [P] [US4] Add `cv_parsing_duration_seconds` histogram timer and `cv_parsing_total` counter in `CvParsingUseCaseImpl` — tag with `status` (success/partial/failed)
- [X] T030 [P] [US4] Add `gemini_api_calls_total` counter in `CandidateScoringService` — tag with `type=scoring` and `outcome` (success/fallback/error)
- [X] T031 [P] [US4] Add `cv_ocr_pages_total` counter in `TesseractOcrImpl` — tag with `lang` (eng/vie/other)
- [X] T032 [US4] Verify `management.endpoints.web.exposure.include` in `application.yml` already includes `prometheus`; confirm `PrometheusMeterRegistry` auto-configures with the added dependency

**Checkpoint**: User Story 4 should now be fully operational.

---

## Phase 7: User Story 5 — Structured JSON Logging With Correlation ID (P5)

**Goal**: Every log line for a single CV processing request shares a `correlationId` (the `applicationId`) across all thread pool boundaries, in Logstash-compatible JSON format, with PII masked.

**Independent Test**: Process one CV, capture all log output, parse it as JSON, and assert that every log line contains a `correlationId` field matching the `applicationId` from the request.

### Tests for User Story 5

- [X] T033 [P] [US5] Write `MdcPropagationTest` in `cv-parser/src/test/java/com/talentflow/cvparser/shared/util/MdcPropagationTest.java` — verify MDC correlationId is set at listener entry, propagated to thread pool executors, and cleared in finally block. Confirm RED.

### Implementation for User Story 5

- [X] T034 [P] [US5] Create `cv-parser/src/main/resources/logback-spring.xml` with `LogstashEncoder` for JSON output (non-dev profiles) and classic console pattern (dev profile); include `correlationId` from MDC
- [X] T035 [P] [US5] Set `MDC.put("correlationId", applicationId)` in `CvParserListener.onMessage()` entry, clear in `finally` block — ensures each message gets its own correlation ID
- [X] T036 [P] [US5] Wire `PiiRedactor` (existing utility) into `CvParsingUseCaseImpl` log statements to mask email addresses (`***@domain.tld`) and suppress raw CV text and phone numbers from log output
- [X] T037 [US5] Update `logback-spring.xml` profile configuration to ensure dev profile uses human-readable console and non-dev uses JSON; verify `correlationId` key is included in Logstash encoder

**Checkpoint**: User Story 5 should now be fully functional.

---

## Phase 8: Cross-Cutting Validation

**Purpose**: Work that touches multiple stories or service boundaries.

- [X] T038 [P] Update documentation in `specs/018-cv-parser-scoring-pipeline/` — finalize any contract notes or migration notes in `contracts/scoring-contract.md`
- [X] T039 [P] Run all cv-parser unit tests and verify ≥80% line coverage for new scoring classes: `cd cv-parser && mvn test`
- [X] T040 [P] Add observability and failure-path hardening: verify all exception paths log correlation ID, verify Prometheus endpoint responds, verify no PII leaks in log output
- [X] T041 Validate backward compatibility: verify existing `cv.uploaded` messages without `jobDescription` deserialize correctly (scoring SKIPPED), verify `cv.parsed`/`cv.failed` event payloads are additive-only relative to existing `api-gateway` consumer

### Real Commands To Use

- CV Parser: `cd cv-parser && mvn test`, `mvn compile`, `mvn verify`
- Metrics: `curl http://localhost:8081/actuator/prometheus`
- DB query: `psql -h localhost -p 5433 -U postgres -d talentflow_dev -c "SELECT ... FROM cv_parser.cv_parse_results;"`
- RabbitMQ: Management UI at http://localhost:15672

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) can start immediately.
- Foundational work (Phase 2) blocks all user stories.
- User stories proceed in priority order once the foundation is ready:
  - US1 (P1) — AI Scoring: Depends on MdcTaskDecorator, scoring config, pom.xml updates
  - US2 (P2) — Persistence: Depends on Flyway migration, pom.xml updates
  - US3 (P3) — Failure Notification: Depends on US2 (persistence during failure path), exception classes
  - US4 (P4) — Metrics: Depends on pom.xml (micrometer dependency), US1 scoring service
  - US5 (P5) — Structured Logging: Depends on pom.xml (logstash dep), MdcTaskDecorator
- Cross-cutting validation (Phase 8) comes after all user stories.

### Story Completion Order

```
Phase 1 (Setup)
  └── Phase 2 (Foundational)
       ├── Phase 3 [US1] AI Scoring
       │     └── Phase 6 [US4] Metrics (counters on scoring path)
       ├── Phase 4 [US2] Persistence
       │     └── Phase 5 [US3] Failure Notification (depends on DB persistence in failure path)
       └── Phase 7 [US5] Structured Logging
             └── (all phases benefit from logging)
```

### Parallel Execution Examples Per Story

**Phase 2 tasks** (all [P]):
```
T005 (Flyway migration)   T006 (app config)   T007 (MdcTaskDecorator)   T008 (jobDescription)
         │                       │                       │                       │
         └───────────────────────┬───────────────────────┴───────────────────────┘
                                 ▼
                           T004 (pom.xml)
```

**User Story 1 parallel work**:
```
T009 (validator test) ──── T011 (ScoringResult) ──── T012 (Validator)
T010 (service test)  ──── T013 (interface)    ──── T014 (Service)
                                              ──── T015 (ScoringConfig)
                                              ──── T016 (wire into usecase)
```

**User Story 2 parallel work**:
```
T019 (ParseStatus enum) ──── T021 (Entity)
T020 (ScoringStatus enu)─── T022 (Repository) ──── T023 (wire + idempotency + post-commit)
```

### Service-Specific Validation Commands

- CV Parser: `cd cv-parser && mvn test`, `mvn compile`, `mvn verify`

### Implementation Notes

- All changes within `cv-parser/` only — no `api-gateway` or `notification` files.
- Keep tests close to the touched boundary (same package in `src/test/java/`).
- Follow TDD strictly: RED test first, then GREEN implementation, then REFACTOR.
- Prefer producer/consumer checks for queue changes.
- Prefer schema and migration alignment for persistence changes.
- Avoid cross-story coupling unless the contract truly requires it.
- Reuse existing `geminiApi` Resilience4j instance — no new circuit breaker or rate limiter config.

## Notes

- [P] tasks can run in parallel because they touch different files with no dependency.
- Each user story is independently completable and testable according to its Independent Test criteria.
- Verify tests fail before implementing when tests are part of the feature scope (TDD).
- Stop at a checkpoint to validate the slice before broadening scope.
