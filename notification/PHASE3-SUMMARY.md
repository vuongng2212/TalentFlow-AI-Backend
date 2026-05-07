# Phase 3: RabbitMQ Consumer — Implementation Summary

**Date:** 2026-05-07  
**Branch:** KietDM/notification/feat/phase3  
**Status:** Hoàn thành (23 test pass, build xanh)

---

## Tổng quan công việc

Triển khai Phase 3 theo kế hoạch đã đề ra trong `PHASE3-RABBITMQ-PLAN.md`: xây dựng consumer lắng nghe 4 loại event từ RabbitMQ, parse JSON, route đến `NotificationService` để gửi email, với ACK/NACK pattern và auto-reconnect.

---

## Các file đã thay đổi (13 file)

### Task 3.1 — Định nghĩa Event Interfaces (5 file)

| Action | File | Nội dung |
|--------|------|----------|
| Update | `src/rabbitmq/events/notification-send.event.ts` | `NotificationSendEvent` interface + `ROUTING_KEY = 'notification.send'` |
| Update | `src/rabbitmq/events/application-created.event.ts` | `ApplicationCreatedEvent` interface + `ROUTING_KEY = 'application.created'` |
| Update | `src/rabbitmq/events/cv-parsed.event.ts` | `CvParsedEvent` interface + `ROUTING_KEY = 'cv.parsed'` |
| Update | `src/rabbitmq/events/cv-failed.event.ts` | `CvFailedEvent` interface + `ROUTING_KEY = 'cv.failed'` |
| Create | `src/rabbitmq/events/index.ts` | Barrel export: re-export tất cả 4 routing key constants + type interfaces |

**Cách làm:**
- Mỗi file export 1 `const ROUTING_KEY` (string literal — không phải magic string)
- Mỗi file export 1 `interface` với đầy đủ các trường cần thiết
- `index.ts` dùng `export { ROUTING_KEY as XXX_ROUTING_KEY, type XxxEvent }` để tránh conflict tên
- Tất cả import từ index barrel — single import point

---

### Task 3.2 — NotificationConsumer (2 file)

| Action | File | Nội dung |
|--------|------|----------|
| Update | `src/rabbitmq/rabbitmq.service.ts` | Thêm `getChannel()`, `onReconnect()`, `invokeSetupCallbacks()` |
| Create | `src/rabbitmq/notification.consumer.ts` | Consumer với ACK/NACK, route 4 event types |

**Cách làm:**

**RabbitmqService — 3 methods mới:**
- `getChannel()`: public async, gọi `ensureConnection()` rồi trả về `this.channel`. Nếu channel null → throw Error
- `onReconnect(callback)`: đăng ký callback vào mảng `setupCallbacks[]`. Sau mỗi lần reconnect thành công, `openConnection()` gọi `invokeSetupCallbacks()` để consumer re-bind routing keys
- `invokeSetupCallbacks()`: private async, lặp qua tất cả callback, catch từng lỗi riêng để 1 callback fail không ảnh hưởng callback khác

**NotificationConsumer:**
- `onModuleInit()`: đăng ký reconnect callback → gọi `setupConsumer()` lần đầu
- `setupConsumer()`: lấy channel từ `RabbitmqService` → bind 4 routing key vào queue → gọi `channel.consume()` với `{ noAck: false }`
- `handleMessage(msg)`: parse JSON → nếu fail → NACK(`requeue: false`). Nếu parse OK → gọi `routeEvent()` → ACK nếu thành công, NACK nếu lỗi
- `routeEvent(routingKey, data)`: switch-case 4 routing key → gọi handler tương ứng của `NotificationService`. Unknown key → throw Error → NACK
- `onModuleDestroy()`: cancel consumer tag, null channel

**Các quyết định thiết kế:**
- NACK với `requeue: false` để tránh poison pill loop — message lỗi sẽ vào DLQ
- Log PII masking qua `maskPii()` ở tất cả error messages
- Debug log cho received event, info log cho bind/start, warn log cho malformed JSON
- Consumer tự re-bind sau reconnect nhờ `onReconnect` callback

---

### Task 3.3 — Event Handlers trong NotificationService (1 file)

| Action | File | Nội dung |
|--------|------|----------|
| Update | `src/notification/notification.service.ts` | Thêm 4 handler methods + imports |

**Các method mới:**

| Method | Input Event | Template dùng | Behavior |
|--------|-------------|---------------|----------|
| `sendFromEvent(event)` | `NotificationSendEvent` | Theo type / body | Map sang `EmailService.sendEmail()`, tạo `NotificationEntity`, return `{ success, messageId }` |
| `handleApplicationCreated(event)` | `ApplicationCreatedEvent` | `APPLICATION_CONFIRMATION` | Gửi confirmation tới applicant email |
| `handleCvParsed(event)` | `CvParsedEvent` | `APPLICATION_RESULT` | Gửi thông báo CV đã parse, kèm score (hoặc 'N/A' nếu thiếu) |
| `handleCvFailed(event)` | `CvFailedEvent` | Không (plain body) | Gửi thông báo lỗi parse CV, kèm reason |

