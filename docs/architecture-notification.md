# Notification Architecture

**Status:** Planned only

## Purpose

The Notification service is documented as the future home for email notifications, WebSocket push updates, and notification history. The current repository snapshot does not contain runtime code for the service.

## Current maturity

- Planning docs exist.
- No executable service entry point exists in the current snapshot.
- The service should not be treated as runnable or production-ready yet.

## Intended responsibilities

According to the planning docs, the service is expected to:

- Send transactional email
- Push real-time notifications to clients
- Store notification history
- Consume RabbitMQ events from the backend ecosystem

## Intended integration points

| Integration | Planned role |
|---|---|
| RabbitMQ | Consume `application.created`, `cv.parsed`, `cv.failed`, and `notification.send` |
| PostgreSQL | Store notification history |
| Redis | Support Socket.IO scaling |
| SMTP | Send email |
| Socket.IO | Real-time client push |

## Planning-doc architecture themes

The legacy planning material describes a modular NestJS service with:

- An HTTP API for notification history and actions
- A WebSocket gateway for authenticated push notifications
- A RabbitMQ consumer for backend events
- A Prisma-backed persistence layer
- JWT-based auth shared with the rest of the backend

## Important caution

The above are design intentions, not current runtime facts. Use them for future implementation planning only.

## Recommended interpretation

When reading this repository today, treat Notification as a service design area rather than a live service. Any future implementation should be checked against the current event contracts and the live code in `api-gateway/` and `cv-parser/`.
