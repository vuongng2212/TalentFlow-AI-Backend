# Phase 3: RabbitMQ Consumer - Implementation Plan

## Goal

Subscribe and process events from RabbitMQ, routing them to `NotificationService` for email delivery via the existing `EmailService`.

## Current State

| Component | Status | Notes |
|-----------|--------|-------|
| `rabbitmq.service.ts` | ✅ Completed | Connection mgmt, auto-reconnect, exchange/queue assertion |
| `rabbitmq.module.ts` | ⚠️ Partial | Only exports `RabbitmqService`, no consumer registered |
| `rabbitmq.config.ts` | ✅ Completed | URL, queue, exchange, prefetch configured |
| `validation.schema.ts` | ✅ Completed | RabbitMQ env vars validated |
| `rabbitmq.health.ts` | ✅ Completed | Health indicator via `ping()` |
| Event DTOs (4 files) | ❌ Empty | Interfaces not defined |
| `notification.consumer.ts` | ❌ Empty | No consumer logic |
| `notification.service.ts` | ⚠️ Partial | Has `send()` but no event handlers |
| `rabbitmq.consumer.spec.ts` | ❌ Empty | No tests |

## Tasks

### 3.1 Define Event Interfaces

**Files:** `src/rabbitmq/events/*.event.ts`

Each event file needs a TypeScript interface + a constant routing key.

```typescript
// notification-send.event.ts
export const ROUTING_KEY = 'notification.send';

export interface NotificationSendEvent {
  userId: string;
  to: string;
  subject: string;
  body?: string;
  type: 'email' | 'application_confirmation' | 'interview_invitation' | 'new_application_hr' | 'application_result';
  templateId?: string;
  templateData?: Record<string, unknown>;
}
```

```typescript
// application-created.event.ts
export const ROUTING_KEY = 'application.created';

export interface ApplicationCreatedEvent {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  applicantId: string;
  applicantEmail: string;
  applicantName: string;
  appliedAt: string;
}
```

```typescript
// cv-parsed.event.ts
export const ROUTING_KEY = 'cv.parsed';

export interface CvParsedEvent {
  applicationId: string;
  applicantEmail: string;
  applicantName: string;
  jobTitle: string;
  score?: number;
  parsedAt: string;
}
```

```typescript
// cv-failed.event.ts
export const ROUTING_KEY = 'cv.failed';

export interface CvFailedEvent {
  applicationId: string;
  applicantEmail: string;
  applicantName: string;
  jobTitle: string;
  reason: string;
  failedAt: string;
}
```

**Barrel export:** Create `src/rabbitmq/events/index.ts` re-exporting all types and routing key constants.

---

### 3.2 Implement NotificationConsumer

**File:** `src/rabbitmq/notification.consumer.ts`

Responsibilities:
- Inject `RabbitmqService` (to get channel + exchange) and `NotificationService`
- On `onModuleInit`: bind queue to exchange with all 4 routing keys
- On `onModuleDestroy`: unbind (cleanup)
- Consume messages with `channel.consume()` using `{ noAck: false }`
- Route to `NotificationService` based on routing key:
  - `notification.send` -> `notificationService.sendFromEvent()`
  - `application.created` -> `notificationService.handleApplicationCreated()`
  - `cv.parsed` -> `notificationService.handleCvParsed()`
  - `cv.failed` -> `notificationService.handleCvFailed()`
- ACK on success, NACK (with `requeue: false`) on failure -> goes to DLQ
- PII masking in all logs via `maskPii()`

**Auto-reconnection:** Detect stale channel via `onModuleInit` guard. If channel is lost, the consumer is re-set up on reconnect through `RabbitmqService`'s reconnect mechanism + a consumer recovery guard.

---

### 3.3 Add Event Handlers to NotificationService

**File:** `src/notification/notification.service.ts`

Add 4 new public methods:

