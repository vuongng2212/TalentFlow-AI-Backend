## Implementation Phases

### Progress Overview

| Phase | Name | Duration | Status |
|-------|------|----------|--------|
| 1 | Project Setup & Core Infrastructure | Day 1-2 | ⬜ Not Started |
| 2 | Email Service | Day 2-3 | ✅ Completed |
| 3 | RabbitMQ Consumer | Day 3-4 | ⬜ Not Started |
| 4 | Socket.IO Real-time | Day 4-5 | ⬜ Not Started |
| 5 | Notification History | Day 5-6 | ⬜ Not Started |
| 6 | Testing & Documentation | Day 6-7 | ⬜ Not Started |

**Legend:** ⬜ Not Started | 🔄 In Progress | ✅ Completed | ❌ Blocked

---

### Phase 1: Project Setup & Core Infrastructure (Day 1-2)

**Goal:** Project skeleton với health checks hoạt động

**Tasks:**
```
[ ] 1.1 Project Initialization
    [ ] Create NestJS project: npx @nestjs/cli new notification
    [ ] Install core dependencies (see README Section 3.3)
    [ ] Configure tsconfig.json, nest-cli.json
    [ ] Configure .gitignore, .env.example
    [ ] Setup Prettier + ESLint

[ ] 1.2 Configuration Setup
    [ ] Create .env + .env.example với tất cả config values
    [ ] Create config/validation.schema.ts (Joi validation)
    [ ] Create config/smtp.config.ts
    [ ] Create config/rabbitmq.config.ts
    [ ] Create config/jwt.config.ts
    [ ] Setup Winston logging (nest-winston)
    [ ] Setup ConfigModule.forRoot() trong app.module.ts

[ ] 1.3 Database Setup
    [ ] Install Prisma: npm install @prisma/client prisma
    [ ] Init Prisma: npx prisma init
    [ ] Create prisma/schema.prisma với Notification model
    [ ] Create prisma/prisma.module.ts + prisma.service.ts
    [ ] Run: npx prisma migrate dev --name init
    [ ] Verify database connection

[ ] 1.4 Authentication Setup
    [ ] Install: @nestjs/passport @nestjs/jwt passport passport-jwt
    [ ] Create auth/jwt.strategy.ts (Passport JWT strategy)
    [ ] Create auth/jwt-auth.guard.ts
    [ ] Create auth/ws-jwt.guard.ts (WebSocket guard)
    [ ] Create common/decorators/current-user.decorator.ts
    [ ] Test: invalid token → 401

[ ] 1.5 Health Checks
    [ ] Install: @nestjs/terminus
    [ ] Create health/health.module.ts + health.controller.ts
    [ ] Add RabbitMQ health indicator
    [ ] Add PostgreSQL (Prisma) health indicator
    [ ] Test: curl http://localhost:5000/health

[x] 1.6 Docker Setup
    [x] Create Dockerfile (multi-stage Node.js build)
    [x] Update docker-compose.yml
    [x] Test: docker-compose up notification
```

**Verification:**
```bash
npm run build
npm run start:dev
curl http://localhost:5000/health  # Expected: {"status":"ok"}
```

**Security Verification:**
```bash
# Test invalid JWT token → expect 401
curl -X GET http://localhost:5000/api/notifications/user-123 \
  -H "Authorization: Bearer invalid-token" \
  # Expected: 401 Unauthorized

# Test expired JWT token → expect 401
curl -X GET http://localhost:5000/api/notifications/user-123 \
  -H "Authorization: Bearer <expired-token>" \
  # Expected: 401 Unauthorized

# Test missing Authorization header → expect 401
curl -X GET http://localhost:5000/api/notifications/user-123 \
  # Expected: 401 Unauthorized
```

---

### Phase 2: Email Service (Day 2-3)

**Goal:** Gửi được email qua Gmail SMTP với retry

