---
type: bmad-distillate
sources:
  - '../docs/architecture-api-gateway.md'
  - '../docs/architecture-cv-parser.md'
  - '../docs/architecture-notification.md'
  - '../docs/api-contracts-api-gateway.md'
  - '../docs/data-models-api-gateway.md'
  - '../docs/data-models-cv-parser.md'
  - '../docs/development-guide-api-gateway.md'
  - '../docs/development-guide-cv-parser.md'
  - '../docs/development-guide-notification.md'
  - '../docs/index.md'
  - '../docs/integration-architecture.md'
  - '../docs/project-overview.md'
  - '../docs/project-parts.json'
  - '../docs/project-scan-report.json'
  - '../docs/source-tree-analysis.md'
downstream_consumer: general
created: 2026-04-18
token_estimate: 4600
parts: 1
---

## Repository identity
- TalentFlow AI Backend is a brownfield ATS backend implemented as a multi-part monorepo with 3 parts and a polyglot microservice backend architecture.
- Primary languages are TypeScript, Java, and Markdown.
- The documentation set is generated from runtime code and configuration first; current docs treat code and runtime configuration as the source of truth.
- Current maturity is uneven by part: API Gateway is implemented, CV Parser is partially implemented, Notification is planned only.
- Shared runtime infrastructure across the implemented services is PostgreSQL, Redis, RabbitMQ, and S3-compatible storage; local storage uses MinIO and production guidance points to Cloudflare R2.
- The root docker-compose setup starts the infrastructure and API Gateway, not every service in the repository.
- The API Gateway is the only HTTP-facing runtime in the current implementation; CV Parser is a separate background worker; Notification is documentation-driven design material only.
- General setup follows the service guides: start infrastructure with `docker-compose up -d`, set up `api-gateway` with npm and Prisma, set up `cv-parser` with Maven, and treat Notification as non-runnable until code exists.
- Key product features documented in the repo are JWT auth with access and refresh cookies, RBAC and throttling, jobs/candidates/applications/interviews/workspaces CRUD, CV upload to object storage with asynchronous parsing, RabbitMQ event flow, health/readiness/metrics, Prisma-backed ATS data, and PDF/DOCX/OCR parsing with failure events.
- The gateway is the canonical HTTP surface and the parser pipeline is intentionally asynchronous.

## Documentation inventory
- Core documentation:
  - `project-overview.md` gives the executive summary, part classification, feature list, architecture highlights, and getting started snapshot.
  - `source-tree-analysis.md` describes repo layout, entry points, file patterns, and development notes.
  - `integration-architecture.md` describes service boundaries, broker contract, data flow, storage flow, and integration risks.
  - `index.md` is the human-facing docs map and quick reference for the BMAD-generated docs set.
- API Gateway documentation:
  - `architecture-api-gateway.md` describes the gateway runtime, module layout, security model, integrations, and operational endpoints.
  - `development-guide-api-gateway.md` covers local setup, commands, environment variables, local URLs, and verification.
  - `api-contracts-api-gateway.md` enumerates the gateway routes, auth behavior, and response conventions.
  - `data-models-api-gateway.md` documents the Prisma-backed ATS models and their relationships.
- CV Parser documentation:
  - `architecture-cv-parser.md` describes the worker pipeline, message topology, parser responsibilities, and operational surface.
  - `development-guide-cv-parser.md` covers local setup, Maven commands, runtime config, and verification.
  - `data-models-cv-parser.md` documents inbound/outbound queue DTOs, extracted profile shapes, and the lack of finalized durable persistence.
- Notification documentation:
  - `architecture-notification.md` captures the planned service scope, planned integrations, and the warning that it is not runnable yet.
  - `development-guide-notification.md` captures the future-service workflow and setup notes.
- Workflow metadata:
  - `project-parts.json` is the machine-readable inventory of the three parts and their integration settings.
  - `project-scan-report.json` records the generated-doc workflow status, completed steps, and validation metadata.

