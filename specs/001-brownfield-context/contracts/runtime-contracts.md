# Runtime Contracts - Brownfield Context Completion

This snapshot records the currently deployed service boundaries so the brownfield context stays aligned with runtime truth.

## HTTP Surface

- The API Gateway is the only HTTP-facing runtime surface.
- Base path: `/api/v1`.
- Excluded from the global prefix: `health`, `ready`, and `metrics`.
- Authentication is bearer JWT.
- Global validation is strict and request-boundary focused.
- Successful responses are transformed into the repository's standard data envelope.
- Upload routes disable transform-related gzip behavior to protect file transfer semantics.

## CV Upload Event

- Producer: API Gateway queue service.
- Exchange: `talentflow.events`.
- Routing key: `cv.uploaded`.
- Consumer queue: `cv_parser.jobs`.
- Dead-letter queue: `cv_parser.jobs.dlq`.

Payload fields:

- `candidateId`
- `applicationId`
- `jobId`
- `bucket`
- `fileKey`
- `mimeType`
- `uploadedAt`

Contract rule:

- Do not publish a file URL in this event.
- Consumers must resolve the file from `bucket` plus `fileKey`.

## CV Parse Failure Event

- Producer: CV Parser.
- Exchange: `talentflow.events`.
- Routing key: `cv.failed`.

Payload fields:

- `candidateId`
- `applicationId`
- `jobId`
- `errorCode`
- `errorMessage`
- `retryable`
- `failedAt`

Operational rule:

- The listener uses manual ACK/NACK and sends failed messages to the DLQ path.

## Notification Runtime Shell

- Exchange: `talentflow.events`.
- Queue name default: `notification_queue`.
- Health and RabbitMQ wiring exist, but business notification consumers are still incomplete.

## Object Storage

- Local development uses MinIO as the S3-compatible store.
- Bucket name in compose: `talentflow-cvs`.
- The runtime contract assumes storage access via bucket and object key, not arbitrary URLs.