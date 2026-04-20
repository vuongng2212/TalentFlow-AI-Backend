# CV Parser Data Models

**Status:** Partial

## Scope

The CV Parser does not currently have a finalized durable persistence model. Its real data model is centered on event DTOs and extracted profile objects.

## Message models

### CvUploadedEvent
Inbound queue message received from the API Gateway.

| Field | Notes |
|---|---|
| `candidateId` | UUID of the candidate |
| `applicationId` | UUID of the application |
| `jobId` | UUID of the job |
| `bucket` | Object storage bucket name |
| `fileKey` | Object storage key for the CV |
| `mimeType` | Uploaded file MIME type |
| `uploadedAt` | Upload timestamp |

**Important:** this event intentionally does not include a raw `fileUrl`.

### CvParsedEvent
Success event published after parsing and scoring.

| Field | Notes |
|---|---|
| `candidateId` | UUID of the candidate |
| `applicationId` | UUID of the application |
| `jobId` | UUID of the job |
| `aiScore` | Integer score from 0 to 100 |
| `parsedData` | Structured extracted CV data |
| `scoringReasoning` | Optional explanation for the score |
| `parsedAt` | Completion timestamp |

### CvFailedEvent
Failure event published when parsing cannot complete.

| Field | Notes |
|---|---|
| `candidateId` | UUID of the candidate |
| `applicationId` | UUID of the application |
| `jobId` | UUID of the job |
| `errorCode` | Uppercase classification such as `PARSING_FAILED` |
| `errorMessage` | Human-readable failure reason |
| `retryable` | Whether the failure can be retried |
| `failedAt` | Failure timestamp |

## Extracted profile model

### ParsedCvData
Structured extraction payload carried inside `CvParsedEvent`.

| Field | Notes |
|---|---|
| `fullName` | Candidate name |
| `email` | Email address |
| `phone` | Phone number |
| `linkedIn` | LinkedIn URL |
| `skills` | List of skills |
| `experience` | Work history entries |
| `education` | Education entries |
| `summary` | Summary or objective |

### Nested experience entry

| Field | Notes |
|---|---|
| `title` | Job title |
| `company` | Employer |
| `startDate` | `YYYY-MM` format |
| `endDate` | `YYYY-MM` or null |
| `description` | Role summary |

### Nested education entry

| Field | Notes |
|---|---|
| `degree` | Degree name |
| `institution` | School or university |
| `graduationYear` | Graduation year |

## Runtime extraction model

### CandidateProfile
The worker also uses a `CandidateProfile` shape during extraction.

| Field | Notes |
|---|---|
| `fullName` | Candidate name |
| `email` | Email address |
| `phone` | Phone number |
| `skills` | List of extracted skills |
| `yearsOfExperience` | Numeric experience estimate |
| `extractionStatus` | `SUCCESS`, `PARTIAL`, or `REGEX_FALLBACK` |

## Persistence status

- `NoOpCvParseResultRepository` is currently the only repository implementation.
- That means there is no finalized durable CV parse result entity in the current snapshot.
- Any future persistence model should be introduced carefully so it matches the existing event payloads.

## Data model notes

- Keep UUID validation on all event identifiers.
- Keep error messages non-sensitive.
- Keep the `bucket + fileKey` contract stable.
- Treat `parsedData` as the canonical structured output shape for downstream consumers.