## Repository layout and source tree
- The repository is organized as a multi-part backend with two runtime services and one planning-only service; runtime truth comes from service folders and infrastructure files.
- `api-gateway/` is the main runtime service for the ATS backend and contains auth, users, jobs, candidates, applications, interviews, workspaces, analytics, health, metrics, queue, storage, Prisma, and tests.
- `api-gateway/src/` is organized as feature-based NestJS modules with cross-cutting code in `common/`.
- `api-gateway/prisma/` holds the database schema, seed script, and generated client output target.
- `api-gateway/test/` contains E2E and integration-oriented Jest tests.
- `cv-parser/` is the queue-driven CV parsing worker and contains the Spring Boot app, RabbitMQ listener, parser pipeline, extractor, repository placeholder, shared DTOs, Actuator config, and tests.
- `cv-parser/src/main/java/com/talentflow/cvparser/` is package-by-responsibility with `listener/`, `usecase/`, `parser/`, `extractor/`, `repository/`, and `shared/`; event DTOs live under `shared/dto`.
- `cv-parser/src/main/resources/` holds runtime configuration such as RabbitMQ, storage, OCR, LLM, Actuator, and resilience settings.
- `notification/` is planning-only and currently contains `README.md` and `IMPLEMENTATION-PHASES.md`; there is no runtime source tree in the current snapshot.
- `docs/` is the generated brownfield documentation root.
- `_bmad/` holds BMAD configuration and generated context.
- `_bmad-output/` holds BMAD workflow artifacts.
- `docker-compose.yml` defines the local infrastructure and current API Gateway runtime composition.
- `k8s/` contains Kubernetes manifests currently centered on the API Gateway.
- `README.md` is the repository-level overview.
- Key file patterns are TypeScript service files under `api-gateway/src/**/*.ts`, Java service files under `cv-parser/src/main/java/**/*.java`, and configuration files such as `docker-compose.yml`, `api-gateway/package.json`, `api-gateway/.env.example`, `api-gateway/prisma/schema.prisma`, `cv-parser/pom.xml`, and `cv-parser/src/main/resources/application.yml`.
- Development notes from the source-tree analysis: do not assume the root compose file starts every service, treat the API Gateway as the canonical HTTP surface, treat CV Parser as operationally separate, and treat Notification as design material until runtime code appears.

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

## API Gateway
### Architecture and runtime
- The gateway is the primary HTTP surface of the backend and owns authentication, CRUD APIs for ATS resources, file upload orchestration, queue publishing, storage integration, and health and metrics.
- Runtime pipeline: `NestFactory.create()` boots the app; logging is attached via `ElkLoggerService` when `ELK_HOST` is configured, otherwise Nest logger is used; the global prefix is set to `/api/v1` with `health`, `ready`, and `metrics` excluded; security middleware applies `helmet`, `hpp`, `cookieParser`, CORS, and body-size limits; a global `ValidationPipe` enforces whitelist and rejects non-whitelisted input; global interceptors apply request logging and response transformation; a global exception filter normalizes HTTP errors; Swagger is mounted when enabled; the app listens on `PORT` with default `8080`.
- Module layout: `AuthModule` handles signup/login/refresh/logout/current-user lookup; `UsersModule` handles user management and role updates; `JobsModule` handles job CRUD; `CandidatesModule` handles candidate CRUD; `ApplicationsModule` handles application CRUD and CV upload orchestration; `InterviewsModule` handles interview scheduling and maintenance; `WorkspacesModule` handles workspace and membership management; `AnalyticsModule` handles pipeline and operational summaries; `HealthModule` handles liveness and readiness; `MetricsModule` exposes Prometheus metrics; `PrismaModule` handles database access; `RedisModule` handles cache and Redis connectivity; `StorageModule` handles S3-compatible storage; `QueueModule` handles RabbitMQ connection and publishing; `LoggerModule` handles structured logging; `AppConfigModule` handles config validation and environment access.
- Security model: `JwtAuthGuard`, `RolesGuard`, and `ThrottlerGuard` are applied globally; public routes use `@Public()`; auth uses access and refresh token cookies; `class-validator` DTOs are enforced globally; environment-based config is validated at startup; upload routes use file validation and storage-backed keys rather than arbitrary URLs.
- Integration points: PostgreSQL stores ATS models; Redis is a runtime dependency for cache and support; RabbitMQ carries CV upload events to `talentflow.events` with routing key `cv.uploaded`; S3-compatible storage holds CV files and the gateway references them by bucket plus file key; observability endpoints are `/health`, `/ready`, `/metrics`, `/api/docs`, and `/api-json`.
- Main API groups: `/api/v1/auth`, `/api/v1/users`, `/api/v1/jobs`, `/api/v1/candidates`, `/api/v1/applications`, `/api/v1/interviews`, `/api/v1/workspaces`, `/api/v1/analytics`, plus `/health`, `/ready`, and `/metrics` outside the global prefix.
- Request and response conventions: responses are transformed into a common envelope by the global interceptor; pagination endpoints return `data` plus `meta`; errors are thrown as Nest HTTP exceptions and normalized by the global filter; upload endpoints return processing metadata immediately and parsing continues asynchronously.
- CV upload flow: `POST /api/v1/applications/upload` validates the file, stores it in object storage, creates the application record, and publishes a `cv.uploaded` event.
- Status and auth flow: `POST /api/v1/auth/login` sets cookies; `POST /api/v1/auth/refresh` rotates tokens; `POST /api/v1/auth/logout` clears cookies and revokes token context.
- Operational notes: the gateway is the only service started by the root compose file alongside infrastructure; CV Parser and Notification are operationally separate; the global prefix and health exclusions are important when writing docs or tests.

