# Research: CV Parser Scoring Pipeline (Phase 4 & 5)

**Date**: 2026-06-24  
**Feature**: `018-cv-parser-scoring-pipeline`  
**Scope**: All 10 NEEDS CLARIFICATION items resolved

---

## R-01: How to obtain `jobDescription` for scoring

### Decision
Add a `jobDescription` (`String`, nullable) field to the existing `CvUploadedEvent` DTO in `cv-parser/src/main/java/com/talentflow/cvparser/shared/dto/CvUploadedEvent.java`.

### Rationale
- The existing `CvUploadedEvent` DTO already uses `@Data` (Lombok) with `Jackson2JsonMessageConverter` and `fail-on-unknown-properties: false` in `application.yml`. Adding an optional String field is purely additive — existing messages without `jobDescription` deserialize with it as `null`, triggering the `SKIPPED` scoring path.
- The `api-gateway` producer (not changed here) is expected to add `jobDescription` to the `cv.uploaded` message when available. The field already exists in the message payload per the spec's assumption ("The `jobDescription` field is present in the incoming AMQP message payload when a job is associated").
- This avoids introducing a synchronous HTTP dependency from an async worker.

### Alternatives considered
1. Fetch job description from api-gateway via REST call using `jobId` → introduces sync HTTP dependency, increased latency, and new failure surface in an async worker. Rejected.
2. Store job descriptions in a separate db/redis accessible to cv-parser → cross-service coupling. Rejected.

---

## R-02: Flyway + JPA dependency setup

### Decision
Add these dependencies to `cv-parser/pom.xml`:
- `org.flywaydb:flyway-core` (managed by Spring Boot)
- `org.flywaydb:flyway-database-postgresql` (PostgreSQL-specific)
- Flyway migration at `src/main/resources/db/migration/V1__create_cv_parse_results.sql`

### Rationale
- `spring-boot-starter-data-jpa` is already present in pom.xml.
- Spring Boot 3.3 auto-configures Flyway when `flyway-core` is on the classpath and `spring.flyway.enabled=true` (default).
- The test profile (`application-test.yml`) uses H2 with `ddl-auto: create-drop` — Flyway should be disabled in tests via `spring.flyway.enabled=false` so JPA generates the schema from entity definitions.
- `hibernate.ddl-auto: validate` in the default profile ensures the schema matches entities. Flyway will create/version it.
- The cv-parser's Flyway runs against the shared PostgreSQL instance; a new schema name (`cv_parser`) isolates the tables.

### Config to add
```yaml
# application.yml additions
spring:
  flyway:
    enabled: true
    schemas: cv_parser
    locations: classpath:db/migration
  jpa:
    properties:
      hibernate:
        default_schema: cv_parser
```
```yaml
# application-test.yml additions
spring:
  flyway:
    enabled: false
```

---

## R-03: Logstash JSON logging configuration

### Decision
Add `net.logstash.logback:logstash-logback-encoder` to `pom.xml` and create `logback-spring.xml` in `src/main/resources/`.

### Rationale
- The spec requires "Logstash-compatible JSON, and every log line for a single CV processing request shares the same `correlationId`".
- `logstash-logback-encoder` provides `LogstashEncoder` (JSON format) and `MDC` field inclusion — exactly what is needed.
- `logback-spring.xml` supports Spring Boot profiles and is the standard configuration path.

### Alternatives considered
1. Native Logback `JsonEncoder` (ch.qos.logback.core) — available in newer Logback but less mature for structured JSON with MDC. Rejected.
2. Log4j2 with JSON layout — requires swapping logging implementation, a much larger change. Rejected.

### Config shape
```xml
<!-- logback-spring.xml -->
<configuration>
    <springProperty name="profile" source="spring.profiles.active" defaultValue="dev" />
    
    <appender name="JSON" class="ch.qos.logback.core.ConsoleAppender">
        <encoder class="net.logstash.logback.encoder.LogstashEncoder">
            <includeMdcKeyName>correlationId</includeMdcKeyName>
        </encoder>
    </appender>
    
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>

    <!-- Dev profile: human-readable console -->
    <!-- Non-dev profiles: JSON -->
    <springProfile name="!dev">
        <root level="INFO">
            <appender-ref ref="JSON" />
        </root>
    </springProfile>
    <springProfile name="dev">
        <root level="INFO">
            <appender-ref ref="CONSOLE" />
        </root>
    </springProfile>
</configuration>
```

---

## R-04: Micrometer Prometheus dependency

### Decision
Add `io.micrometer:micrometer-registry-prometheus` to `pom.xml`.

