This section covers Cross-service integration. Part 4 of 8.

## Cross-service integration
- The repository currently implements a two-runtime backend plus one planned service.
- The runtime topology is client to API Gateway to PostgreSQL, Redis, S3-compatible storage, and RabbitMQ, with RabbitMQ delivering `cv.uploaded` to CV Parser and CV Parser emitting success or failure events back to RabbitMQ.
- HTTP API is implemented in API Gateway controllers and `src/main.ts`.
- Persistence is implemented only in API Gateway, using Prisma and PostgreSQL.
- Object storage is implemented in API Gateway storage code.
- Message broker integration is implemented in API Gateway queue code and CV Parser RabbitMQ config.
- The CV worker pipeline is real and wired to RabbitMQ, but the persistence layer is still a no-op placeholder.
- Notification is planned only and has no runtime code in the current snapshot.
- The message broker contract uses the `talentflow.events` topic exchange, the `cv_parser.jobs` queue, and the `cv_parser.jobs.dlq` dead-letter queue.
- Notification queues `notification.events` and `notification.events.dlq` are reserved in gateway constants for future use.
- Implemented routing keys are `cv.uploaded` from API Gateway to CV Parser, `cv.parsed` from CV Parser to future downstream consumers, and `cv.failed` from CV Parser to future downstream consumers.
- `application.created` is documented or reserved in legacy and planning material but is not confirmed as emitted by current gateway code.
- `notification.send` is reserved for future notification fan-out.
- The CV upload payload carries `candidateId`, `applicationId`, `jobId`, `bucket`, `fileKey`, `mimeType`, and `uploadedAt`.
- That payload is security-sensitive because the downstream service must download by `bucket + fileKey`, not by arbitrary URLs.
- The parser output payloads are `cv.parsed` with `aiScore`, `parsedData`, `scoringReasoning`, and `parsedAt`, and `cv.failed` with `errorCode`, `errorMessage`, `retryable`, and `failedAt`.
- The data flow is: a client uploads a CV through the API Gateway, the gateway validates and stores the file, creates the application record, publishes `cv.uploaded`, returns processing metadata, the parser consumes the queue message, downloads from object storage, parses and extracts structured data, applies OCR fallback when needed, and then publishes either `cv.parsed` or `cv.failed`.
- The storage flow uses a bucket configured by `R2_BUCKET` or `S3_BUCKET_NAME` style environment values, MinIO locally, and Cloudflare R2 in the production guidance.
- Operational dependencies are PostgreSQL for API Gateway data, Redis for cache and support, RabbitMQ for asynchronous handoff, MinIO or R2 for CV storage, Tesseract for OCR fallback, and Gemini API for the documented LLM extraction/scoring path.
- Integration risks called out by the docs are: do not route parsing through arbitrary `fileUrl` values, do not treat Notification as implemented until runtime code exists, do not assume all services are launched by `docker-compose.yml`, and keep event contracts aligned with `queue.constants.ts` and `RabbitMqConfig.java`.