### Development guide
- Prerequisites for the gateway are Node.js 20+, npm, Docker, Docker Compose, and local PostgreSQL, Redis, RabbitMQ, and MinIO availability.
- Local setup steps are: start infrastructure with `docker-compose up -d`, enter `api-gateway`, run `npm install`, run `npx prisma generate`, run `npm run db:migrate`, optionally run `npm run db:seed`, and start with `npm run start:dev`.
- Useful commands are `npm run build`, `npm run start`, `npm run start:dev`, `npm run start:debug`, `npm run test`, `npm run test:e2e`, `npm run test:cov`, `npm run lint`, `npm run format`, `npm run swagger:generate`, `npm run docker:up`, `npm run docker:down`, and `npm run docker:logs`.
- Environment variables are grouped as application (`NODE_ENV`, `PORT`), database (`DATABASE_URL`, `DIRECT_URL`), cache and messaging (`REDIS_URL`, `RABBITMQ_URL`, `RABBITMQ_HEARTBEAT_SEC`, `RABBITMQ_RECONNECT_INITIAL_DELAY_MS`, `RABBITMQ_RECONNECT_MAX_DELAY_MS`), auth (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION`), storage (`R2_ENDPOINT`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`), and security/observability (`RATE_LIMIT_TTL_SEC`, `RATE_LIMIT_MAX`, `BODY_LIMIT_MB`, `TIMEOUT_MS`, `CORS_ORIGINS`, `LOG_LEVEL`, `ELK_HOST`, `ELK_LOG_LEVEL`, `ELK_INDEX_PREFIX`, `QUEUE_METRICS_POLL_INTERVAL_MS`).
- Local URLs are the API root at `http://localhost:8080/api/v1`, Swagger UI at `http://localhost:8080/api/docs`, Swagger JSON at `http://localhost:8080/api-json`, health at `http://localhost:8080/health`, readiness at `http://localhost:8080/ready`, and metrics at `http://localhost:8080/metrics`.
- Development notes: auth is cookie-based and tests must preserve cookies across requests; the root compose file starts infra plus the gateway only; CV upload requires RabbitMQ and object storage online; use the global prefix for most endpoints and exclude health, readiness, and metrics; keep Prisma migrations in sync with `schema.prisma`.
- Verification checklist: `npm run build` passes, `npm run test` passes, `npm run test:e2e` passes for core flows, `docker-compose up -d` brings up Postgres, Redis, RabbitMQ, MinIO, and the gateway, and Swagger matches the current controllers.

