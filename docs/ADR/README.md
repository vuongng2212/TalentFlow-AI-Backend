# TalentFlow AI Canonical ADR Set

This folder is the active source of truth for architecture decisions in this repository.

Only current, code-verified ADRs live here.

## How To Use

1. Read this README first.
2. Read the ADR that matches the decision area you are touching.
3. Treat the live codebase and runtime contracts as the final verifier.

## Active Decisions

| ADR                                                                              | Decision                                                                                       | Scope                                                      |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [ADR-001: Prisma ORM](./ADR-001-prisma-orm.md)                                   | Prisma ORM for PostgreSQL-backed services                                                      | api-gateway, notification                                  |
| [ADR-002: Containerized Deployment Strategy](./ADR-002-deployment-strategy.md)   | Docker Compose and service containers as the runtime baseline                                  | api-gateway, cv-parser, notification, local infrastructure |
| [ADR-003: Backend Repository Boundary](./ADR-003-backend-repository-boundary.md) | Keep backend services in this repository and treat frontend code as external to this workspace | backend repository boundary                                |
| [ADR-004: Hybrid Microservices](./ADR-004-hybrid-microservices.md)               | Polyglot 3-service backend with NestJS, Spring Boot, and RabbitMQ integration                  | api-gateway, cv-parser, notification                       |
| [ADR-005: Cloudflare R2 Storage](./ADR-005-cloudflare-r2-storage.md)             | S3-compatible storage with Cloudflare R2 in production and MinIO locally                       | api-gateway, cv-parser, local infrastructure               |
| [ADR-006: RabbitMQ Polyglot Messaging](./ADR-006-rabbitmq-polyglot-messaging.md) | RabbitMQ as the inter-service broker with explicit routing and DLQ behavior                    | api-gateway, cv-parser, notification                       |

## Project Snapshot

- API Gateway: NestJS
- CV Parser: Java / Spring Boot
- Notification: NestJS
- Database: PostgreSQL with Prisma in the services that persist data
- Message broker: RabbitMQ
- Object storage: Cloudflare R2 in production, MinIO locally
- Local runtime: Docker Compose

## Canonical Rules

- Preserve the `bucket` plus `fileKey` contract for CV upload events.
- Keep queue routing and consumer defaults aligned with runtime config.
- Keep storage and deployment decisions container-first and environment-driven.
- Keep this folder limited to current, verified decisions only.
