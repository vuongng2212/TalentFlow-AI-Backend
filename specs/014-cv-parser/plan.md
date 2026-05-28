# Implementation Plan: CV Parser Worker

**Branch**: `014-cv-parser` | **Date**: 2026-05-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/014-cv-parser/spec.md`

## Summary

Reverse-engineer the existing CV Parser runtime into a migrated Spec Kit artifact set. The feature already exists in `cv-parser/src/main/java/com/talentflow/cvparser/**`; the plan captures queue consumption, secure S3 download, MIME-aware parsing, OCR fallback, hybrid extraction, and event publication on the shared RabbitMQ exchange.

## Technical Context

**Primary Runtime**: cv-parser  
**Language/Version**: Java 17+ / Spring Boot 3.x  
**Primary Dependencies**: Spring AMQP, Spring Boot, Apache Tika, Apache PDFBox, Apache POI, Tess4J, AWS SDK S3, Resilience4j, Lombok, JUnit  
**Storage**: S3-compatible object storage for input files; PostgreSQL is not yet used for a persisted parse-result implementation  
**Testing**: `cd cv-parser && ./mvnw test`, focused parser and use-case tests, `./mvnw test -DskipITs` if needed  
**Target Platform**: Local development and Linux containers  
**Project Type**: Spring Boot worker service  
**Performance Goals**: Keep queue acknowledgment bounded by parsing, OCR, and extraction timeouts already encoded in the worker  
**Constraints**: Preserve the `bucket + fileKey` contract, security limits, dead-letter handling, and the current no-op repository behavior  
**Scale/Scope**: One RabbitMQ worker with parser, OCR, extraction, storage, and repository placeholder; no schema migration required

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- Runtime code and current Spec Kit artifacts are authoritative.
- Frozen legacy sources are context only and must not be indexed as active requirements.
- Service boundaries must remain explicit.
- Cross-service changes require producer and consumer alignment.
- Security limits for file keys, MIME types, S3 endpoints, and payload sizes must remain boundary-focused.
- Do not claim parse-result persistence or scoring sophistication that the runtime does not implement.

## Project Structure

### Documentation (this feature)

```text
specs/014-cv-parser/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
cv-parser/
├── src/
│   ├── main/java/com/talentflow/cvparser/
│   │   ├── listener/
│   │   ├── usecase/
│   │   ├── extractor/
│   │   ├── parser/
│   │   ├── storage/
│   │   ├── repository/
│   │   └── shared/
│   └── test/java/com/talentflow/cvparser/
├── pom.xml
└── mvnw
```

**Structure Decision**: The CV Parser owns the feature entirely as an asynchronous RabbitMQ worker. The listener orchestrates the pipeline, the parser and OCR layers own document-to-text conversion, the extractor layer owns hybrid structured-data extraction, and the repository remains a placeholder in the current runtime.

## Delivery Phases

### Phase 0: Discovery And Contract Check

- Confirm the listener consumes `cv.uploaded` messages with manual acknowledgment.
- Confirm the worker routes file downloads through the secure S3 storage adapter.
- Confirm the pipeline publishes `cv.parsed` on success and `cv.failed` on failure.

### Phase 1: Design And Data Shape

- Capture the inbound and outbound event payloads and their validation rules.
- Capture the parser routing rules for PDF and DOCX, including OCR fallback thresholds.
- Capture the hybrid extraction behavior, the placeholder score, and the no-op repository contract.

### Phase 2: Implementation By Service

- Keep all runtime code in `cv-parser/src/main/java/com/talentflow/cvparser/` and the shared RabbitMQ exchange.
- Preserve the existing security checks, timeout handling, and cleanup behavior.
- Avoid any schema changes because parse-result persistence is not yet implemented.

### Phase 3: Verification And Hardening

- Run the focused parser and use-case tests first.
- Verify queue ack/nack behavior, temp-file deletion, and failure-event publication paths.
- Confirm the build still passes after the worker components are loaded.

## Validation Commands

- CV Parser slice: `cd cv-parser && ./mvnw test`
- CV Parser build: `cd cv-parser && ./mvnw -q -DskipTests package`
- Focused tests if needed: `cd cv-parser && ./mvnw -Dtest=ParserFactoryTest,CvParsingUseCaseImplTest test`

## Complexity Tracking

Use this table only if the plan needs a justified exception to the normal brownfield guardrails.

| Violation | Why Needed                                                 | Simpler Alternative Rejected Because                                 |
| --------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| None      | No exception is required for this migrated CV Parser slice | The existing runtime implementation already fits the worker boundary |