### API contracts
- Contract shape: all routes below are under `/api/v1` unless noted otherwise; responses are transformed by the global interceptor into a common envelope; most routes require authentication via the global JWT guard; `@Public()` marks unauthenticated routes.
- Public and operational endpoints: `GET /health` for liveness outside the global prefix, `GET /ready` for readiness checks over memory/database/Redis/RabbitMQ, `GET /metrics` for Prometheus metrics outside the global prefix, `GET /api/v1` for the app controller response, `GET /api/docs` for Swagger UI, and `GET /api-json` for the Swagger JSON.
- Auth routes: `POST /api/v1/auth/signup` registers a user and is public; `POST /api/v1/auth/login` logs in and sets cookies and is public; `POST /api/v1/auth/refresh` rotates access and refresh tokens and uses the refresh cookie; `GET /api/v1/auth/me` returns the current user profile and uses the access token; `POST /api/v1/auth/logout` clears cookies and revokes the token context and uses the access token.
- Auth response notes: login and refresh set access and refresh cookies; profile responses return current user identity and role; logout clears both cookies.
- Users routes: `GET /api/v1/users` lists users; `GET /api/v1/users/:id` reads one user; `PATCH /api/v1/users/:id` updates a user; `PATCH /api/v1/users/:id/role` updates a user role; `DELETE /api/v1/users/:id` soft-deletes or removes a user.
- Jobs routes: `POST /api/v1/jobs` creates a job; `GET /api/v1/jobs` lists jobs; `GET /api/v1/jobs/:id` reads one job; `PUT /api/v1/jobs/:id` updates a job; `DELETE /api/v1/jobs/:id` deletes a job.
- Candidates routes: `GET /api/v1/candidates` lists candidates; `GET /api/v1/candidates/:id` reads one candidate; `PATCH /api/v1/candidates/:id` updates a candidate; `DELETE /api/v1/candidates/:id` deletes a candidate.
- Applications routes: `POST /api/v1/applications` applies to a job with JSON; `POST /api/v1/applications/upload` applies with CV upload via `multipart/form-data`; `GET /api/v1/applications` lists applications with role filtering; `GET /api/v1/applications/:id` reads one application with access control; `PUT /api/v1/applications/:id` updates an application with recruiter/admin/applicant rules; `DELETE /api/v1/applications/:id` withdraws an application for candidates only.
- Applications upload response: the upload endpoint returns `applicationId`, `fileKey`, `fileUrl`, optional `presignedUrl`, `status: processing`, and a success message.
- Applications list response: list endpoints return a `data` array and pagination metadata.
- Interviews routes: `POST /api/v1/interviews` creates an interview; `GET /api/v1/interviews` lists interviews; `GET /api/v1/interviews/:id` reads one interview; `PATCH /api/v1/interviews/:id` updates an interview; `DELETE /api/v1/interviews/:id` deletes an interview.
- Workspaces routes: `POST /api/v1/workspaces` creates a workspace; `POST /api/v1/workspaces/:id/members` adds a member; `GET /api/v1/workspaces/:id/members` lists members.
- Analytics routes: `GET /api/v1/analytics/overview` returns high-level metrics; `GET /api/v1/analytics/pipeline` returns pipeline breakdown; `GET /api/v1/analytics/trends` returns trend data; `GET /api/v1/analytics/top-jobs` returns top-performing jobs.
- Common behavior: validation is strict and rejects unknown properties; route-level authorization is enforced by global guards plus role checks inside services; errors are surfaced as Nest HTTP exceptions and normalized by the global filter; pagination responses use `meta` fields such as `total`, `page`, `limit`, and `totalPages` where relevant.
- Important implementation notes: `cv.uploaded` is the only queue message definitely emitted by the current gateway code; `application.created` appears in constants and legacy planning docs but should be treated carefully unless the current emitter path is confirmed; the API docs should always preserve the `/api/v1` prefix for everything except `health`, `ready`, and `metrics`.

