# CV Parser Architecture

**Status:** Partial
**Entry points:** `src/main/java/com/talentflow/cvparser/CvParserApplication.java`, `src/main/java/com/talentflow/cvparser/listener/CvParserListener.java`

## Purpose

The CV Parser is a queue-driven Spring Boot worker that consumes CV upload events, downloads the uploaded file from object storage, parses text from PDF or DOCX documents, falls back to OCR when necessary, extracts structured candidate data, and publishes success or failure events back to RabbitMQ.

## Current maturity

- The worker pipeline is real and wired to RabbitMQ.
- Manual ACK/NACK handling is implemented.
- `cv.parsed` and `cv.failed` events are published.
- Persistence is still a no-op placeholder.
- The service is not primarily an HTTP API; it is a background worker plus Actuator endpoints.

## Runtime pipeline

1. RabbitMQ delivers `cv.uploaded` to the `cv_parser.jobs` queue.
2. `CvParserListener` receives the event in manual ACK mode.
3. The parsing use case downloads the file from S3-compatible storage.
4. The file is parsed with format-aware parsers.
5. OCR is used for scanned or image-based documents when needed.
6. Structured candidate data is extracted.
7. The current repository layer logs the result instead of persisting it.
8. The worker publishes either `cv.parsed` or `cv.failed`.
9. On success, the message is ACKed.
10. On failure, the message is NACKed and routed to the DLQ.

## Message topology

| Item | Value |
|---|---|
| Exchange | `talentflow.events` |
| Main queue | `cv_parser.jobs` |
| Dead-letter queue | `cv_parser.jobs.dlq` |
| Inbound routing key | `cv.uploaded` |
| Success routing key | `cv.parsed` |
| Failure routing key | `cv.failed` |
| Queue TTL | 24 hours |
| Listener ack mode | Manual |

## Parser and extraction responsibilities

| Component | Responsibility |
|---|---|
| `CvParserListener` | Consumes RabbitMQ messages and controls ACK/NACK |
| `CvParsingUseCaseImpl` | Orchestrates download, parse, extract, save, and publish steps |
| `ParserFactory` | Chooses the parser implementation based on file type |
| `PdfTextParser` | Parses PDF text |
| `DocxTextParser` | Parses DOCX text |
| `TesseractOcrImpl` | OCR fallback for scanned documents |
| `RegexExtractorService` | Current extraction logic for structured candidate data |
| `NoOpCvParseResultRepository` | Placeholder persistence layer |

## Configured runtime concerns

The worker configuration in `application.yml` includes:
- RabbitMQ connection and retry settings
- PostgreSQL datasource settings
- S3-compatible storage settings
- LLM settings for Gemini-based extraction/scoring paths
- Tesseract OCR settings
- File size and page-count limits
- Actuator health and metrics exposure
- Resilience4j retry/circuit-breaker settings

## Integration points

### API Gateway
The API Gateway publishes `cv.uploaded` after uploading a CV file and creating the application record.

### Object storage
The parser uses `bucket + fileKey` to download files. It does not rely on arbitrary uploaded URLs.

### RabbitMQ downstream events
- `cv.parsed` is the success event.
- `cv.failed` is the failure event.
- The DLQ captures messages that are NACKed with requeue disabled.

## Security and reliability notes

- The event payload excludes raw URLs to reduce SSRF-style risk.
- Listener mode is manual so the worker only ACKs after successful processing.
- The queue uses a DLQ and TTL to prevent unbounded message retention.
- File-type and size limits are part of the runtime configuration.
- Persistence is intentionally not finalized yet; the repo currently logs results in the repository layer.

## Operational surface

- Default server port: `8081`
- Health endpoint: `/actuator/health`
- Metrics endpoint: `/actuator/prometheus`

## Implementation summary

The CV Parser is best understood as a background processing pipeline rather than an API service. It already contains the key production boundaries for queue consumption, document parsing, OCR fallback, event publication, and operational health reporting.
