# API Gateway Architecture

**Status:** Implemented
**Entry points:** `src/main.ts`, `src/app.module.ts`

## Purpose

The API Gateway is the primary HTTP surface of TalentFlow AI Backend. It owns authentication, CRUD APIs for ATS resources, file upload orchestration, queue publishing, storage integration, and the health/metrics surface.

## Runtime pipeline

1. `NestFactory.create()` boots the application.
2. Logging is attached via `ElkLoggerService` when `ELK_HOST` is configured, otherwise Nest's logger is used.
3. The global prefix is set to `/api/v1` with `health`, `ready`, and `metrics` excluded.
4. Security middleware is applied: `helmet`, `hpp`, `cookieParser`, CORS, and body size limits.
5. A global `ValidationPipe` enforces whitelist and non-whitelisted rejection.
6. Global interceptors apply request logging and response transformation.
7. A global exception filter normalizes HTTP errors.
8. Swagger is mounted when enabled.
9. The app listens on `PORT` (default `8080`).

## Module layout

| Module | Responsibility |
|---|---|
| AuthModule | Signup, login, refresh, logout, current-user lookup |
| UsersModule | User management and role updates |
| JobsModule | Job CRUD |
| CandidatesModule | Candidate CRUD |
| ApplicationsModule | Application CRUD and CV upload orchestration |
| InterviewsModule | Interview scheduling and maintenance |
| WorkspacesModule | Workspace and membership management |
| AnalyticsModule | Pipeline and operational summaries |
| HealthModule | Liveness and readiness probes |
| MetricsModule | Prometheus metrics endpoint |
| PrismaModule | Database access |
| RedisModule | Cache and Redis connectivity |
| StorageModule | S3-compatible object storage |
| QueueModule | RabbitMQ connection and publishing |
| LoggerModule | Structured logging |
| AppConfigModule | Config validation and environment access |

## Security model

- `JwtAuthGuard`, `RolesGuard`, and `ThrottlerGuard` are applied globally.
- Public routes are explicitly decorated with `@Public()`.
- Auth uses access and refresh token cookies.
- `class-validator` DTOs are enforced globally.
- Environment-based config is validated at startup.
- Upload routes use file validation and storage-backed keys rather than arbitrary URLs.

## Integration points

### PostgreSQL
Prisma owns the ATS domain models: users, jobs, candidates, applications, interviews, workspaces, and workspace members.

### Redis
Used as a runtime dependency for cache and supporting infrastructure.

### RabbitMQ
The gateway publishes CV upload events to `talentflow.events` with routing key `cv.uploaded`.

### S3-compatible storage
CV files are written to object storage and referenced by bucket plus file key.

### Observability
- Health: `/health`
- Readiness: `/ready`
- Metrics: `/metrics`
- Swagger: `/api/docs`
- JSON spec: `/api-json`

## Main API groups

| Route group | Status | Notes |
|---|---|---|
| `/api/v1/auth` | Implemented | Cookie-based auth flow |
| `/api/v1/users` | Implemented | User and role management |
| `/api/v1/jobs` | Implemented | Job CRUD |
| `/api/v1/candidates` | Implemented | Candidate CRUD |
| `/api/v1/applications` | Implemented | Application CRUD and CV upload |
| `/api/v1/interviews` | Implemented | Interview CRUD |
| `/api/v1/workspaces` | Implemented | Workspace and membership management |
| `/api/v1/analytics` | Implemented | Pipeline and trend views |
| `/health`, `/ready`, `/metrics` | Implemented | Excluded from the global prefix |

## Request/response conventions

- Responses are transformed into a common envelope by the global interceptor.
- Pagination endpoints return `data` plus `meta`.
- Errors are thrown as Nest HTTP exceptions and normalized by the global filter.
- Upload endpoints return processing metadata immediately; parsing continues asynchronously.

## API-level integration details

### CV upload flow
`POST /api/v1/applications/upload` validates the file, stores it in object storage, creates the application record, and publishes a `cv.uploaded` event.

### Status and auth flow
- `POST /api/v1/auth/login` sets cookies.
- `POST /api/v1/auth/refresh` rotates tokens.
- `POST /api/v1/auth/logout` clears cookies and revokes the token context.

## Operational notes

- The gateway is the only service started by the root compose file alongside infrastructure.
- CV Parser and Notification are operationally separate.
- The global prefix and health exclusions are important when writing docs or testing endpoints.
