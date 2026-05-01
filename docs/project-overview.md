# TalentFlow AI Backend - Project Overview

**Date:** 2026-05-01
**Repository type:** Multi-part monorepo
**Architecture:** Polyglot microservice backend

## Executive summary

TalentFlow AI Backend is an ATS backend split across three parts: an implemented NestJS API Gateway, a partially implemented Spring Boot CV Parser worker, and a partially implemented NestJS Notification scaffold. The current codebase already supports authentication, jobs, applications, workspaces, analytics, health/metrics, file upload to S3-compatible storage, RabbitMQ-based CV processing, and a notification runtime shell with health checks and a sample lookup route.

## Project classification

| Dimension            | Value                                                               |
| -------------------- | ------------------------------------------------------------------- |
| Repository type      | Multi-part monorepo                                                 |
| Parts                | 3                                                                   |
| Primary languages    | TypeScript, Java                                                    |
| Architecture pattern | Polyglot service architecture                                       |
| Current maturity     | API Gateway: implemented; CV Parser: partial; Notification: planned |

## Part summary

### API Gateway

- **Location:** `api-gateway/`
- **Stack:** NestJS 11, Prisma, PostgreSQL, Redis, RabbitMQ, S3-compatible storage
- **Entry point:** `api-gateway/src/main.ts`
- **Role:** Main HTTP entry point and orchestration layer

### CV Parser

- **Location:** `cv-parser/`
- **Stack:** Spring Boot 3.3, Java 17, Spring AMQP, JPA, PDFBox, POI, Tess4J, Tika, Resilience4j
- **Entry point:** `cv-parser/src/main/java/com/talentflow/cvparser/CvParserApplication.java`
- **Role:** Queue-driven document parsing and scoring worker

### Notification

- **Location:** `notification/`
- **Stack:** NestJS 10, Prisma, PostgreSQL, Redis, RabbitMQ, Socket.IO, SMTP
- **Entry point:** `notification/src/main.ts`
- **Role:** Runtime notification scaffold for future email, WebSocket, and notification history features

## Key features

- JWT authentication with access/refresh token cookies
- Role-based access control and request throttling
- Jobs, candidates, applications, interviews, and workspaces
- CV upload to S3-compatible storage with asynchronous parsing
- RabbitMQ topic exchange for service-to-service events
- Health, readiness, and Prometheus metrics endpoints
- Prisma data model for the ATS domain
- CV parsing with PDF/DOCX/OCR fallback and failure events

## Architecture highlights

- The API Gateway is the only HTTP-facing runtime in the current implementation.
- `api-gateway/src/main.ts` sets the global prefix to `/api/v1` and excludes `health`, `ready`, and `metrics` from that prefix.
- `docker-compose.yml` starts infrastructure and the API Gateway, but not the CV Parser or Notification service.
- `cv-parser/src/main/java/com/talentflow/cvparser/listener/CvParserListener.java` uses manual ACK/NACK and publishes `cv.failed` when parsing fails.
- `cv-parser/src/main/java/com/talentflow/cvparser/repository/NoOpCvParseResultRepository.java` shows that persistence is not yet implemented.
- Notification is still documentation-driven and should not be treated as runnable.

## Technology stack summary

| Part         | Framework              | Supporting systems                                                              |
| ------------ | ---------------------- | ------------------------------------------------------------------------------- |
| API Gateway  | NestJS 11              | Prisma, PostgreSQL, Redis, RabbitMQ, S3-compatible storage, Swagger, Prometheus |
| CV Parser    | Spring Boot 3.3        | RabbitMQ, PostgreSQL, S3-compatible storage, OCR, Resilience4j, Actuator        |
| Notification | Planned NestJS service | RabbitMQ, Redis adapter, SMTP, Socket.IO, PostgreSQL (planned)                  |

## Getting started

### Local infrastructure

```bash
docker-compose up -d
```

### API Gateway

```bash
cd api-gateway
npm install
npx prisma generate
npm run db:migrate
npm run start:dev
```

### CV Parser

```bash
cd cv-parser
mvn test
mvn spring-boot:run
```

### Notification

- Runtime entry point exists in `notification/src/main.ts`, but the service is still a scaffold rather than a finished notification platform.

## Documentation map

- [Index](./index.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [API Gateway Architecture](./architecture-api-gateway.md)
- [API Gateway Development Guide](./development-guide-api-gateway.md)
- [API Gateway API Contracts](./api-contracts-api-gateway.md)
- [API Gateway Data Models](./data-models-api-gateway.md)
- [CV Parser Architecture](./architecture-cv-parser.md)
- [CV Parser Development Guide](./development-guide-cv-parser.md)
- [CV Parser Data Models](./data-models-cv-parser.md)
- [Notification Architecture](./architecture-notification.md)
- [Notification Development Guide](./development-guide-notification.md)
- [Integration Architecture](./integration-architecture.md)
