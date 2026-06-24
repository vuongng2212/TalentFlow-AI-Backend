# Contracts: CV Parser Scoring Pipeline

**Feature**: `018-cv-parser-scoring-pipeline`  
**Date**: 2026-06-24

This document defines all interface contracts: both internal (Java interfaces and service boundaries) and external (RabbitMQ event payloads).

---

## External Contracts (RabbitMQ)

### Exchange: `talentflow.events` (topic, durable)

The cv-parser consumes from and publishes to this shared exchange. No exchange topology changes for this feature.

### Consumed: `cv.uploaded` (routing key)

**Producer**: api-gateway  
**Consumer**: cv-parser (this service)  
**Existing DTO**: `CvUploadedEvent` — **modified** (additive)

**Changes**: Add optional `jobDescription` field for scoring.

```json
{
  "candidateId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "applicationId": "3fa85f64-5717-4562-b3fc-2c963f66afa7",
  "jobId": "3fa85f64-5717-4562-b3fc-2c963f66afa8",
  "bucket": "talentflow-cvs",
  "fileKey": "cvs/2026/06/uuid.pdf",
  "mimeType": "application/pdf",
  "uploadedAt": "2026-06-24T10:00:00Z",
  "jobDescription": "Looking for a Senior Backend Engineer with 5+ years of experience in Node.js..."  // NEW - nullable
}
```

**Validation rules**:
- All original fields: unchanged (UUIDs required, bucket/fileKey required)
- `jobDescription`: optional, nullable. If absent or empty → scoring SKIPPED
- Deserialization remains backward-compatible (JSON with unknown properties is ignored)

---

### Published: `cv.parsed` (routing key)

**Producer**: cv-parser (this service)  
**Consumer**: api-gateway  
**Existing DTO**: `CvParsedEvent` — **already has correct fields** (just never populated with real values)

```json
{
  "candidateId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "applicationId": "3fa85f64-5717-4562-b3fc-2c963f66afa7",
  "jobId": "3fa85f64-5717-4562-b3fc-2c963f66afa8",
  "aiScore": 85,
  "parsedData": {
    "fullName": "Nguyen Van A",
    "email": "a.nguyen@example.com",
    "phone": "+84123456789",
    "linkedIn": "https://linkedin.com/in/anguyen",
    "skills": ["NestJS", "TypeScript", "PostgreSQL", "Docker"],
    "experience": [
      {
        "title": "Senior Backend Engineer",
        "company": "Tech Corp",
        "startDate": "2020-01",
        "endDate": null,
        "description": "Led API development..."
      }
    ],
    "education": [
      {
        "degree": "Bachelor of Computer Science",
        "institution": "University of Technology",
        "graduationYear": "2018"
      }
    ],
    "summary": "Experienced backend engineer with 5+ years..."
  },
  "scoringReasoning": "Strong match in NestJS/TypeScript requirements. Candidate has 5+ years backend experience matching the senior requirement.",
  "parsedAt": "2026-06-24T10:00:05Z"
}
```

**Contract invariants**:
- `aiScore` ∈ [0, 100] — real value, never hardcoded 0
- `aiScore` = 0 with `scoringReasoning` = null when scoring SKIPPED
- `aiScore` = 50 with `scoringReasoning` = "Scoring unavailable" when scoring FALLBACK
- `parsedData` always contains at minimum `fullName`, `email`, `skills`
- `parsedData.phone` may contain PII — NOT logged; masked by `PiiRedactor`
- No backward-compatibility issues (fields already existed in DTO)

---

### Published: `cv.failed` (routing key)

**Producer**: cv-parser (this service)  
**Consumer**: api-gateway  
**Existing DTO**: `CvFailedEvent` — **already has correct fields** (just never populated with retryable/failedAt)

```json
{
  "candidateId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "applicationId": "3fa85f64-5717-4562-b3fc-2c963f66afa7",
  "jobId": "3fa85f64-5717-4562-b3fc-2c963f66afa8",
  "errorCode": "EXTRACTION_FAILED",
  "errorMessage": "Gemini returned invalid JSON for candidate profile extraction",
  "retryable": false,
  "failedAt": "2026-06-24T10:00:05Z"
}
```

**Contract invariants**:
- `retryable` = `false` → NACK to DLQ immediately (non-recoverable error)
- `retryable` = `true` → only published after `maxRetries` exhausted; NACK to DLQ
- `failedAt` = ISO-8601 timestamp
- `errorMessage` MUST NOT contain PII or raw CV text
- `errorCode` follows uppercase underscore convention

---

## Internal Contracts (Java Interfaces)

### `CandidateScoringUseCase`

```java
package com.talentflow.cvparser.scoring;

/**
 * Scores a candidate's extracted profile against the job description.
 * Always returns a non-null ScoringResult — never throws.
 */
public interface CandidateScoringUseCase {

    /**
     * @param candidateProfile The extracted CV data (non-null)
     * @param jobDescription   The job requirements text (nullable — null/empty = SKIPPED)
     * @return ScoringResult — never null. Outcome depends on scoring path.
     */
    ScoringResult score(CandidateProfile candidateProfile, String jobDescription);
}
```

### `CvParseResultRepository` (refactored interface)

The existing `CvParseResultRepository` interface is preserved but a JPA implementation replaces `NoOpCvParseResultRepository`.

```java
package com.talentflow.cvparser.repository;

public interface CvParseResultRepository {
    void save(CvUploadedEvent event, CandidateProfile profile, ScoringResult scoring);
    boolean existsByApplicationIdAndStatus(UUID applicationId, ParseStatus status);
}
```

### `CvParsingUseCase` (refactored)

The existing interface is stable. The implementation gains scoring, idempotency, post-commit publish, and metrics.

```java
// No interface change — implementation only
void execute(CvUploadedEvent event) throws Exception;
```

---

## Configuration Properties

### `ScoringConfig` (new)

| Property | Default | Description |
|---|---|---|
| `llm.scoring.timeout-seconds` | 10 | Timeout for Gemini scoring API call |
| `llm.scoring.prompt-template` | (built-in resource) | Path to scoring prompt template |
| `llm.scoring.fallback-score` | 50 | Fallback score when Gemini unavailable |
| `llm.scoring.fallback-reason` | "Scoring unavailable" | Fallback reasoning text |
| `llm.min-text-length` | 50 | Inherited from extraction (min text for LLM scoring) |

Consumer services (e.g., api-gateway) must be tolerant of additive-only changes to these payloads. No breaking changes are introduced.
