---
project_name: 'TalentFlow-AI-Backend'
user_name: 'VuongNguyen'
date: '2026-04-17'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 49
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains the non-obvious rules and patterns AI agents must follow in this repository. Prefer codebase truth over older docs when they conflict._

---

## Technology Stack & Versions

- **API Gateway (`api-gateway/`)**
  - NestJS `^11.0.1`
  - TypeScript `^5.7.3` with `module`/`moduleResolution` = `nodenext`
  - Prisma `6.7.0` / `@prisma/client` `6.7.0`
  - Jest `^30.0.0`, `ts-jest` `^29.2.5`
  - ESLint `^9.18.0`, Prettier `^3.4.2`
  - Passport JWT, class-validator, class-transformer, Redis, RabbitMQ, S3, Elasticsearch, Winston, Prometheus
- **CV Parser (`cv-parser/`)**
  - Spring Boot `3.3.0`
  - Java `17`
  - Spring AMQP, PDFBox, Apache POI, Tess4J, Tika
- **Local infrastructure**
  - PostgreSQL `16`
  - Redis `7`
  - RabbitMQ `3-management`
  - MinIO (S3-compatible dev storage)

## Critical Implementation Rules

### Language-Specific Rules

- TypeScript uses strict null safety and explicit types on public/shared APIs; avoid new `any` and narrow `unknown` from external input.
- Keep NodeNext import/export semantics intact; do not change module resolution patterns casually.
- Java code targets Java `17` only; keep queue/event payloads strongly typed.
- Never mutate inbound DTOs or message objects; map into new objects before transforming them.
- Fail fast at system boundaries instead of carrying invalid state deeper into the app.

### Framework-Specific Rules

- NestJS routes are prefixed with `api/v1`, excluding `health`, `ready`, and `metrics`.
- Global `ValidationPipe` stays strict: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`, `validateCustomDecorators: true`.
- Global interceptors run as `RequestLoggerInterceptor` then `TransformInterceptor`.
- `HttpExceptionFilter` owns sanitized error payloads; do not leak internal details in production.
- Global guards are `JwtAuthGuard`, `RolesGuard`, and `ThrottlerGuard`; opt out explicitly with `@Public()` when needed.
- Auth is cookie-based JWT with Redis-backed refresh rotation/blacklist and 5-failure lockout.
- DTOs rely on `class-validator` + `class-transformer`; query/pagination DTOs coerce numbers with `@Type(() => Number)`.
- Prisma services query directly with `select`/`include`; default to soft-delete via `deletedAt` filters. `Candidate` is the hard-delete exception.
- Upload handling accepts only PDF/DOCX with signature checks and a 10MB cap.
- Logs are sanitized/redacted; use the project logger, not `console`.
- Spring Boot listeners use manual ack, retry/backoff, JSON conversion, and DLQ routing for `talentflow.events` / `cv_parser.jobs` / `cv_parser.jobs.dlq`.
- Queue events carry `bucket + fileKey`; do not reintroduce `fileUrl`.

### Testing Rules

- Keep the 80%+ coverage target in mind for touched modules.
- Use TDD for non-trivial changes: RED → GREEN → REFACTOR.
- Keep unit, integration, and E2E boundaries separate.
- Jest is the current E2E baseline in this repo; do not assume Playwright unless the repo adds it.
- Validate queue/event behavior with integration tests, not only mocked unit tests.

### Code Quality & Style Rules

- Prefer immutable updates; never mutate existing objects in place.
- Keep files focused and functions small; split large modules instead of letting them grow.
- Handle errors explicitly and do not swallow failures.
- Validate all external input at boundaries: HTTP payloads, queue payloads, file metadata, and external API responses.
- Avoid `console.log` in production code; use the structured logging facilities already in the repo.
- Keep operational values in config/env, not hardcoded in implementation.
- Follow the repo’s ESLint and Prettier settings exactly.

### Development Workflow Rules

- Plan first, then TDD, then code review, then commit.
- Use conventional commit messages: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.
- Review the full branch scope before PRs; use `git diff [base-branch]...HEAD`.
- Include a concrete test plan in PR descriptions.
- Prefer existing patterns and reusable modules before introducing new abstractions.
- Use upstream tracking when pushing a new branch.

### Critical Don't-Miss Rules

- Never hardcode secrets or credentials.
- Never bypass validation, auth, or role guards.
- Never use `fileUrl` in CV-processing events; use `bucket + fileKey`.
- Keep error responses sanitized and non-revealing.
- Preserve retry and DLQ safeguards for queue consumers.
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

Last Updated: 2026-04-17