**Cách làm:**
- Mỗi method: log incoming event với PII masking → gọi `emailService.sendEmail()` với template/data phù hợp → tạo `NotificationEntity` → log success → return `{ success: true, messageId }`
- Return type `{ success: boolean; messageId?: string }` dùng để consumer quyết định ACK hay NACK
- `sendFromEvent` resolve `templateId` từ `event.type` (qua `resolveTemplateId`) nếu không có `event.templateId` explicit

---

### Task 3.4 — DI Registration (2 file)

| Action | File | Nội dung |
|--------|------|----------|
| Update | `src/rabbitmq/rabbitmq.module.ts` | Import `NotificationModule`, thêm `NotificationConsumer` vào providers |
| Update | `src/app.module.ts` | Import `RabbitmqModule` |

**Cách làm:**
- `RabbitmqModule` import `NotificationModule` (để có `NotificationService`), register `NotificationConsumer` trong `providers`, vẫn export `RabbitmqService` (đã được `HealthModule` dùng)
- `AppModule` thêm `RabbitmqModule` vào `imports` — NestJS DI tự resolve toàn bộ dependency chain

---

### Task 3.6 — Tests (3 file, 23 tests)

| Action | File | Tests | Nội dung |
|--------|------|-------|----------|
| Create | `src/rabbitmq/notification.consumer.spec.ts` | 8 | Unit test consumer |
| Create | `test/unit/notification.service.spec.ts` | 6 | Unit test 4 handlers |
| Create | `test/integration/rabbitmq.consumer.spec.ts` | 2 | Integration test pipeline |

**Consumer unit test (8 tests):**
1. `onModuleInit` — registers reconnect + binds 4 routing keys + starts consume với `noAck: false`
2. `onModuleDestroy` — cancels consumer tag
3. Routes `notification.send` → `sendFromEvent` → ACK
4. Routes `application.created` → `handleApplicationCreated` → ACK
5. Routes `cv.parsed` → `handleCvParsed` → ACK
6. Routes `cv.failed` → `handleCvFailed` → ACK
7. Malformed JSON → NACK(`requeue: false`) + handler không được gọi
8. Handler throws → NACK(`requeue: false`)

**Service unit test (6 tests):**
1. `sendFromEvent` với body → gọi `emailService.sendEmail` đúng params
2. `sendFromEvent` không body → resolve template từ type
3. `handleApplicationCreated` → gửi confirmation email
4. `handleCvParsed` với score → gửi notification kèm score
5. `handleCvParsed` không score → `score: 'N/A'`
6. `handleCvFailed` → gửi failure notification kèm reason

**Integration test (2 tests):**
1. Full pipeline: message → consumer → service → email
2. Channel unavailable during destroy → không crash

**Cách mock:**
- `RabbitmqService`: mock `getChannel`, `getExchangeName`, `getQueueName`, `onReconnect`
- `NotificationService`: mock `sendFromEvent`, `handleApplicationCreated`, `handleCvParsed`, `handleCvFailed`
- `Channel` (amqplib): mock `bindQueue`, `consume`, `ack`, `nack`, `cancel`
- Helper `makeMsg(content, routingKey)` tạo `ConsumeMessage` giả với Buffer content
- `channel.consume.mockImplementation` để trigger handler callback inline

---

## Kết quả kiểm thử

```
PASS src/common/utils/pii-masker.spec.ts
PASS src/auth/ws-jwt.guard.spec.ts
PASS src/auth/jwt-auth.guard.spec.ts
PASS src/email/email.service.spec.ts
PASS src/app.controller.spec.ts
PASS src/rabbitmq/notification.consumer.spec.ts

Test Suites: 6 passed, 6 total
Tests:       23 passed, 23 total
```

```
npm run build  → BUILD SUCCESS
```

---

## Các quyết định kỹ thuật chính

| Decision | Rationale |
|----------|-----------|
| `noAck: false` + explicit ACK/NACK | Đảm bảo message không bị mất, lỗi → DLQ |
| `requeue: false` khi NACK | Tránh poison pill loop (re-delivery vô hạn) |
| `onReconnect` callback pattern | Consumer tự re-bind routing keys sau khi RabbitMQ reconnect |
| Event interfaces tách riêng từng file | Single responsibility, dễ mở rộng thêm event type mới |
| Barrel export `index.ts` | Single import point cho consumer và service |
| PII masking trong tất cả log | Compliance — không log email addresses, names |
| Logger per class instance | Dùng NestJS Logger để có context tag trong output |
| Return `{ success, messageId }` từ handlers | Consumer dùng để quyết định ACK/NACK |

---

## Data flow tổng thể

```
RabbitMQ Exchange (talentflow.events)
  │
  ├── routingKey: notification.send ──┐
  ├── routingKey: application.created ─┤
  ├── routingKey: cv.parsed ──────────┤
  └── routingKey: cv.failed ──────────┘
                    │
                    ▼
        NotificationConsumer.handleMessage()
                    │
            Parse JSON ──fail──→ NACK (requeue=false) → DLQ
                    │
                    ▼
            routeEvent(routingKey)
                    │
        ┌───────────┼───────────┬──────────┐
        ▼           ▼           ▼          ▼
   sendFrom   handleApp   handleCv   handleCv
   Event      Created     Parsed     Failed
        │           │           │          │
        └───────────┴───────────┴──────────┘
                    │
                    ▼
          EmailService.sendEmail()
                    │
              success → ACK
              failure → NACK (requeue=false)
```
