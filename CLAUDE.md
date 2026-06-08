# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TalentFlow AI is a backend system for an Applicant Tracking System (ATS) using a polyglot 3-service architecture:
1.  **API Gateway (NestJS)**: Main entry point, Auth, Jobs, Applications.
2.  **CV Parser (Java/Spring Boot)**: Handles file parsing and AI scoring (currently in `cv-parser/`).
3.  **Notification Service (C#/.NET)**: Handles emails and WebSockets (currently in `notification/`).

Infrastructure includes PostgreSQL, Redis, and MinIO (local S3) managed via Docker Compose.

## Build & Run

### Infrastructure
Start required services (Postgres, Redis, MinIO) before running applications:
```bash
docker-compose up -d
```

### API Gateway (`api-gateway/`)
Primary development happens here.

-   **Install**: `npm install`
-   **Dev Server**: `npm run start:dev` (starts on port 3000)
-   **Build**: `npm run build`
-   **Database**:
    -   Generate client: `npx prisma generate`
    -   Migrate: `npx prisma migrate dev`
    -   Seed: `npx prisma db seed`
    -   Studio: `npx prisma studio`

## Testing (`api-gateway/`)

-   **Unit Tests**: `npm run test`
    -   Run single test: `npx jest src/path/to/test.spec.ts`
-   **E2E Tests**: `npm run test:e2e`
-   **Coverage**: `npm run test:cov`

## Code Quality

-   **Lint**: `npm run lint` (ESLint)
-   **Format**: `npm run format` (Prettier)

## Architecture & Structure

-   **Framework**: NestJS with Prisma ORM.
-   **Entry Point**: `src/main.ts` configures global pipes (validation), interceptors (logging, transformation), and Swagger.
-   **Global Guards**: configured in `src/app.module.ts`:
    -   `JwtAuthGuard`: Protects all routes by default. Use `@Public()` decorator to bypass.
    -   `RolesGuard`: Enforces RBAC using `@Roles(Role.ADMIN)` decorator.
    -   `ThrottlerGuard`: Rate limiting.
-   **Modules**: Feature-based modules in `src/modules/` (auth, users, jobs, applications).
-   **Configuration**: `ConfigModule` loads from `.env`.
-   **Documentation**: Swagger available at `/api/docs` when running.

## Development Guidelines

1.  **Database Changes**: Always update `prisma/schema.prisma` and run `npx prisma migrate dev` to create a migration file. Do not edit migrations manually unless necessary.
2.  **DTOs**: Use class-validator decorators in DTOs. Validation is globally enabled with `whitelist: true`.
3.  **Typing**: Do not use `any` for variable, payload, or response shape definitions. Prefer dedicated DTOs, `type`, or `interface` declarations with explicit fields.
4.  **Nested Shapes**: When a request body contains nested structured data, create a nested DTO instead of using inline object literals or `any`.
5.  **Error Handling**: Use standard NestJS HTTP exceptions (`NotFoundException`, `BadRequestException`). Global filters handle responses.
6.  **Response Format**: Responses are automatically transformed to `{ data: ... }` format via `TransformInterceptor`.
7.  **Environment**: Ensure `.env` is configured (copy from `.env.example`).
8.  **Static Config Values**: Any static property value must be moved to `.env`, validated in `src/common/config/config.schema.ts`, and consumed via `ConfigService`.
9.  **Swagger Enum Documentation**: When documenting enum fields with `@ApiProperty`/`@ApiPropertyOptional`, always provide `enumName` and a clear `description` to make API docs explicit and reusable.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
