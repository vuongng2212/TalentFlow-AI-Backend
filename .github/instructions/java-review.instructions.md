---
name: java-review
description: "Review rules for Java/Spring Boot services (CV Parser)."
applyTo: "cv-parser/**"
---

# Java & Spring Boot Review Standards

## Architecture

- Ensure strict separation of concerns following Modular Clean Architecture.
- Business logic MUST reside in the `usecase` or `service` layers.
- Infrastructure details (storage, messaging) MUST be abstracted behind interfaces in the `shared` or `domain` layers.

## Document Parsing Safety

- **CRITICAL**: Verify that `DocumentParser` implementations have limits for character counts and page counts to prevent Resource Exhaustion (DoS).
- Check for proper closing of streams/resources (prefer try-with-resources).
- Flag the use of insecure XML/PDF parsing settings that could lead to XXE.

## LLM Integration (Gemini)

- Prompt templates must be managed centrally, not hardcoded in services.
- Always validate the LLM response structure before attempting to map it to a DTO.
- Ensure proper error handling for LLM timeouts or API failures.

## Messaging

- RabbitMQ listeners should have error handling to prevent infinite retry loops.
- Use explicit DTOs for message payloads (typically ending in `Event` or `Data`).

## Error Handling

- Use custom exceptions extending `RuntimeException`.
- Exceptions should include a machine-readable `errorCode`.
- Use `@Slf4j` for structured logging. Avoid `e.printStackTrace()`.
- Mask PII (emails, names) in logs using `PiiRedactor`.
