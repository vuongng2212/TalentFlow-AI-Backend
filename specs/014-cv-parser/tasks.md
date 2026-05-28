# Tasks: CV Parser Worker

**Input**: Design documents from `/specs/014-cv-parser/`
**Prerequisites**: plan.md, spec.md

**Organization**: Tasks are grouped by service boundary and then by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or has no dependency on another task
- **[Story]**: Which user story the task belongs to, such as US1, US2, or US3
- Always include exact file paths in the description

## Path Conventions

- CV Parser: `cv-parser/src/main/java/com/talentflow/cvparser/`, `cv-parser/src/test/java/com/talentflow/cvparser/`
- Shared planning docs: `specs/014-cv-parser/`

## Phase 1: Setup And Contract Lock

**Purpose**: Confirm runtime ownership, lock the contract surface, and record the existing worker behavior.

- [x] T001 Review the current runtime entrypoint and affected CV Parser files for the feature in `cv-parser/src/main/java/com/talentflow/cvparser/CvParserApplication.java`, `cv-parser/src/main/java/com/talentflow/cvparser/listener/CvParserListener.java`, and `cv-parser/src/main/java/com/talentflow/cvparser/**`
- [x] T002 [P] Capture the queue and event contract in `specs/014-cv-parser/spec.md` from `cv-parser/src/main/java/com/talentflow/cvparser/shared/dto/*.java`, `cv-parser/src/main/java/com/talentflow/cvparser/listener/CvParserListener.java`, and `cv-parser/src/main/java/com/talentflow/cvparser/usecase/CvParsingUseCaseImpl.java`
- [x] T003 [P] Record validation, storage, parsing, extraction, and failure requirements in `cv-parser/src/main/java/com/talentflow/cvparser/shared/**/*.java` and the worker startup validation layer

---

## Phase 2: Foundational Work

**Purpose**: Build the shared prerequisites that block all user stories for this feature.

- [x] T004 Wire `cv-parser/src/main/java/com/talentflow/cvparser/shared/config/RabbitMqConfig.java` with the worker queue, DLQ, and shared exchange
- [x] T005 [P] Define the inbound and outbound event DTOs in `cv-parser/src/main/java/com/talentflow/cvparser/shared/dto/CvUploadedEvent.java`, `CvParsedEvent.java`, `CvFailedEvent.java`, and `ParsedCvData.java`
- [x] T006 [P] Establish file, bucket, and storage guardrails in `cv-parser/src/main/java/com/talentflow/cvparser/shared/util/FileValidator.java` and `cv-parser/src/main/java/com/talentflow/cvparser/storage/S3StorageService.java`
- [x] T007 Keep the minimum parsing and extraction wiring in `cv-parser/src/main/java/com/talentflow/cvparser/parser/*.java`, `cv-parser/src/main/java/com/talentflow/cvparser/extractor/*.java`, and `cv-parser/src/main/java/com/talentflow/cvparser/usecase/*.java`

**Checkpoint**: The worker boundary is wired and user story work can be validated independently.

---

## Phase 3: User Story 1 - Process an Uploaded CV Event Safely (Priority: P1)

**Goal**: Receive an uploaded CV event, validate it, and parse the file safely.

**Independent Test**: A valid `CvUploadedEvent` is consumed, the file is downloaded from S3 using the configured storage bucket plus the event fileKey, and the message is acknowledged on success.

### Tests for User Story 1

- [x] [P] [US1] Cover storage guardrails in `cv-parser/src/test/java/com/talentflow/cvparser/storage/S3StorageServiceTest.java`
- [x] [P] [US1] Cover parser routing and OCR timeout behavior in `cv-parser/src/test/java/com/talentflow/cvparser/parser/ParserFactoryTest.java` and `cv-parser/src/test/java/com/talentflow/cvparser/parser/TesseractOcrImplTest.java`
- [x] [P] [US1] Cover safe pipeline orchestration in `cv-parser/src/test/java/com/talentflow/cvparser/usecase/CvParsingUseCaseImplTest.java`

### Implementation for User Story 1

- [x] [US1] Implement queue consumption and manual acknowledgment in `cv-parser/src/main/java/com/talentflow/cvparser/listener/CvParserListener.java`
- [x] [US1] Implement secure S3 download and temp-file cleanup in `cv-parser/src/main/java/com/talentflow/cvparser/storage/S3StorageService.java`
- [x] [US1] Preserve file-key, MIME, and size validation in `cv-parser/src/main/java/com/talentflow/cvparser/shared/util/FileValidator.java`
- [x] [US1] Preserve PDF/DOCX routing and OCR fallback in `cv-parser/src/main/java/com/talentflow/cvparser/parser/ParserFactory.java`, `PdfTextParser.java`, `DocxTextParser.java`, and `TesseractOcrImpl.java`

**Checkpoint**: Safe CV ingestion should now be fully functional and independently testable.

---

## Phase 4: User Story 2 - Extract and Publish Parsed CV Data (Priority: P2)

**Goal**: Convert raw CV text into structured profile data and publish the parsed event.

**Independent Test**: A parseable CV produces `CvParsedEvent` with mapped `ParsedCvData` after Gemini or rule-based extraction.