### Data models
- Source of truth: the gateway data model is defined in `api-gateway/prisma/schema.prisma` and backed by PostgreSQL.
- Model overview: `User` for authenticated users and recruiters/interviewers/admins; `Job` for job postings; `Workspace` for hiring workspaces or business containers; `WorkspaceMember` for many-to-many workspace membership; `Candidate` for candidate identity and resume profile; `Application` for a candidate applying to a job; `Interview` for interview scheduling and outcome tracking.
- `User`: `id` UUID PK; `email` unique; `password` stored hash; `role` is `ADMIN`, `RECRUITER`, or `INTERVIEWER`; `fullName` maps to `full_name`; relations include `createdJobs`, `interviews`, `workspaceMembers`, and `invitedWorkspaceMembers`; timestamps are `createdAt` and `updatedAt`; `deletedAt` is a soft delete marker.
- `Job`: `id` UUID PK; `title` required; `description` optional; `requirements` JSON payload; `department` optional; `location` optional; `employmentType` is `FULL_TIME`, `PART_TIME`, `CONTRACT`, or `INTERNSHIP`; `salaryMin` and `salaryMax` are optional integers; `status` is `DRAFT`, `OPEN`, `CLOSED`, or `ARCHIVED`; `createdById` points to `User`; `applications` is one-to-many to `Application`; timestamps are `createdAt` and `updatedAt`; `deletedAt` is a soft delete marker.
- `Workspace`: `id` UUID PK; `name` workspace name; `isBusiness` boolean business flag; `members` one-to-many to `WorkspaceMember`; timestamps are `createdAt` and `updatedAt`.
- `WorkspaceMember`: `id` UUID PK; `workspaceId` FK to `Workspace`; `userId` FK to `User`; `role` is `OWNER`, `ADMIN`, `RECRUITER`, or `VIEWER`; `status` is `ACTIVE`, `INVITED`, or `REMOVED`; `invitedById` is an optional FK to `User`; timestamps are `createdAt` and `updatedAt`; constraints are unique composite key on `(workspaceId, userId)` and indexes on `(workspaceId, status)` and `(userId, status)`.
- `Candidate`: `id` UUID PK; `email` unique; `fullName` mapped to `full_name`; `phone` optional; `linkedinUrl` optional; `resumeUrl` optional; `resumeText` optional text payload; timestamps are `createdAt` and `updatedAt`.
- `Application`: `id` UUID PK; `jobId` FK to `Job`; `candidateId` FK to `Candidate`; `stage` is `APPLIED`, `SCREENING`, `INTERVIEW`, `OFFER`, `HIRED`, or `REJECTED`; `status` is `SUBMITTED`, `REVIEWING`, `SHORTLISTED`, `INTERVIEW_SCHEDULED`, `INTERVIEWED`, `OFFERED`, `ACCEPTED`, `REJECTED`, or `WITHDRAWN`; `cvFileKey` is the object-storage key; `cvFileUrl` is the stored file URL; `coverLetter` optional text; `notes` optional recruiter notes; `appliedAt` is the submission timestamp; `reviewedAt` is optional; timestamps are `createdAt` and `updatedAt`; `deletedAt` is a soft delete marker.
- `Application` constraints: unique composite key on `(jobId, candidateId)` and indexes on `jobId`, `candidateId`, and `status`.
- `Interview`: `id` UUID PK; `applicationId` FK to `Application`; `scheduledAt` scheduled time; `duration` minutes with default 60; `type` is `PHONE`, `VIDEO`, `IN_PERSON`, `PANEL`, or `TECHNICAL`; `location` optional link or address; `notes` optional; `status` is `SCHEDULED`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, or `NO_SHOW`; `interviewerId` optional FK to `User`; timestamps are `createdAt` and `updatedAt`.
- Relationship summary: a `User` creates many `Job` records; a `Job` has many `Application` records; a `Candidate` can apply to many jobs through `Application`; an `Application` can have many `Interview` records; `Workspace` and `User` are connected through `WorkspaceMember`; `Interview` can optionally point to a `User` acting as interviewer.
- Data model notes: soft deletes are used on `User`, `Job`, and `Application`; `Candidate` records can be auto-created from authenticated user data during application flows; `Application` stores both object-storage references and a URL because the current runtime exposes both; the schema is ATS-focused rather than generic CRM modeling.
- Practical implications for feature work: extend the current Prisma model set rather than inventing a parallel domain table; changes to application lifecycle must consider the unique `(jobId, candidateId)` constraint; workspace and membership status updates must be handled carefully because role checks depend on them; keep status fields aligned with controllers and services because they are part of the business contract.

