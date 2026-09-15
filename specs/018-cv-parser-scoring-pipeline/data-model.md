# Data Model: CV Parse Results

**Feature**: `018-cv-parser-scoring-pipeline`  
**Date**: 2026-06-24  
**Status**: Design Phase

This document defines the entity, validation rules, state transitions, and persistence layer for the `cv_parse_results` table.

---

## Entity: CvParseResult

### Table

| Schema | Table |
|--------|-------|
| `cv_parser` | `cv_parse_results` |

### Columns

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK`, `DEFAULT gen_random_uuid()` | Primary key |
| `application_id` | `UUID` | `NOT NULL`, `UNIQUE` | Application this parse belongs to (unique = at-most-once semantics) |
| `candidate_id` | `UUID` | `NOT NULL` | Candidate who submitted the CV |
| `job_id` | `UUID` | `NOT NULL` | Job the application is for |
| `status` | `VARCHAR(16)` | `NOT NULL` | Parse outcome: `SUCCESS`, `PARTIAL`, `FAILED` |
| `ai_score` | `INTEGER` | nullable, check 0–100 | AI match score (null if scoring was skipped or failed before fallback) |
| `scoring_reasoning` | `TEXT` | nullable | Human-readable scoring explanation |
| `scoring_status` | `VARCHAR(16)` | nullable | `SUCCESS`, `FALLBACK`, `SKIPPED` — how the score was obtained |
| `parsed_data` | `JSONB` | nullable | Full extracted CV data (fullName, email, skills, experience, education) |
| `error_code` | `VARCHAR(64)` | nullable | Machine-readable error code (e.g., `UNSUPPORTED_FORMAT`, `EXTRACTION_FAILED`) |
| `error_message` | `TEXT` | nullable | Human-readable error message (PII-free) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | When processing completed |
| `updated_at` | `TIMESTAMPTZ` | nullable | When record was last modified (for future use) |

### SQL (Flyway V1)

```sql
-- V1__create_cv_parse_results.sql

CREATE SCHEMA IF NOT EXISTS cv_parser;

SET SCHEMA 'cv_parser';

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE cv_parse_results (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id    UUID        NOT NULL,
    candidate_id      UUID        NOT NULL,
    job_id            UUID        NOT NULL,
    status            VARCHAR(16) NOT NULL CHECK (status IN ('SUCCESS', 'PARTIAL', 'FAILED')),
    ai_score          INTEGER     CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100)),
    scoring_reasoning TEXT,
    scoring_status    VARCHAR(16) CHECK (scoring_status IS NULL OR scoring_status IN ('SUCCESS', 'FALLBACK', 'SKIPPED')),
    parsed_data       JSONB,
    error_code        VARCHAR(64),
    error_message     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ,

    CONSTRAINT uq_cv_parse_results_application UNIQUE (application_id)
);

CREATE INDEX idx_cv_parse_results_application_id ON cv_parse_results (application_id);
CREATE INDEX idx_cv_parse_results_candidate_id   ON cv_parse_results (candidate_id);
CREATE INDEX idx_cv_parse_results_status         ON cv_parse_results (status);

COMMENT ON TABLE  cv_parse_results IS 'One row per CV processing attempt. Unique on application_id for idempotency.';
COMMENT ON COLUMN cv_parse_results.ai_score IS 'AI match score 0-100. Null if scoring was skipped or failed irrecoverably.';
COMMENT ON COLUMN cv_parse_results.scoring_status IS 'How the score was produced: SUCCESS (Gemini), FALLBACK (50-unavailable), SKIPPED (no job description).';
COMMENT ON COLUMN cv_parse_results.parsed_data IS 'JSON containing fullName, email, skills, experience, education from extraction.';
```

---

## JPA Entity

```java
@Entity
@Table(name = "cv_parse_results", schema = "cv_parser")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CvParseResultEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "application_id", nullable = false, unique = true)
    private UUID applicationId;

    @Column(name = "candidate_id", nullable = false)
    private UUID candidateId;

    @Column(name = "job_id", nullable = false)
    private UUID jobId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private ParseStatus status;

    @Column(name = "ai_score")
    private Integer aiScore;

    @Column(name = "scoring_reasoning", columnDefinition = "TEXT")
    private String scoringReasoning;

    @Enumerated(EnumType.STRING)
    @Column(name = "scoring_status", length = 16)
    private ScoringStatus scoringStatus;

    @Column(name = "parsed_data", columnDefinition = "JSONB")
    private String parsedData;  // JSON string, serialized by Jackson

    @Column(name = "error_code", length = 64)
    private String errorCode;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