| Method | Input | Behavior |
|--------|-------|----------|
| `sendFromEvent(event)` | `NotificationSendEvent` | Maps to existing `send()` logic, sends email via `EmailService` |
| `handleApplicationCreated(event)` | `ApplicationCreatedEvent` | Sends confirmation email to applicant + notification to HR |
| `handleCvParsed(event)` | `CvParsedEvent` | Sends application update email with score |
| `handleCvFailed(event)` | `CvFailedEvent` | Sends failure notification to applicant |

Each method:
- Logs incoming event with PII masking
- Calls `EmailService.sendEmail()` with appropriate template + data
- Logs success/failure with PII masking
- Returns `{ success: boolean; messageId?: string }` (used by consumer for ACK/NACK decision)

---

### 3.4 Register in Modules

**`rabbitmq.module.ts`:**
- Add `NotificationConsumer` to `providers`
- Import `NotificationModule` (to get `NotificationService`)
- Keep `RabbitmqService` exported

**`app.module.ts`:**
- Import `RabbitmqModule` in `imports` array
- Order after database/notification modules

---

### 3.5 Update env.example (if needed)

Already has `RABBITMQ_*` vars. No changes needed unless we add new config.

---

### 3.6 Write Tests

**Unit tests** (`src/rabbitmq/notification.consumer.spec.ts`):
- Mock `RabbitmqService` and `NotificationService`
- Test: consumer binds all 4 routing keys on init
- Test: message with `notification.send` routing key -> calls `sendFromEvent()` -> ACK
- Test: message with `application.created` routing key -> calls `handleApplicationCreated()` -> ACK
- Test: malformed JSON -> NACK with `requeue: false`
- Test: handler throws -> NACK with `requeue: false`
- Test: cleanup on destroy

**Integration tests** (`test/integration/rabbitmq.consumer.spec.ts`):
- Requires running RabbitMQ (docker-compose)
- Publish real message to exchange, verify consumer processes it

**Update notification.service.spec.ts** with tests for the 4 new handler methods.

---

### 3.7 Verification

```bash
# Start services
docker-compose up -d rabbitmq
npm run start:dev

# Manual test via RabbitMQ Management UI (http://localhost:15672, guest/guest)
# Exchange: talentflow.events (topic)
# Routing key: notification.send
# Payload:
{
  "userId": "user-123",
  "to": "test@example.com",
  "subject": "Test from RabbitMQ",
  "body": "Hello from consumer!",
  "type": "email"
}

# Expected: Consumer ACKs, email is sent via EmailService
# Check logs: "Received event notification.send" + "Email sent to ***"
```

---

### 3.8 Negative Tests

| Scenario | Expected Behavior |
|----------|-------------------|
| Malformed JSON message | NACK with `requeue: false` -> message goes to DLQ |
| Unknown routing key | Log warning, NACK with `requeue: false` |
| Email delivery failure | Log error, NACK with `requeue: false` |
| RabbitMQ connection loss | Auto-reconnect (handled by `RabbitmqService`), consumer re-registers |
| Handler throws unexpectedly | Catch, log with PII masking, NACK |

## File Change Summary

| Action | File |
|--------|------|
| Create | `src/rabbitmq/events/index.ts` |
| Update | `src/rabbitmq/events/notification-send.event.ts` |
| Update | `src/rabbitmq/events/application-created.event.ts` |
| Update | `src/rabbitmq/events/cv-parsed.event.ts` |
| Update | `src/rabbitmq/events/cv-failed.event.ts` |
| Create | `src/rabbitmq/notification.consumer.ts` |
| Update | `src/rabbitmq/rabbitmq.module.ts` |
| Update | `src/notification/notification.service.ts` |
| Update | `src/notification/notification.module.ts` |
| Update | `src/app.module.ts` |
| Create | `src/rabbitmq/notification.consumer.spec.ts` |
| Create | `test/integration/rabbitmq.consumer.spec.ts` |
| Update | `test/unit/notification.service.spec.ts` |

## Dependencies

- `amqplib` + `@types/amqplib` -- already in `package.json`
- No new npm packages needed
- Running RabbitMQ instance (available via docker-compose)
