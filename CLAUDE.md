# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TalentFlow AI is a backend system for an Applicant Tracking System (ATS) using a polyglot 3-service architecture:
1.  **API Gateway (NestJS)**: Main entry point, Auth, Jobs, Applications.
2.  **CV Parser (Java/Spring Boot or C#/.NET)**: Handles file parsing and AI scoring (currently in `cv-parser/`).
3.  **Notification Service (Node/NestJS or C#/.NET)**: Handles emails and WebSockets (currently in `notification/`).

Infrastructure includes PostgreSQL, Redis, and MinIO (local S3) managed via Docker Compose.

## Build & Run

### Infrastructure
Start required services (Postgres, Redis, MinIO) before running applications:
```bash
docker-compose up -d
```

### API Gateway (`api-gateway/`)
Primary development happens here.

-   **Install**: `pnpm install`
-   **Dev Server**: `pnpm run start:dev` (starts on port 3000)
-   **Build**: `pnpm run build`
-   **Database**:
    -   Generate client: `npx prisma generate`
    -   Migrate: `npx prisma migrate dev`
    -   Seed: `npx prisma db seed`
    -   Studio: `npx prisma studio`

## Testing (`api-gateway/`)

-   **Unit Tests**: `pnpm run test`
    -   Run single test: `npx jest src/path/to/test.spec.ts`
-   **E2E Tests**: `pnpm run test:e2e`
-   **Coverage**: `pnpm run test:cov`

## Code Quality

-   **Lint**: `pnpm run lint` (ESLint)
-   **Format**: `pnpm run format` (Prettier)

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
3.  **Error Handling**: Use standard NestJS HTTP exceptions (`NotFoundException`, `BadRequestException`). Global filters handle responses.
4.  **Response Format**: Responses are automatically transformed to `{ data: ... }` format via `TransformInterceptor`.
5.  **Environment**: Ensure `.env` is configured (copy from `.env.example`).