**Tasks:**
```
[x] 2.1 Email DTOs
    [x] Create notification/dto/send-notification.dto.ts (class-validator)
    [x] Create notification/dto/notification-response.dto.ts
    [x] Create notification/entities/notification.entity.ts

[x] 2.2 Email Infrastructure
    [x] Install: @nestjs-modules/mailer nodemailer handlebars
    [x] Create email/email.module.ts (MailerModule.forRootAsync)
    [x] Create email/email.service.ts
    [x] Implement retry với exponential backoff (3 attempts)
    [x] Add PII masking trong logs (common/utils/pii-masker.ts)

[x] 2.3 Email Templates (Handlebars)
    [x] Create email/templates/ folder
    [x] Create application-confirmation.hbs
    [x] Create interview-invitation.hbs
    [x] Create new-application-hr.hbs
    [x] Implement template rendering via @nestjs-modules/mailer

[x] 2.4 REST API Endpoint
    [x] Create notification/notification.module.ts
    [x] Create notification/notification.controller.ts
    [x] Add @UseGuards(JwtAuthGuard)
    [x] Add @Throttle() rate limiting
    [x] POST /api/notifications/send endpoint
    [x] Test với JWT token

[x] 2.5 DI Registration
    [x] Register EmailService trong EmailModule
    [x] Verify startup validation cho SMTP credentials
```

**Verification:**
```bash
curl -X POST http://localhost:5000/api/notifications/send \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test","body":"Hello","type":"email"}'
```

**Security Verification:**
```bash
# Test rate limiting (100 req/min) → expect 429 after limit
for i in $(seq 1 110); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:5000/api/notifications/send \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{"to":"test@example.com","subject":"Test","body":"Hi","type":"email"}'
done
# Expected: 429 Too Many Requests after 100 requests

# Test invalid email format → expect 400
curl -X POST http://localhost:5000/api/notifications/send \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"to":"invalid-email","subject":"Test","body":"Hi","type":"email"}'
  # Expected: 400 Bad Request
```

**Negative Test - SMTP Failure:**
```bash
# Set invalid SMTP credentials temporarily and test retry behavior
# Check logs for: "Retry 1/3 after 2s due to: ..."
# Verify exponential backoff (2s, 4s, 8s)
```

---

### Phase 3: RabbitMQ Consumer (Day 3-4)

**Goal:** Subscribe và xử lý events từ RabbitMQ

**Tasks:**
```
[ ] 3.1 RabbitMQ Infrastructure
    [ ] Install: amqplib @types/amqplib
    [ ] Create rabbitmq/rabbitmq.module.ts
    [ ] Create rabbitmq/rabbitmq.service.ts (connection management)
    [ ] Test RabbitMQ connection

[ ] 3.2 Event DTOs
    [ ] Create rabbitmq/events/application-created.event.ts
    [ ] Create rabbitmq/events/cv-parsed.event.ts
    [ ] Create rabbitmq/events/cv-failed.event.ts
    [ ] Create rabbitmq/events/notification-send.event.ts
    [ ] Create rabbitmq/events/index.ts (barrel export)

[ ] 3.3 Consumer Implementation
    [ ] Create rabbitmq/notification.consumer.ts
    [ ] Implement OnModuleInit → connect + subscribe
    [ ] Implement OnModuleDestroy → cleanup
    [ ] Declare exchange: talentflow.events (topic)
    [ ] Declare queue: notification.events
    [ ] Bind routing keys: notification.send, application.created, cv.parsed, cv.failed
    [ ] Implement ACK/NACK pattern
    [ ] Route events to NotificationService

[ ] 3.4 NotificationService Logic
    [ ] Create notification/notification.service.ts
    [ ] Implement send()
    [ ] Implement handleApplicationCreated()
    [ ] Implement handleCvParsed()
    [ ] Implement handleCvFailed()

[ ] 3.5 DI Registration
    [ ] Register NotificationConsumer trong RabbitmqModule
    [ ] Export NotificationService từ NotificationModule
```

**Verification:**
```bash
# RabbitMQ Management UI: http://localhost:15672 (guest/guest)
# Verify queue "notification.events" exists
# Publish test message and check logs
```

