# CV Parser Development Guide

**Status:** Partial

## Prerequisites

- Java 17
- Maven
- Docker and Docker Compose
- RabbitMQ
- PostgreSQL
- MinIO or another S3-compatible storage backend
- Tesseract OCR runtime for scanned documents

## Local setup

### 1. Start infrastructure
```bash
docker-compose up -d
```

### 2. Enter the service directory
```bash
cd cv-parser
```

### 3. Run tests
```bash
mvn test
```

### 4. Start the worker
```bash
mvn spring-boot:run
```

## Useful commands

| Command | Purpose |
|---|---|
| `mvn test` | Unit and integration tests |
| `mvn clean package` | Build the runnable JAR |
| `mvn spring-boot:run` | Start the worker locally |
| `mvn -DskipTests package` | Build without running tests |

## Runtime configuration

The worker reads its configuration from `src/main/resources/application.yml`.

### Core environment variables
- `SPRING_PROFILES_ACTIVE`
- `SERVER_PORT`
- `DATABASE_URL`
- `DB_USER`
- `DB_PASS`
- `RABBITMQ_HOST`
- `RABBITMQ_PORT`
- `RABBITMQ_USER`
- `RABBITMQ_PASS`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_REGION`
- `LLM_PROVIDER`
- `LLM_MODEL`
- `GEMINI_API_KEY`
- `TESSERACT_DATA_PATH`
- `TESSERACT_LANGUAGE`
- `FILE_MAX_SIZE_MB`
- `FILE_MAX_PAGES`

## Local URLs

- Health: `http://localhost:8081/actuator/health`
- Prometheus metrics: `http://localhost:8081/actuator/prometheus`

## Development notes

- This service is queue-driven; it does not expose the main ATS HTTP API.
- The persistence layer is currently a no-op placeholder, so developers should not expect durable CV parse results yet.
- The worker depends on RabbitMQ and object storage to exercise the full pipeline.
- Keep file-type and file-size limits aligned with the configuration file.
- The event payloads should continue to use `bucket + fileKey` rather than direct file URLs.

## Verification checklist

- `mvn test` passes
- The application starts with the active profile expected for the local environment
- RabbitMQ consumption works against `cv_parser.jobs`
- Health and metrics endpoints respond on port `8081`
- Parsed and failed events remain aligned with the message contracts
