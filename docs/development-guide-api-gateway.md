# API Gateway Development Guide

**Status:** Implemented

## Prerequisites

- Node.js 20+
- npm
- Docker and Docker Compose
- PostgreSQL, Redis, RabbitMQ, and MinIO available locally

## Local setup

### 1. Start infrastructure
```bash
docker-compose up -d
```

### 2. Install dependencies
```bash
cd api-gateway
npm install
```

### 3. Prepare the database
```bash
npx prisma generate
npm run db:migrate
```

### 4. Optional seed data
```bash
npm run db:seed
```

### 5. Start the service
```bash
npm run start:dev
```

## Useful commands

| Command | Purpose |
|---|---|
| `npm run build` | Build the NestJS app |
| `npm run start` | Run without watch mode |
| `npm run start:dev` | Run in watch mode |
| `npm run start:debug` | Run with the debugger attached |
| `npm run test` | Unit tests |
| `npm run test:e2e` | End-to-end tests |
| `npm run test:cov` | Coverage run |
| `npm run lint` | ESLint auto-fix |
| `npm run format` | Prettier formatting |
| `npm run swagger:generate` | Generate Swagger JSON and exit |
| `npm run docker:up` | Start root docker-compose stack |
| `npm run docker:down` | Stop root docker-compose stack |
| `npm run docker:logs` | Tail compose logs |

## Environment variables

The gateway reads environment values from `.env` based on `.env.example`.

### Application
- `NODE_ENV`
- `PORT`

### Database
- `DATABASE_URL`
- `DIRECT_URL`

### Cache and messaging
- `REDIS_URL`
- `RABBITMQ_URL`
- `RABBITMQ_HEARTBEAT_SEC`
- `RABBITMQ_RECONNECT_INITIAL_DELAY_MS`
- `RABBITMQ_RECONNECT_MAX_DELAY_MS`

### Auth
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRATION`
- `JWT_REFRESH_EXPIRATION`

### Storage
- `R2_ENDPOINT`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_URL`

### Security and observability
- `RATE_LIMIT_TTL_SEC`
- `RATE_LIMIT_MAX`
- `BODY_LIMIT_MB`
- `TIMEOUT_MS`
- `CORS_ORIGINS`
- `LOG_LEVEL`
- `ELK_HOST`
- `ELK_LOG_LEVEL`
- `ELK_INDEX_PREFIX`
- `QUEUE_METRICS_POLL_INTERVAL_MS`

## Local URLs

- API root: `http://localhost:8080/api/v1`
- Swagger UI: `http://localhost:8080/api/docs`
- Swagger JSON: `http://localhost:8080/api-json`
- Health: `http://localhost:8080/health`
- Readiness: `http://localhost:8080/ready`
- Metrics: `http://localhost:8080/metrics`

## Development notes

- Auth is cookie-based; test flows must preserve cookies across requests.
- The root compose file starts infra plus the gateway, not every service in the repo.
- CV upload triggers RabbitMQ publication, so local testing needs RabbitMQ and object storage online.
- Use the global prefix when calling most endpoints; health, readiness, and metrics are the exceptions.
- Keep Prisma migrations in sync with `schema.prisma`.

## Verification checklist

- `npm run build` passes
- `npm run test` passes
- `npm run test:e2e` passes for the core API flows
- `docker-compose up -d` brings up Postgres, Redis, RabbitMQ, MinIO, and the gateway
- Swagger is accessible and matches the current controllers
