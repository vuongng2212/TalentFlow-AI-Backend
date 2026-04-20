# Notification Development Guide

**Status:** Planned only

## Current situation

There is no runtime notification service in the current repository snapshot. This guide documents the intended direction from the legacy planning material, not an already-working application.

## Planned stack

- NestJS
- RabbitMQ consumer
- Socket.IO gateway
- Email via SMTP
- Prisma + PostgreSQL
- Redis for WebSocket scaling

## Intended setup flow

If and when the service is implemented, the expected path is:

1. Create the service runtime folder and package manifest.
2. Add environment validation.
3. Wire RabbitMQ, SMTP, and WebSocket support.
4. Add notification history persistence.
5. Add health and metrics endpoints.
6. Add unit and integration tests.

## Planning-only notes

- Do not try to run this service from the current snapshot; there is no executable entry point yet.
- Use the event contracts in `docs/integration-architecture.md` as the starting point for future work.
- Keep the service aligned with the shared RabbitMQ exchange and the existing ATS domain events.

## Suggested future commands

These are placeholders for a later implementation and should not be treated as current commands:

- install dependencies
- run the app in watch mode
- run unit and integration tests
- connect to RabbitMQ and Redis

## What to verify once the service exists

- Auth and authorization boundaries
- Event consumption from RabbitMQ
- Idempotent processing for duplicate events
- Email delivery and retry behavior
- Socket.IO client connection and room membership
- Persistence of notification history
