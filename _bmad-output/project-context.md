---
project_name: 'TalentFlow-AI-Backend'
user_name: 'VuongNguyen'
date: '2026-04-29'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 81
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains the non-obvious rules and patterns AI agents must follow in this repository. Prefer codebase truth over older docs when they conflict._

---

## Technology Stack & Versions

- **API Gateway (`api-gateway/`)**
  - NestJS `11.0.1`
  - TypeScript `5.9.3` with `module`/`moduleResolution` = `nodenext`
  - Prisma `6.7.0` / `@prisma/client` `6.7.0`
  - Jest `30.0.0`, ESLint `9.18.0`, Prettier `3.4.2`
  - `@nestjs/swagger` `11.2.6`, `@nestjs/terminus` `11.0.0`, `@willsoto/nestjs-prometheus` `6.1.0`
  - Passport JWT, class-validator, class-transformer, Redis, RabbitMQ, MinIO/S3, Winston

- **Notification (`notification/`)**
  - NestJS `10.4.22`
  - TypeScript `5.9.3` with `module` = `commonjs` and `target` = `ES2021`
  - Prisma `5.22.0`
  - Jest `29.7.0`, nest-winston `1.10.2`, `@nestjs/websockets`, `@nestjs/platform-socket.io`, Redis adapter
  - RabbitMQ, Joi config validation

- **CV Parser (`cv-parser/`)**
  - Spring Boot `3.3.0`
  - Java `17`
  - Spring AMQP, JPA, WebFlux, Validation
  - PDFBox `3.0.1`, Apache POI `5.2.5`, Tess4J `5.10.0`, Tika `2.9.1`
  - Resilience4j `2.2.0`, JSON Schema Validator `1.3.3`

- **Local infrastructure**
  - PostgreSQL `16`
  - Redis `7`
  - RabbitMQ `3-management`
  - MinIO

## Critical Implementation Rules

### Language-Specific Rules

- In `api-gateway`, keep NodeNext import/export semantics intact and preserve strict null safety (`strictNullChecks`, `noImplicitAny`).
- In `notification`, treat the package as CommonJS/ES2021; do not assume NodeNext-only module behavior there.
- In `cv-parser`, target Java `17` only and keep queue/event payloads strongly typed.
- Coerce numeric query params with `@Type(() => Number)` in DTOs instead of parsing inside controllers.
- For nested request bodies, use dedicated nested DTOs with `@ValidateNested()` plus `@Type(() => ...)`.
- Never mutate inbound DTOs or message payloads in place; map into new objects before transforming.
- Narrow external input from HTTP, queue, and file boundaries with explicit types instead of `any`.

### Framework-Specific Rules

- Keep the gateway HTTP surface under `api/v1`, excluding `health`, `ready`, and `metrics`.
- `ClsModule` generates correlation IDs from `x-correlation-id` or `randomUUID`; keep correlation-aware logging intact.
- Keep the global `ValidationPipe` strict: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`, `validateCustomDecorators: true`.
- Keep request logging, metrics, and response shaping wired centrally through global interceptors instead of per-controller wrappers.
- `TransformInterceptor` wraps success responses as `{ status, message, data, timestamp }`; `HttpExceptionFilter` returns sanitized error payloads with `requestId`.
- Global guards are `JwtAuthGuard`, `RolesGuard`, and `ThrottlerGuard`; use `@Public()` only when intentional.
- Auth is cookie-based JWT with Redis-backed refresh rotation/blacklist and 5-failure lockout.
- Prisma services query directly with `select`/`include`; default to soft-delete via `deletedAt` filters. `Candidate` is the hard-delete exception.
- Swagger enum fields must include `enumName` and a clear `description`.
- Upload handling accepts only PDF/DOCX with signature checks and a 10MB cap.
- Notification bootstraps `ConfigModule` validation plus Winston logging, and its WebSocket JWT guard accepts handshake tokens or bearer headers.
- Spring Boot listeners use manual ack, retry/backoff, JSON conversion, and DLQ routing; keep queue payloads additive and preserve the storage-reference contract.

### Testing Rules

- Keep the 80%+ coverage target in mind for touched modules.
- Use TDD for non-trivial changes: RED → GREEN → REFACTOR.
- Keep unit, integration, and E2E boundaries separate.
- Jest is the E2E baseline for the Node services; do not assume Playwright unless the repo adds it.
- `api-gateway` and `notification` should keep service-local Jest tests aligned with their own package boundaries, while `cv-parser` uses the Spring Boot test stack (`spring-boot-starter-test`, `spring-rabbit-test`, `reactor-test`).
- Validate RabbitMQ, file-validation, auth, and guard behavior with integration tests, not only mocked unit tests.

### Code Quality & Style Rules

- Prefer immutable updates; never mutate existing objects in place.
- Keep files focused and functions small; split large modules instead of letting them grow.
- Handle errors explicitly and do not swallow failures.
- Validate all external input at boundaries: HTTP payloads, queue payloads, file metadata, and external API responses.
- Keep operational values in config/env, not hardcoded; add new static config to the relevant `config.schema.ts`.
- Avoid `console.log` in production code; use the structured logging facilities already in the repo.
- Follow the repo’s ESLint and Prettier settings exactly.
- When documenting enum fields with Swagger, always provide `enumName` and a clear `description`.

### Development Workflow Rules

- Plan first, then TDD, then code review, then commit.
- Use conventional commit messages: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.
- When schema changes touch PostgreSQL/Prisma models, update `prisma/schema.prisma` and generate migrations with `npx prisma migrate dev`; do not hand-edit migrations unless necessary.
- Review the full branch scope before PRs; use `git diff [base-branch]...HEAD`.
- Include a concrete test plan in PR descriptions.
- Prefer existing patterns and reusable modules before introducing new abstractions.
- Use upstream tracking when pushing a new branch.

### Critical Don't-Miss Rules

- Never hardcode secrets or credentials.
- Never bypass validation, auth, role guards, or upload file checks.
- Keep the response envelope from `TransformInterceptor` and the sanitized error payloads from `HttpExceptionFilter` stable.
- Keep cookie-based JWT auth with Redis-backed refresh rotation/blacklist and lockout intact.
- Keep upload handling constrained to PDF/DOCX with signature checks and a 10 MB cap.
- Keep queue payloads on `bucket + fileKey`; never reintroduce `fileUrl`.
- Preserve RabbitMQ retry/backoff/manual-ack/DLQ safeguards for consumers.
- Do not change event contracts without coordinated producer/consumer updates.
- Do not assume local-dev defaults are production-safe.
- Never silently swallow async failures; preserve traceability and emit explicit failure state.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing code here.
- Prefer repo reality over legacy documentation when they disagree.
- Use the most restrictive safe option when requirements are ambiguous.
- Update this file when durable stack or contract changes land.

**For Humans:**

- Keep this file lean and focused on non-obvious implementation rules.
- Refresh it when versions, queue contracts, auth flows, or validation rules change.
- Remove guidance once it becomes obvious from code or config.

Last Updated: 2026-04-29