**Negative Test - RabbitMQ Failure:**
```bash
# Test malformed JSON message → expect NACK, message goes to DLQ
# Publish to RabbitMQ Management UI:
# Exchange: talentflow.events
# Routing key: notification.send
# Payload: "{ invalid json }"
# Expected: Error in logs, message NACK'd with requeue=false

# Test RabbitMQ connection loss → expect reconnection
# Stop RabbitMQ container: docker stop rabbitmq
# Wait 30s, start: docker start rabbitmq
# Expected: Consumer reconnects and resumes processing
```

---

### Phase 4: Socket.IO Real-time (Day 4-5)

**Goal:** Push real-time notifications qua WebSocket (authenticated)

**Tasks:**
```
[ ] 4.1 Socket.IO Setup
    [ ] Install: @nestjs/websockets @nestjs/platform-socket.io
    [ ] Configure Socket.IO trong app.module.ts
    [ ] Setup CORS cho frontend
    [ ] (Optional) Setup Redis adapter for horizontal scaling

[ ] 4.2 Gateway Implementation
    [ ] Create notification/notification.gateway.ts
    [ ] Implement OnGatewayConnection → verify JWT + join room
    [ ] Implement OnGatewayDisconnect → cleanup
    [ ] Implement @SubscribeMessage('joinUserRoom')
    [ ] Implement @SubscribeMessage('leaveUserRoom')
    [ ] Implement sendToUser() → push to specific user room
    [ ] Add PII masking trong logs

[ ] 4.3 WebSocket Auth Guard
    [ ] Create auth/ws-jwt.guard.ts
    [ ] Extract token từ handshake.auth.token hoặc headers
    [ ] Verify JWT and attach user to socket.data

[ ] 4.4 Integration
    [ ] Update NotificationService to call NotificationGateway
    [ ] Send push notification khi có event từ RabbitMQ
    [ ] Test với browser client

[ ] 4.5 DI Registration
    [ ] Register NotificationGateway trong NotificationModule
```

**Client Connection (Next.js):**
```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000/notifications', {
  auth: { token: getJwtToken() },
  reconnection: true,
  reconnectionAttempts: 5,
});

socket.on('receiveNotification', (notification) => {
  toast.info(notification.message);
});

socket.on('connect', () => {
  socket.emit('joinUserRoom');
});
```

**Security Verification:**
```bash
# Test Socket.IO without token → expect connection refused
# Browser console:
const socket = io('http://localhost:5000/notifications');
// Expected: Immediate disconnect

# Test Socket.IO with invalid token → expect connection refused
const socket2 = io('http://localhost:5000/notifications', {
  auth: { token: 'invalid-token' }
});
// Expected: Immediate disconnect
```

---

### Phase 5: Notification History (Day 5-6)

**Goal:** Lưu trữ và truy vấn notification history

**Tasks:**
```
[ ] 5.1 Database Schema
    [ ] Update prisma/schema.prisma với Notification model (all fields)
    [ ] Run: npx prisma migrate dev --name add-notification-history
    [ ] Seed test data (optional)

[ ] 5.2 Repository (Prisma Service)
    [ ] Update notification.service.ts
    [ ] Implement getById()
    [ ] Implement getByUserId() với pagination (skip/take)
    [ ] Implement getUnreadCount()
    [ ] Implement markAsRead()
    [ ] Implement delete()

[ ] 5.3 API Endpoints
    [ ] GET /api/notifications/:userId - với ownership check
    [ ] GET /api/notifications/:userId/unread-count
    [ ] PUT /api/notifications/:id/read
    [ ] DELETE /api/notifications/:id

[ ] 5.4 Cleanup Job
    [ ] Create notification/notification-cleanup.service.ts
    [ ] Use @nestjs/schedule → @Cron() decorator
    [ ] Run daily, delete > 30 days
    [ ] Log cleanup statistics
    [ ] Add PII masking in cleanup logs

[ ] 5.5 Integration
    [ ] Update NotificationService to save history
```

