---
name: rabbitmq-review
description: "Cross-service messaging standards for RabbitMQ."
applyTo: "api-gateway/**, cv-parser/**, notification/**"
---

# RabbitMQ Messaging Standards

## Topology & Reliability

- **Durability**: All exchanges and queues MUST be `durable: true`.
- **Persistence**: Messages MUST be marked as `persistent: true` (Delivery Mode 2).
- **Dead Lettering**: Critical queues (like `cv-parsing`) MUST have a Dead Letter Queue (DLQ) configured.

## Producers (API Gateway)

- Ensure routing keys follow the established topic pattern: `service.event.action`.
- Always set the `contentType` to `application/json`.
- Handle potential connection failures with retry logic or circuit breakers.

## Consumers (CV Parser, Notification)

- Implement error handling that explicitly differentiates between:
  - **Permanent failures**: Nack with `requeue: false` (to DLQ).
  - **Transient failures**: Requeue or delay-retry logic.
- Ensure message acknowledgments (`ack`) are only sent after the business logic has successfully processed the message.

## Shared Contracts

- If a message payload structure is modified, verify that both the producer and the consumer are updated in the same PR or a tightly coordinated successive PR to prevent serialization errors.
- Do not break established storage-message contracts such as `bucket` + `fileKey` by replacing them with direct file URLs.