### Rationale
- `management.endpoints.web.exposure.include: health,info,metrics,prometheus` is already in `application.yml` — the endpoint is configured but the registry is not on the classpath.
- Spring Boot Actuator auto-configures the `PrometheusMeterRegistry` when the registry dependency is present.
- No additional bean definitions needed — Micrometer's `MeterRegistry` is auto-configured and available for injection.

### Alternatives considered
1. Micrometer's built-in SimpleMeterRegistry — works but not scrapeable by Prometheus. Rejected.
2. Manual Prometheus client — would bypass Micrometer's unified API. Rejected.

---

## R-05: MDCTaskDecorator pattern for thread pools

### Decision
Create a `MdcTaskDecorator` implementing Spring's `TaskDecorator` interface, applying it to all four `ThreadPoolTaskExecutor` beans (`parsingExecutor`, `ocrExecutor`, `ocrPageExecutor`, `llmExecutor`).

### Rationale
- `MDCTaskDecorator` captures the current thread's MDC context map before submitting the task and restores it in the worker thread. This is the standard Spring pattern for MDC propagation across `@Async` boundaries.
- The decorator must also clear MDC in the worker thread after completion (a `finally` block inside the decorated `Runnable`) to prevent context leakage to pooled thread reuse.
- The existing `ThreadPoolConfig` defines four executor beans. Each bean's `setTaskDecorator(new MdcTaskDecorator())` call wires it in.

### Code template
```java
public class MdcTaskDecorator implements TaskDecorator {
    @Override
    public Runnable decorate(Runnable runnable) {
        Map<String, String> contextMap = MDC.getCopyOfContextMap();
        return () -> {
            try {
                if (contextMap != null) {
                    MDC.setContextMap(contextMap);
                }
                runnable.run();
            } finally {
                MDC.clear();
            }
        };
    }
}
```

### Alternatives considered
1. Spring's `ThreadPoolTaskExecutor.setTaskDecorator` with a lambda — works but is less readable for multiple beans. Rejected.
2. AOP `@Around` on `@Async` methods — more complex and fragile. Rejected.

---

## R-06: Exception classification matrix

### Decision
Systematic retryable/non-retryable classification based on error semantics and recoverability:

| Exception | Retryable | Rationale |
|---|---|---|
| `UnsupportedDocumentFormatException` | No | Wrong file type — re-processing will never succeed |
| `DocumentTooLongException` | No | File exceeds limits — re-processing won't change size |
| `PayloadTooLargeException` | No | Payload exceeds limits — same as above |
| `ParsingException` (base) | Varies | Depends on subclass (see specific types above/below) |
| `ExtractionException` (code=INVALID_JSON) | No | Gemini returned bad JSON — unlikely to change on retry |
| `ExtractionException` (code=SCHEMA_VALIDATION_FAILED) | No | Schema violation — same input fails again |
| `ExtractionException` (code=GEMINI_NETWORK_ERROR) | Yes | Transient network failure — may succeed on retry |
| `ExtractionException` (code=GEMINI_SERVER_ERROR) | Yes | 5xx — may recover |
| `ExtractionException` (code=GEMINI_CLIENT_ERROR) | No | 4xx — auth/configuration error |
| `ScoringException` (default) | Yes | Default is retryable (transient API failure) |
| `ScoringException` (config error) | No | API key, model misconfiguration |
| `StorageReadException` | Yes | S3/MinIO temporary failure |
| `StorageObjectNotFoundException` | No | File doesn't exist — retry won't create it |

### Mechanism
- All exception classes already carry `isRetryable()` — this matrix ensures the correct value is set when constructing instances.
- The `CvParserListener` will use the `isRetryable()` value to decide: NACK with `requeue=false` (to DLQ) for non-retryable, NACK with `requeue=true` for retryable (within maxRetries).
- Once `maxRetries` (from config) is exhausted, the message is routed to DLQ regardless of exception type, per standard Spring AMQP retry config.

---

## R-07: Post-commit publish pattern

### Decision
Use `TransactionSynchronizationManager.registerSynchronization()` with `TransactionSynchronization.afterCommit()` inside the `@Transactional` orchestrator method.

### Rationale
- `@TransactionalEventListener(phase = AFTER_COMMIT)` is the declarative Spring approach, but it requires a separate event publication step within the transaction (i.e., an `ApplicationEventPublisher.publishEvent()` call inside the transactional method, then a separate listener method that does the RabbitMQ send). This indirection adds complexity.
- `TransactionSynchronizationManager.registerSynchronization()` is a programmatic hook that runs the publish in a `afterCommit` callback, directly in the orchestrator, keeping the logic co-located.
- The `afterCommit` callback runs after the DB transaction commits successfully. If the publish fails, the DB row remains committed — meeting the spec requirement (FR-003: "DB row is committed (not rolled back)").

