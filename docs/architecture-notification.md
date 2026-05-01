# Notification Architecture

**Status:** Partial runtime scaffold
**Entry points:** `src/main.ts`, `src/app.module.ts`, `src/notification/notification.controller.ts`, `src/health/health.controller.ts`

## Purpose

Notification is the NestJS shell for future email, WebSocket, and notification-history features. The current codebase boots a real service, exposes health probes, wires JWT auth, and serves a stub notification lookup route, but the delivery and consumer modules are still incomplete.

## Current maturity

- The app boots with `ConfigModule`, Winston logging, `HealthModule`, and `NotificationModule`.
- JWT auth strategy and guards exist.
- Prisma and RabbitMQ health wiring are present through `HealthModule`.
- `GET /api/notifications/:id` returns a sample DTO from `notification.service.ts`.
- `email.service.ts`, `notification.gateway.ts`, and `rabbitmq/notification.consumer.ts` are currently empty placeholders.
- Notification history persistence is represented by a Prisma schema, but no real repository logic is wired yet.

## Current HTTP and operational surface

| Area | Current state |
|---|---|
| HTTP API | `GET /api/notifications/:id` guarded by JWT |
| Health | `/health`, `/health/ready`, `/health/live` |
| Database | Prisma service and `notifications` schema exist |
| Messaging | RabbitMQ connection and health checks exist; consumer flow is not implemented |
| Real-time | Socket.IO support is scaffolded but not wired |
| Email | SMTP config and service scaffold exist, but delivery flow is not wired |

## Intended responsibilities

According to the legacy planning material, the final service should:

- Send transactional email
- Push real-time notifications to clients
- Store notification history
- Consume RabbitMQ events from the ATS backend

## Intended integration points

| Integration | Planned role |
|---|---|
| RabbitMQ | Consume `application.created`, `cv.parsed`, `cv.failed`, and `notification.send` |
| PostgreSQL | Store notification history |
| Redis | Support Socket.IO scaling |
| SMTP | Send email |
| Socket.IO | Real-time client push |

## Recommended interpretation

Treat this repository area as a scaffolded runtime shell. It is useful for bootstrapping auth, health, and persistence work, but it is not yet a complete notification platform.
