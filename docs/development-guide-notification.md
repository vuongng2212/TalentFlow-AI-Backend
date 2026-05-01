# Notification Development Guide

**Status:** Partial runtime scaffold

## Current situation

The notification service boots as a NestJS app shell with JWT auth, health checks, and a sample `GET /api/notifications/:id` endpoint. The email, RabbitMQ consumer, and Socket.IO fan-out files exist as scaffolding, but the production notification workflows are not wired yet.

## Local setup

1. `cd notification`
2. `npm install`
3. Copy `.env.example` to `.env`
4. `npm run start:dev`
5. `npm test`

## Useful commands

| Command | Purpose |
|---|---|
| `npm run start:dev` | Start the app shell in watch mode |
| `npm run build` | Build the NestJS app |
| `npm test` | Run unit and integration tests |
| `npm run test:e2e` | Run e2e tests |
| `npm run test:cov` | Generate coverage |

## Runtime configuration

The service reads config from `src/config/*.ts` and validates environment values through `src/config/validation.schema.ts`.

### Application
- `NODE_ENV`
- `PORT`
- `APP_NAME`
- `APP_URL`
- `CORS_ORIGIN`
- `WS_CORS_ORIGIN`

### JWT
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `JWT_ISSUER`
- `JWT_AUDIENCE`

### Database
- `DATABASE_URL`

### Redis
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`

### RabbitMQ
- `RABBITMQ_URL`
- `RABBITMQ_QUEUE`
- `RABBITMQ_EXCHANGE`
- `RABBITMQ_PREFETCH_COUNT`

### SMTP
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

## Local URLs

- Health: `http://localhost:5000/health`
- Readiness: `http://localhost:5000/health/ready`
- Liveness: `http://localhost:5000/health/live`

## Development notes

- `GET /api/notifications/:id` currently returns sample data from `notification.service.ts`.
- `HealthModule` checks both PostgreSQL and RabbitMQ connectivity.
- The RabbitMQ consumer, email sender, and WebSocket gateway are placeholder files today.
- Keep JWT issuer/audience aligned with the API Gateway.
- Do not treat notification delivery as complete until the placeholder modules are implemented and wired into `AppModule`.

## Verification checklist

- `npm run build` succeeds
- `npm test` succeeds
- `GET /health` returns OK
- `GET /api/notifications/:id` works with a JWT
- Startup config validation passes with the expected environment variables