### Implementation sketch
```java
@Transactional
public void execute(CvUploadedEvent event) {
    // ... parse, extract, score ...
    cvParseResultJpaRepository.save(cvParseResult);  // flush happens at commit
    
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                rabbitTemplate.convertAndSend(ROUTING_KEY_CV_PARSED, parsedEvent);
            }
        }
    );
}
```

### Alternatives considered
1. `@TransactionalEventListener(phase = AFTER_COMMIT)` — cleaner separation but requires event indirection. Rejected for simplicity.
2. Manual transaction management — error-prone. Rejected.

---

## R-08: Gemini scoring client

### Decision
Create a new `CandidateScoringService` in a new `scoring/` package that uses the existing Gemini `WebClient` (via injection from `WebClient.Builder` or a shared base) but with a scoring-specific prompt and response validation.

### Rationale
- The existing `GeminiLlmClient` is tightly coupled to extraction (it takes `CvExtractionPrompt` and returns raw text validated against `cv-extraction-schema.json`).
- Scoring needs different prompt semantics (job description + candidate profile → score and reasoning) and different response validation (integer 0–100 + reasoning string).
- Both should share the existing `geminiApi` Resilience4j instance (circuit breaker, rate limiter, retry) — the scoring client should reuse the same `CircuitBreakerRegistry` and `RateLimiterRegistry`.
- A dedicated `ScoringConfig` configuration class holds scoring-specific properties (prompt template, model, timeout).
- Reusing the `GeminiLlmClient` would require genericizing its prompt/response handlers, making the extraction code more complex.

### Structure
```
scoring/
├── CandidateScoringUseCase.java         (interface)
├── CandidateScoringService.java         (implementation)
├── GeminiScoreResponseValidator.java    (validates 0-100 integer)
├── ScoringResult.java                   (value object)
└── ScoringConfig.java                   (configuration properties)
```

---

## R-09: Idempotency check strategy

### Decision
Before starting processing for an `applicationId`, query the `CvParseResultJpaRepository` for an existing record with `status = SUCCESS`. If found, ACK the message and skip processing. If not found, proceed.

### Rationale
- The spec says: "If `applicationId` already has a `cv_parse_results` row with `status = SUCCESS`, the idempotency check prevents re-processing."
- The check must be the FIRST operation in the orchestrator (before S3 download), to minimize wasted work.
- This is a "at-most-once" processing guarantee within the "at-least-once" delivery semantics of AMQP.
- Race condition: two concurrent messages for the same `applicationId` could both pass the idempotency check simultaneously. This is acceptable because:
  1. The second write will be a duplicate (same `applicationId` — we use it as a unique constraint)
  2. The second event publish is benign (api-gateway consumer should be idempotent)
  3. This is an edge case with manually re-queued messages, not normal flow

### SQL unique constraint
```sql
ALTER TABLE cv_parser.cv_parse_results ADD CONSTRAINT uq_application_id UNIQUE (application_id);
```
This prevents duplicate processing records at the database level.

---

## R-10: cv-parser database setup

### Decision
The cv-parser shares the same PostgreSQL instance (`postgres:5432`) as the rest of the application, but uses a dedicated schema (`cv_parser`) for isolation.

### Rationale
- docker-compose defines a single `postgres` service. Both api-gateway and notification connect to `talentflow_dev` database on this instance.
- Adding a second PostgreSQL container for cv-parser is unnecessary infrastructure overhead.
- Using a dedicated schema (`cv_parser`) provides table-level isolation without requiring a separate database or container.
- Flyway manages the `cv_parser` schema lifecycle (Flyway creates the schema if it doesn't exist).

### Config
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/talentflow_dev
    # existing config
  flyway:
    schemas: cv_parser
    create-schemas: true
  jpa:
    properties:
      hibernate:
        default_schema: cv_parser
```

The test profile uses H2 and does not need schema configuration:
```yaml
spring:
  flyway:
    enabled: false
  jpa:
    hibernate:
      ddl-auto: create-drop  # JPA creates tables from entity definitions
```

---

## Summary

All 10 research items resolved. The implementation follows these principles:
1. All changes within `cv-parser/` — no api-gateway or notification changes
2. Existing Resilience4j `geminiApi` instance reused (no new circuit breaker or rate limiter config)
3. Additive DTO changes only (backward-compatible with existing messages)
4. TDD: Tests before implementation for `CandidateScoringUseCase`, `GeminiScoringClient`, `CvParsingOrchestrator`