**Verification:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5000/api/notifications/user-123?page=1&limit=20"
```

**Security Verification:**
```bash
# Test accessing another user's notifications → expect 403
# User A's token trying to access User B's notifications
curl -H "Authorization: Bearer <user-a-token>" \
  http://localhost:5000/api/notifications/user-b-id
  # Expected: 403 Forbidden

# Test marking another user's notification as read → expect 403
curl -X PUT -H "Authorization: Bearer <user-a-token>" \
  http://localhost:5000/api/notifications/notification-owned-by-user-b/read
  # Expected: 403 Forbidden

# Test deleting another user's notification → expect 403
curl -X DELETE -H "Authorization: Bearer <user-a-token>" \
  http://localhost:5000/api/notifications/notification-owned-by-user-b
  # Expected: 403 Forbidden
```

---

### Phase 6: Testing & Documentation (Day 6-7)

**Goal:** 80%+ test coverage, documentation complete

**Tasks:**
```
[ ] 6.1 Unit Tests
    [ ] Install: @nestjs/testing (already in devDeps)
    [ ] Create test/unit/email.service.spec.ts
    [ ] Create test/unit/notification.service.spec.ts
    [ ] Create test/unit/notification.gateway.spec.ts
    [ ] Achieve >= 80% coverage

[ ] 6.2 Integration Tests
    [ ] Install testcontainers (optional)
    [ ] Create test/integration/rabbitmq.consumer.spec.ts
    [ ] Create test/integration/email.integration.spec.ts
    [ ] Create test/integration/notification.repository.spec.ts

[ ] 6.3 Documentation
    [ ] Verify Swagger at /swagger
    [ ] Add @ApiOperation, @ApiResponse decorators cho APIs
    [ ] Document environment variables trong .env.example

[ ] 6.4 CI/CD
    [ ] Create .github/workflows/notification-service.yml
    [ ] Build, Test, Docker push steps

[ ] 6.5 Final Review
    [ ] Security checklist (README Section 5.3)
    [ ] Deployment checklist (README Section 11.3)
    [ ] Code review với team lead
    [ ] Merge to dev branch
```

**Test Commands:**
```bash
npm test
npm run test:cov
npm run test:e2e
```

---

### Developer Notes

_Section này để developer ghi chú trong quá trình triển khai_

**Phase 1 Notes:**


**Phase 2 Notes:**


**Phase 3 Notes:**


**Phase 4 Notes:**


**Phase 5 Notes:**


**Phase 6 Notes:**

---

## Appendix A: Gmail SMTP Setup

### Step 1: Enable 2-Factor Authentication
1. Go to Google Account Settings
2. Security > 2-Step Verification > Turn On

### Step 2: Create App Password
1. Google Account > Security > App passwords
2. Select app: "Mail"
3. Select device: "Other" > Enter "TalentFlow Notification"
4. Copy the 16-character password

### Step 3: Set Environment Variable
```bash
SMTP_PASSWORD="xxxx xxxx xxxx xxxx"
```

> **Warning:** Never commit real passwords to git.

---

## Appendix B: Useful Commands

```bash
# Prisma Migrations
npx prisma migrate dev --name MigrationName
npx prisma migrate deploy
npx prisma migrate reset
npx prisma generate
npx prisma studio  # GUI database browser

# Docker
docker build -t notification-service .
docker run -p 5000:5000 --env-file .env notification-service

# RabbitMQ Management
# Access: http://localhost:15672 (guest/guest)

# NestJS CLI
npx @nestjs/cli generate module notification
npx @nestjs/cli generate controller notification
npx @nestjs/cli generate service notification
npx @nestjs/cli generate gateway notification

# Test Socket.IO (browser console)
import { io } from 'socket.io-client';
const socket = io('http://localhost:5000/notifications', {
  auth: { token: 'your-jwt-token' }
});
socket.on('connect', () => socket.emit('joinUserRoom'));
socket.on('receiveNotification', (n) => console.log(n));
```

---
