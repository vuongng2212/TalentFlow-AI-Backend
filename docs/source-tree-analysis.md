# TalentFlow AI Backend - Source Tree Analysis

**Date:** 2026-05-01

## Overview

The repository is organized as a multi-part backend with two runtime services and one partial runtime scaffold. Runtime truth comes from the service folders and infrastructure files.

## Complete directory structure

```text
TalentFlow-AI-Backend/
├── api-gateway/                  # NestJS HTTP API and orchestration layer
├── cv-parser/                    # Spring Boot CV parsing worker
├── notification/                 # NestJS notification scaffold and planning artifacts
├── docs/                         # Generated brownfield documentation
├── _bmad/                        # BMAD configuration and generated context
├── _bmad-output/                 # BMAD workflow artifacts
├── docker-compose.yml            # Local infrastructure and API Gateway
├── k8s/                          # Kubernetes manifests currently centered on API Gateway
└── README.md                     # Repository-level overview
```

## Critical directories

### `api-gateway/`

- **Purpose:** Main runtime service for the ATS backend.
- **Contains:** Auth, users, jobs, candidates, applications, interviews, workspaces, analytics, health, metrics, queue, storage, Prisma, tests.
- **Entry points:** `src/main.ts`, `src/app.module.ts`
- **Notable config:** `package.json`, `.env.example`, `prisma/schema.prisma`

### `api-gateway/src/`

- **Purpose:** Feature-based NestJS modules and shared infrastructure.
- **Contains:** Controllers, services, guards, interceptors, filters, config, queue, Redis, Prisma, and storage integration.
- **File organization pattern:** feature modules with cross-cutting code in `common/`.

### `api-gateway/prisma/`

- **Purpose:** Database schema and migrations for the ATS domain.
- **Contains:** `schema.prisma`, seed script, generated client output target.

### `api-gateway/test/`

- **Purpose:** E2E and integration-oriented tests.
- **Contains:** Jest E2E setup and scenario tests.

### `cv-parser/`

- **Purpose:** Queue-driven CV parsing worker.
- **Contains:** Spring Boot app, RabbitMQ listener, parser pipeline, extractor, repository placeholder, shared DTOs, Actuator config, tests.
- **Entry points:** `src/main/java/com/talentflow/cvparser/CvParserApplication.java`, `src/main/java/com/talentflow/cvparser/listener/CvParserListener.java`
- **Notable config:** `pom.xml`, `src/main/resources/application.yml`

### `cv-parser/src/main/java/com/talentflow/cvparser/`

- **Purpose:** Java service implementation.
- **Contains:** `listener/`, `usecase/`, `parser/`, `extractor/`, `repository/`, `shared/`.
- **Pattern:** package-by-responsibility with event DTOs under `shared/dto`.

### `cv-parser/src/main/resources/`

- **Purpose:** Runtime configuration.
- **Contains:** `application.yml` and profile-specific settings for RabbitMQ, storage, OCR, LLM, Actuator, and resilience.

### `notification/`

- **Purpose:** Partial NestJS notification service scaffold.
- **Contains:** app bootstrap, auth, health, config, Prisma, RabbitMQ, email, and notification modules.
- **Status:** Runtime source tree exists, but delivery and consumer flows are still incomplete.

### `docs/`

- **Purpose:** Generated brownfield documentation in English.
- **Contains:** project overview, index, source tree analysis, per-service architecture, development guides, data models, API contracts, integration architecture, and workflow metadata.

### `docker-compose.yml`

- **Purpose:** Local infrastructure and current API Gateway runtime composition.
- **Contains:** PostgreSQL, Redis, RabbitMQ, MinIO, MinIO setup, and API Gateway service.
- **Observation:** CV Parser and Notification are not started by this compose file.

### `k8s/`

- **Purpose:** Kubernetes deployment assets.
- **Contains:** manifests currently centered on the API Gateway.

## Entry points

### API Gateway

- `api-gateway/src/main.ts`
- `api-gateway/src/app.module.ts`

### CV Parser

- `cv-parser/src/main/java/com/talentflow/cvparser/CvParserApplication.java`
- `cv-parser/src/main/java/com/talentflow/cvparser/listener/CvParserListener.java`

### Notification

- None yet in the current snapshot.

## File organization patterns

- **API Gateway:** feature-first NestJS modules (`auth`, `jobs`, `applications`, `candidates`, `interviews`, `workspaces`, `analytics`) with shared cross-cutting concerns in `common/`.
- **CV Parser:** responsibility-oriented Java packages (`listener`, `usecase`, `parser`, `extractor`, `repository`, `shared`).
- **Notification:** feature-first NestJS scaffold with runtime bootstrap and incomplete delivery modules.

## Key file types

### TypeScript service files

- Pattern: `api-gateway/src/**/*.ts`
- Purpose: HTTP controllers, services, guards, interceptors, utilities
- Examples: `main.ts`, `app.module.ts`, `applications.controller.ts`, `queue.service.ts`

### Java service files

- Pattern: `cv-parser/src/main/java/**/*.java`
- Purpose: worker pipeline, RabbitMQ listener, parsers, extractors, DTOs
- Examples: `CvParserListener.java`, `RabbitMqConfig.java`, `CvUploadedEvent.java`

### Configuration files

- `docker-compose.yml` - local infrastructure and gateway runtime
- `api-gateway/package.json` - NestJS scripts and dependencies
- `api-gateway/.env.example` - gateway environment contract
- `api-gateway/prisma/schema.prisma` - database model
- `cv-parser/pom.xml` - Maven build and dependencies
- `cv-parser/src/main/resources/application.yml` - worker runtime configuration

### Documentation files

- `docs/*.md` - generated brownfield docs

## Notes for development

- The root compose file should not be assumed to start every service in the repo.
- The API Gateway is the canonical HTTP surface for the implemented system.
- CV Parser is operationally separate and must be run with Maven/Spring tooling.
- Notification should be treated as a runtime scaffold: executable, but not feature-complete.