```

### Enums

```java
public enum ParseStatus {
    SUCCESS,
    PARTIAL,
    FAILED
}

public enum ScoringStatus {
    SUCCESS,
    FALLBACK,
    SKIPPED
}
```

### Repository

```java
public interface CvParseResultJpaRepository extends JpaRepository<CvParseResultEntity, UUID> {

    Optional<CvParseResultEntity> findByApplicationId(UUID applicationId);

    boolean existsByApplicationIdAndStatus(UUID applicationId, ParseStatus status);
}
```

---

## Value Objects

### ScoringResult

```java
/**
 * Immutable result of a Gemini scoring call.
 * Used within CandidateScoringService; not persisted directly.
 */
@Data
@Builder
@AllArgsConstructor
public class ScoringResult {
    private final int aiScore;              // 0-100
    private final String scoringReasoning;  // nullable
    private final ScoringStatus scoringStatus;
}
```

---

## Validation Rules

| Field | Rule | Check location |
|---|---|---|
| `aiScore` | Must be integer 0–100 if present | DB CHECK, `GeminiScoreResponseValidator`, `ScoringResult` builder |
| `status` | Must be one of `SUCCESS`, `PARTIAL`, `FAILED` | DB CHECK, JPA enum |
| `scoringStatus` | Must be one of `SUCCESS`, `FALLBACK`, `SKIPPED` | DB CHECK, JPA enum |
| `errorCode` | Uppercase with underscores | DB regex, Java `@Pattern` |
| `parsedData` | Must contain at minimum `fullName`, `email`, `skills` when present | Application logic in `CvParsingUseCaseImpl` |
| `applicationId` | Unique across table | DB `UNIQUE` constraint |
| `email` in logs | Must be masked to `***@domain.tld` | `PiiRedactor` in logging layer |

---

## State Transitions

```
                     ┌──────────┐
                     │  START   │ (message received)
                     └────┬─────┘
                          │
                    ┌─────▼──────┐
                    │ Idempotency│ ← if row exists with SUCCESS → ACK + skip
                    │   Check    │
                    └─────┬──────┘
                          │
                    ┌─────▼──────┐
                    │  Download  │
                    │ + Parse    │
                    │ + Extract  │
                    └─────┬──────┘
                          │
               ┌──────────┼──────────┐
               │          │          │
         ┌─────▼────┐ ┌──▼───┐ ┌───▼──────┐
         │ SUCCESS  │ │SKIP  │ │  FAILED  │
         │ scoring  │ │(no   │ │(scoring  │
         │          │ │j.d.) │ │ exception)│
         └─────┬────┘ └──┬───┘ └───┬──────┘
               │         │         │
               ▼         ▼         ▼
         ┌──────────────────────────────┐
         │     DB persist & post-commit  │
         │     publish (success/failure) │
         └──────────────────────────────┘
```

### Specific transition rules

1. **Idempotency**: If `cv_parse_results` has a row with `status = SUCCESS` for this `applicationId`, ACK and return immediately (no processing).
2. **Scoring SUCCESS**: Gemini returns a valid 0–100 integer → store with `scoringStatus = SUCCESS`.
3. **Scoring FALLBACK**: Gemini throws or returns invalid score → store `aiScore = 50, scoringReasoning = "Scoring unavailable"`, `scoringStatus = FALLBACK`.
4. **Scoring SKIPPED**: `jobDescription` is null/empty → store `aiScore = 0, scoringReasoning = null`, `scoringStatus = SKIPPED`.
5. **Pipeline FAILED**: Any non-recoverable exception → store `status = FAILED`, `errorCode`, `errorMessage`. DB commit before NACK to DLQ.
6. **Post-commit publish**: The RabbitMQ event is published only after the DB transaction commits. DB row is never rolled back due to publish failure.
