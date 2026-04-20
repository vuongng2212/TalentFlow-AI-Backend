# TalentFlow AI Backend - Integration Architecture

**Date:** 2026-04-18

## System overview

The repository currently implements a two-runtime backend plus one planned service:

- **API Gateway:** NestJS HTTP entry point and orchestration layer
- **CV Parser:** Spring Boot queue consumer that parses uploaded CVs
- **Notification:** planning-only service for future email and real-time push

Infrastructure shared across the implemented services includes PostgreSQL, Redis, RabbitMQ, and MinIO-compatible storage locally.

## Runtime topology

```text
Client -> API Gateway -> PostgreSQL
                     -> Redis
                     -> S3-compatible storage
                     -> RabbitMQ topic exchange

RabbitMQ -> CV Parser -> RabbitMQ success/failure events
```

## Current integration boundaries

| Boundary | Current status | Source of truth |
|---|---|---|
| HTTP API | Implemented | `api-gateway/src/main.ts`, controllers under `api-gateway/src/*/*.controller.ts` |
| Persistence | Implemented in API Gateway only | `api-gateway/prisma/schema.prisma` |
| Object storage | Implemented | `api-gateway/src/storage/storage.service.ts` |
| Message broker | Implemented | `api-gateway/src/queue/queue.service.ts`, `cv-parser/src/main/java/com/talentflow/cvparser/shared/config/RabbitMqConfig.java` |
| CV worker pipeline | Implemented with a placeholder persistence layer | `cv-parser/src/main/java/com/talentflow/cvparser/*` |
| Notification service | Planned only | `notification/README.md` |

## Message broker contract

### Exchange and queues
- **Exchange:** `talentflow.events`
- **CV parsing queue:** `cv_parser.jobs`
- **CV parsing DLQ:** `cv_parser.jobs.dlq`
- **Notification queues:** `notification.events` and `notification.events.dlq` are reserved in the gateway constants for future use

### Routing keys
| Routing key | Status | Published by | Consumed by | Notes |
|---|---|---|---|---|
| `cv.uploaded` | Implemented | API Gateway | CV Parser | Main handoff after CV upload |
| `cv.parsed` | Implemented | CV Parser | Future downstream consumers | Success event after parsing and scoring |
| `cv.failed` | Implemented | CV Parser | Future downstream consumers | Failure event with retryable flag |
| `application.created` | Documented / reserved | Legacy/planning docs | Future downstream consumers | Present in constants and planning docs, but not confirmed as emitted by current gateway code |
| `notification.send` | Planned | Future producers | Future Notification service | Reserved for notification fan-out |

### CV upload payload
The API Gateway emits `cv.uploaded` with:
- `candidateId`
- `applicationId`
- `jobId`
- `bucket`
- `fileKey`
- `mimeType`
- `uploadedAt`

This contract is security-sensitive because the downstream service must download by `bucket + fileKey`, not by arbitrary URLs.

### CV parser output payloads
- `cv.parsed` includes `aiScore`, `parsedData`, `scoringReasoning`, and `parsedAt`
- `cv.failed` includes `errorCode`, `errorMessage`, `retryable`, and `failedAt`

## Data flow

### 1. Candidate uploads CV
1. Client calls the API Gateway `/api/v1/applications/upload` endpoint.
2. Gateway validates the file, stores it in S3-compatible object storage, and creates the application record.
3. Gateway publishes `cv.uploaded` to RabbitMQ.
4. Gateway returns a processing response containing `applicationId`, `fileKey`, and `fileUrl`.

### 2. CV Parser consumes the event
1. RabbitMQ delivers `cv.uploaded` to `cv_parser.jobs`.
2. `CvParserListener` runs the parsing use case.
3. The worker downloads the file from object storage, parses text, applies OCR fallback when needed, extracts structured profile data, and scores the candidate.
4. On success, the worker publishes `cv.parsed` and ACKs the message.
5. On failure, the worker publishes `cv.failed` and NACKs to the DLQ.

### 3. Notification remains planned
- The legacy planning docs describe a future Notification service that will consume `application.created`, `cv.parsed`, `cv.failed`, and `notification.send`.
- No runtime code for that service exists yet in the current snapshot.

## Storage flow

- The API Gateway stores CV files in a bucket configured by `R2_BUCKET` / `S3_BUCKET_NAME` style environment values.
- Local development uses MinIO.
- Production guidance in the docs points to Cloudflare R2.
- Event payloads intentionally carry `bucket` and `fileKey` rather than raw upload URLs.

## Operational dependencies

| Dependency | Used by | Purpose |
|---|---|---|
| PostgreSQL | API Gateway | Users, jobs, candidates, applications, workspaces, interviews |
| Redis | API Gateway | Cache and auxiliary runtime support |
| RabbitMQ | API Gateway + CV Parser | Asynchronous event handoff |
| MinIO / R2 | API Gateway + CV Parser | CV storage |
| Tesseract | CV Parser | OCR fallback for scanned documents |
| Gemini API | CV Parser | LLM-based extraction/scoring path documented in config |

## Implementation status notes

- **API Gateway**: production-shaped HTTP service with guards, validation, metrics, and queue publishing.
- **CV Parser**: real worker pipeline with manual ACK/NACK and message publishing, but persistence is still a no-op placeholder.
- **Notification**: documentation-only, not runnable.

## Integration risks to keep in mind

- Do not route parsing through arbitrary `fileUrl` values.
- Do not treat `notification` as implemented until runtime code appears.
- Do not assume all runtime services are launched by `docker-compose.yml`.
- Keep event contracts aligned with `queue.constants.ts` and `RabbitMqConfig.java`.