### Tests for User Story 2

- [x] [P] [US2] Cover extraction strategy behavior in `cv-parser/src/test/java/com/talentflow/cvparser/usecase/*` if additional tests are present
- [x] [P] [US2] Cover parser and OCR security limits in `cv-parser/src/test/java/com/talentflow/cvparser/parser/PdfTextParserSecurityLimitTest.java` and `DocxTextParserSecurityLimitTest.java`

### Implementation for User Story 2

- [x] [US2] Implement hybrid extraction in `cv-parser/src/main/java/com/talentflow/cvparser/usecase/DataExtractionUseCaseImpl.java`
- [x] [US2] Implement Gemini extraction and rule-based fallback in `cv-parser/src/main/java/com/talentflow/cvparser/extractor/GeminiExtractorService.java` and `RuleBasedExtractorService.java`
- [x] [US2] Preserve parsed-event publication and profile mapping in `cv-parser/src/main/java/com/talentflow/cvparser/usecase/CvParsingUseCaseImpl.java`
- [x] [US2] Preserve parse-result repository hook in `cv-parser/src/main/java/com/talentflow/cvparser/repository/CvParseResultRepository.java` and `NoOpCvParseResultRepository.java`

**Checkpoint**: Parsed CV publication should now be independently testable.

---

## Phase 5: User Story 3 - Publish Deterministic Failures (Priority: P3)

**Goal**: Convert pipeline failures into a failure event and dead-letter outcome.

**Independent Test**: A failing pipeline publishes `CvFailedEvent` and nacks the message to the DLQ.

### Tests for User Story 3

- [x] [P] [US3] Cover worker failure paths in `cv-parser/src/test/java/com/talentflow/cvparser/usecase/CvParsingUseCaseImplTest.java`
- [x] [P] [US3] Cover startup validation and config failure behavior in `cv-parser/src/main/java/com/talentflow/cvparser/shared/validation/StartupValidator.java`

### Implementation for User Story 3

- [x] [US3] Implement failure-event publication in `cv-parser/src/main/java/com/talentflow/cvparser/listener/CvParserListener.java`
- [x] [US3] Implement DLQ nacking behavior in `cv-parser/src/main/java/com/talentflow/cvparser/listener/CvParserListener.java`
- [x] [US3] Preserve fail-fast startup validation in `cv-parser/src/main/java/com/talentflow/cvparser/shared/validation/StartupValidator.java`

**Checkpoint**: Failure handling should now be independently testable.

---

## Phase 6: Cross-Cutting Validation

**Purpose**: Work that touches multiple stories or service boundaries.

- [x] T024 [P] Update the migrated documentation in `specs/014-cv-parser/spec.md`, `specs/014-cv-parser/plan.md`, and `specs/014-cv-parser/tasks.md`
- [x] T025 [P] Run or update the owning service tests using the real worker commands in `cv-parser/pom.xml`
- [x] T026 [P] Preserve observability and failure-path behavior in `cv-parser/src/main/java/com/talentflow/cvparser/listener/CvParserListener.java`, `cv-parser/src/main/java/com/talentflow/cvparser/usecase/CvParsingUseCaseImpl.java`, and `cv-parser/src/main/java/com/talentflow/cvparser/storage/S3StorageService.java`
- [x] T027 Validate backward compatibility for the existing queue names, routing keys, DTO field names, and response shape in `cv-parser/src/main/java/com/talentflow/cvparser/**`

## Gaps Found

- The parse-result repository is still a no-op placeholder, so the worker logs persistence but does not actually store parsed CV output.
- The listener does not yet enforce full Rabbit payload validation at the queue boundary, so the DTO contract is documented but not actively enforced in runtime.
- There is no dedicated listener integration test that drives the full RabbitMQ consumer path end-to-end; current coverage is concentrated in parser, storage, extraction, and use-case unit tests.
- The `CvParsedEvent` currently publishes a placeholder `aiScore` of `0`, so downstream consumers should not treat the score as a real ranking signal yet.
- The current worker resolves the S3 bucket from configuration instead of the event payload, so the `bucket` field in `CvUploadedEvent` is documented but not yet consumed by the runtime.

## Dependencies & Execution Order

### Phase Dependencies

- Setup and contract lock can start immediately.
- Foundational work blocks all user stories.
- User stories can proceed in priority order once the foundation is ready.
- Cross-cutting validation comes after the story slices that it depends on.

### Service-Specific Validation Commands

- CV Parser: `cd cv-parser && ./mvnw test`, `cd cv-parser && ./mvnw -q -DskipTests package`, `cd cv-parser && ./mvnw -Dtest=ParserFactoryTest,CvParsingUseCaseImplTest test`

### Implementation Notes

- Keep tests close to the touched boundary.
- Prefer parser, storage, extraction, and use-case tests for worker workflows.
- Preserve the `bucket + fileKey` contract so the queue remains safe across services.
- Avoid cross-story coupling unless the contract truly requires it.

## Notes

- [P] tasks can run in parallel because they touch different files with no dependency.
- Each user story is independently completable and testable.
- This feature is already present in runtime code; the tasks document records what exists rather than a work queue to execute.