## CV Parser
### Architecture and runtime
- The CV Parser is a queue-driven Spring Boot worker that consumes CV upload events, downloads uploaded files from object storage, parses text from PDF or DOCX, falls back to OCR when necessary, extracts structured candidate data, and publishes success or failure events back to RabbitMQ.
- Current maturity: the worker pipeline is real and wired to RabbitMQ; manual ACK/NACK handling is implemented; `cv.parsed` and `cv.failed` events are published; persistence is still a no-op placeholder; the service is not primarily an HTTP API and instead combines a background worker with Actuator endpoints.
- Runtime pipeline: RabbitMQ delivers `cv.uploaded` to `cv_parser.jobs`; `CvParserListener` receives the event in manual ACK mode; the parsing use case downloads the file from S3-compatible storage; the file is parsed with format-aware parsers; OCR is used for scanned or image-based documents when needed; structured candidate data is extracted; the current repository layer logs the result instead of persisting it; the worker publishes either `cv.parsed` or `cv.failed`; on success the message is ACKed; on failure the message is NACKed and routed to the DLQ.
- Message topology: exchange `talentflow.events`; main queue `cv_parser.jobs`; dead-letter queue `cv_parser.jobs.dlq`; inbound routing key `cv.uploaded`; success routing key `cv.parsed`; failure routing key `cv.failed`; queue TTL 24 hours; listener ACK mode manual.
- Component responsibilities: `CvParserListener` consumes RabbitMQ messages and controls ACK/NACK; `CvParsingUseCaseImpl` orchestrates download, parse, extract, save, and publish steps; `ParserFactory` chooses the parser implementation based on file type; `PdfTextParser` parses PDF text; `DocxTextParser` parses DOCX text; `TesseractOcrImpl` provides OCR fallback for scanned documents; `RegexExtractorService` contains the current extraction logic for structured candidate data; `NoOpCvParseResultRepository` is the placeholder persistence layer.
- Configured runtime concerns in `application.yml` include RabbitMQ connection and retry settings, PostgreSQL datasource settings, S3-compatible storage settings, LLM settings for Gemini-based extraction/scoring paths, Tesseract OCR settings, file-size and page-count limits, Actuator health and metrics exposure, and Resilience4j retry/circuit-breaker settings.
- Integration points: API Gateway publishes `cv.uploaded` after uploading a CV file and creating the application record; object storage download uses `bucket + fileKey` rather than arbitrary uploaded URLs; downstream events are `cv.parsed` for success and `cv.failed` for failure; the DLQ captures messages that are NACKed with requeue disabled.
- Security and reliability notes: the event payload excludes raw URLs to reduce SSRF-style risk; listener mode is manual so the worker only ACKs after successful processing; the queue uses a DLQ and TTL to prevent unbounded message retention; file-type and size limits are part of runtime configuration; persistence is intentionally not finalized yet and the repository layer currently logs results.
- Operational surface: default server port is `8081`; health endpoint is `/actuator/health`; metrics endpoint is `/actuator/prometheus`.
- Implementation summary: the CV Parser is best understood as a background processing pipeline rather than an API service; it already contains the production boundaries for queue consumption, document parsing, OCR fallback, event publication, and operational health reporting.

### Development guide
- Prerequisites are Java 17, Maven, Docker, Docker Compose, RabbitMQ, PostgreSQL, MinIO or another S3-compatible storage backend, and the Tesseract OCR runtime for scanned documents.
- Local setup steps are: start infrastructure with `docker-compose up -d`, enter `cv-parser`, run `mvn test`, and start the worker with `mvn spring-boot:run`.
- Useful commands are `mvn test`, `mvn clean package`, `mvn spring-boot:run`, and `mvn -DskipTests package`.
- Runtime configuration is read from `src/main/resources/application.yml`.
- Core environment variables are `SPRING_PROFILES_ACTIVE`, `SERVER_PORT`, `DATABASE_URL`, `DB_USER`, `DB_PASS`, `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASS`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_REGION`, `LLM_PROVIDER`, `LLM_MODEL`, `GEMINI_API_KEY`, `TESSERACT_DATA_PATH`, `TESSERACT_LANGUAGE`, `FILE_MAX_SIZE_MB`, and `FILE_MAX_PAGES`.
- Local URLs are health at `http://localhost:8081/actuator/health` and Prometheus metrics at `http://localhost:8081/actuator/prometheus`.
- Development notes: this service is queue-driven and does not expose the main ATS HTTP API; the persistence layer is currently a no-op placeholder, so developers should not expect durable CV parse results yet; the worker depends on RabbitMQ and object storage to exercise the full pipeline; keep file-type and file-size limits aligned with the configuration file; the event payloads should continue to use `bucket + fileKey` rather than direct file URLs.
- Verification checklist: `mvn test` passes, the application starts with the expected local profile, RabbitMQ consumption works against `cv_parser.jobs`, health and metrics endpoints respond on port `8081`, and parsed and failed events remain aligned with the message contracts.

### Data models
- Scope: the CV Parser does not currently have a finalized durable persistence model; its real data model is centered on event DTOs and extracted profile objects.
- `CvUploadedEvent`: inbound queue message from the API Gateway with `candidateId`, `applicationId`, `jobId`, `bucket`, `fileKey`, `mimeType`, and `uploadedAt`; the event intentionally does not include a raw `fileUrl`.
- `CvParsedEvent`: success event published after parsing and scoring with `candidateId`, `applicationId`, `jobId`, `aiScore`, `parsedData`, `scoringReasoning`, and `parsedAt`.
- `CvFailedEvent`: failure event published when parsing cannot complete with `candidateId`, `applicationId`, `jobId`, `errorCode`, `errorMessage`, `retryable`, and `failedAt`.
- `ParsedCvData`: structured extraction payload carried inside `CvParsedEvent` with `fullName`, `email`, `phone`, `linkedIn`, `skills`, `experience`, `education`, and `summary`.
- Nested experience entry: `title`, `company`, `startDate` in `YYYY-MM`, `endDate` in `YYYY-MM` or null, and `description`.
- Nested education entry: `degree`, `institution`, and `graduationYear`.
- `CandidateProfile`: runtime extraction shape with `fullName`, `email`, `phone`, `skills`, `yearsOfExperience`, and `extractionStatus` values `SUCCESS`, `PARTIAL`, or `REGEX_FALLBACK`.
- Persistence status: `NoOpCvParseResultRepository` is the only repository implementation; there is no finalized durable CV parse result entity in the current snapshot; any future persistence model should be introduced carefully so it matches the existing event payloads.
- Data model notes: keep UUID validation on all event identifiers; keep error messages non-sensitive; keep the `bucket + fileKey` contract stable; treat `parsedData` as the canonical structured output shape for downstream consumers.

## Notification
- The Notification service is documented as the future home for email notifications, WebSocket push updates, and notification history, but the current repository snapshot does not contain runtime code for the service.
- Current maturity: planning docs exist; no executable service entry point exists in the current snapshot; the service should not be treated as runnable or production-ready yet.
- Intended responsibilities according to the planning docs are sending transactional email, pushing real-time notifications to clients, storing notification history, and consuming RabbitMQ events from the backend ecosystem.
- Intended integration points are RabbitMQ for `application.created`, `cv.parsed`, `cv.failed`, and `notification.send`; PostgreSQL for notification history; Redis for Socket.IO scaling; SMTP for email; and Socket.IO for real-time client push.
- Planning-doc architecture themes are a modular NestJS service, an HTTP API for notification history and actions, a WebSocket gateway for authenticated push notifications, a RabbitMQ consumer for backend events, a Prisma-backed persistence layer, and JWT-based auth shared with the rest of the backend.
- Important caution: all of the above are design intentions, not current runtime facts.
- Recommended interpretation: treat Notification as a service design area rather than a live service, and check future implementation against the current event contracts and the live code in `api-gateway/` and `cv-parser/`.

## Project metadata and generation state
- `project-parts.json` captures the machine-readable inventory of the three parts and their integration settings.
- `project_name` is `TalentFlow AI Backend`.
- `repository_type` is `multi-part monorepo`.
- `parts_count` is `3`.
- `architecture_type` is `polyglot microservice backend`.
- `primary_languages` are `TypeScript`, `Java`, and `Markdown`.
- `project_root` is `d:/Project/TalentFlow-AI/TalentFlow-AI-Backend`.
- `project_knowledge` is `d:/Project/TalentFlow-AI/TalentFlow-AI-Backend/docs`.
- Part inventory: `api-gateway` is a TypeScript NestJS 11 service, status `implemented`, has API and data, and is the primary backend entry point for auth, jobs, applications, candidates, interviews, workspaces, analytics, health, metrics, storage, and queue publishing; `cv-parser` is a Java Spring Boot 3.3 service, status `partial`, has data but no API, and is a queue-driven worker that consumes CV upload events, parses documents, applies OCR fallback, and publishes parsed or failed outcomes while persistence remains a no-op placeholder; `notification` is a TypeScript planned NestJS service, status `planned`, has no API and no data, and is for email, WebSocket push, and notification history.
- Integration metadata: message broker is the RabbitMQ topic exchange `talentflow.events`; storage is S3-compatible object storage with MinIO locally and Cloudflare R2 in production; database is PostgreSQL via Prisma in API Gateway; cache is Redis; notes state that API Gateway publishes `cv.uploaded`, CV Parser consumes it and publishes `cv.parsed` and `cv.failed`, and Notification is documented as a future consumer in legacy and planning docs.
- `project-scan-report.json` records the generated-doc workflow status.
- Workflow version is `1.2.0`.
- Timestamps show `started` and `last_updated` as `2026-04-17T17:26:33Z`.
- Mode is `initial_scan` and scan level is `deep`.
- Current step is `complete`.
- Completed steps are: step 1 generated `docs/project-parts.json`, `docs/project-overview.md`, `docs/source-tree-analysis.md`, `docs/integration-architecture.md`, and `docs/index.md`; step 2 generated `docs/architecture-api-gateway.md`, `docs/development-guide-api-gateway.md`, `docs/api-contracts-api-gateway.md`, and `docs/data-models-api-gateway.md`; step 3 generated `docs/architecture-cv-parser.md`, `docs/development-guide-cv-parser.md`, and `docs/data-models-cv-parser.md`; step 4 generated `docs/architecture-notification.md` and `docs/development-guide-notification.md`.
- Findings report the repository classification as a multi-part monorepo, three-part polyglot microservice backend with TypeScript and Java as the main languages.
- Technology stack findings are: API Gateway uses NestJS 11, Prisma, PostgreSQL, Redis, RabbitMQ, and S3-compatible storage; CV Parser uses Spring Boot 3.3, Java 17, RabbitMQ, JPA, PDFBox, POI, Tess4J, Tika, and Resilience4j; Notification is a planned NestJS notification service.
- Batch summaries say 9 files were scanned for `api-gateway`, 9 files for `cv-parser`, and 2 files for `notification`.
- `outputs_generated` are `docs/project-parts.json`, `docs/project-overview.md`, `docs/source-tree-analysis.md`, `docs/integration-architecture.md`, `docs/index.md`, `docs/architecture-api-gateway.md`, `docs/development-guide-api-gateway.md`, `docs/api-contracts-api-gateway.md`, `docs/data-models-api-gateway.md`, `docs/architecture-cv-parser.md`, `docs/development-guide-cv-parser.md`, `docs/data-models-cv-parser.md`, `docs/architecture-notification.md`, and `docs/development-guide-notification.md`.
- `resume_instructions` say to resume from `current_step=complete` only if a post-generation update is needed; otherwise the documentation set is complete.
- `validation_status` shows `last_validated` as `2026-04-17T17:26:33Z` and `validation_errors` empty.
- `deep_dive_targets` is empty.
- The BMAD docs index is complete and the current docs set is intended to be the single source of truth for AI-assisted work in this repository.
