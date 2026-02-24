## Implementation Phases

### Progress Overview

| Phase | Name | Duration | Status |
|-------|------|----------|--------|
| 1 | Project Setup & Core Infrastructure | Day 1-2 | ⬜ Not Started |
| 2 | Email Service | Day 2-3 | ⬜ Not Started |
| 3 | RabbitMQ Consumer | Day 3-4 | ⬜ Not Started |
| 4 | SignalR Real-time | Day 4-5 | ⬜ Not Started |
| 5 | Notification History | Day 5-6 | ⬜ Not Started |
| 6 | Testing & Documentation | Day 6-7 | ⬜ Not Started |

**Legend:** ⬜ Not Started | 🔄 In Progress | ✅ Completed | ❌ Blocked

---

### Phase 1: Project Setup & Core Infrastructure (Day 1-2)

**Goal:** Project skeleton với health checks hoạt động

**Tasks:**
```
[ ] 1.1 Project Initialization
    [ ] Create solution: dotnet new sln -n NotificationService
    [ ] Create web project: dotnet new webapi -n NotificationService -o src/NotificationService
    [ ] dotnet sln add src/NotificationService
    [ ] Add NuGet packages (see Section 3.3)
    [ ] Configure .gitignore

[ ] 1.2 Configuration Setup
    [ ] Create appsettings.json với tất cả config sections
    [ ] Create Configuration/SmtpSettings.cs
    [ ] Create Configuration/RabbitMQSettings.cs
    [ ] Create Configuration/JwtSettings.cs
    [ ] Create Configuration/SignalRSettings.cs
    [ ] Setup Serilog logging

[ ] 1.3 Database Setup
    [ ] Create Infrastructure/Persistence/AppDbContext.cs
    [ ] Create Models/Notification.cs entity
    [ ] Create Models/NotificationType.cs enum
    [ ] Create Models/NotificationStatus.cs enum
    [ ] Run: dotnet ef migrations add InitialCreate
    [ ] Create Infrastructure/Persistence/NotificationRepository.cs

[ ] 1.4 Authentication Setup
    [ ] Create Infrastructure/Auth/JwtConfiguration.cs
    [ ] Configure JWT Bearer in Program.cs
    [ ] Add startup validation for secrets
    [ ] Test: invalid token → 401

[ ] 1.5 Health Checks
    [ ] Add RabbitMQ health check
    [ ] Add PostgreSQL health check
    [ ] Create Controllers/HealthController.cs
    [ ] Test: curl http://localhost:5000/health

[ ] 1.6 Docker Setup
    [ ] Create Dockerfile (multi-stage build)
    [ ] Update docker-compose.yml
    [ ] Test: docker-compose up notification
```

**Verification:**
```bash
dotnet build
dotnet run --project src/NotificationService
curl http://localhost:5000/health  # Expected: {"status":"Healthy"}
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
[ ] 2.1 Email Models
    [ ] Create Models/EmailMessage.cs
    [ ] Create DTOs/SendNotificationRequest.cs
    [ ] Create DTOs/NotificationResponse.cs

[ ] 2.2 Email Infrastructure
    [ ] Create Services/Interfaces/IEmailService.cs
    [ ] Create Infrastructure/Email/SmtpEmailSender.cs using MailKit
    [ ] Implement retry với Polly (3 attempts, exponential backoff)
    [ ] Add PII masking trong logs

[ ] 2.3 Email Templates
    [ ] Create Infrastructure/Email/EmailTemplates/ folder
    [ ] Create ApplicationConfirmation.html
    [ ] Create InterviewInvitation.html
    [ ] Create NewApplicationHr.html
    [ ] Implement template engine (HTML encoding)

[ ] 2.4 REST API Endpoint
    [ ] Create Controllers/NotificationsController.cs
    [ ] Add [Authorize] attribute
    [ ] Add [EnableRateLimiting] attribute
    [ ] POST /api/notifications/send endpoint
    [ ] Test với JWT token

[ ] 2.5 DI Registration
    [ ] Register IEmailService → SmtpEmailSender
    [ ] Verify startup validation cho SMTP credentials
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
for i in {1..110}; do
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
# Check logs for: "Retry 1 for email after 2s due to: ..."
# Verify Polly retry with exponential backoff (2s, 4s, 8s)
```

---

### Phase 3: RabbitMQ Consumer (Day 3-4)

**Goal:** Subscribe và xử lý events từ RabbitMQ

**Tasks:**
```
[ ] 3.1 RabbitMQ Infrastructure
    [ ] Create Infrastructure/Messaging/RabbitMQConnection.cs
    [ ] Create Infrastructure/Messaging/RabbitMQConsumer.cs
    [ ] Test RabbitMQ connection

[ ] 3.2 Event DTOs
    [ ] Create DTOs/Events/ApplicationCreatedEvent.cs
    [ ] Create DTOs/Events/CvParsedEvent.cs
    [ ] Create DTOs/Events/CvFailedEvent.cs
    [ ] Create DTOs/Events/NotificationSendEvent.cs

[ ] 3.3 Background Worker
    [ ] Create Workers/RabbitMQConsumerWorker.cs
    [ ] Declare exchange: talentflow.events (topic)
    [ ] Declare queue: notification.events
    [ ] Bind routing keys: notification.send, application.created, cv.parsed, cv.failed
    [ ] Implement ACK/NACK
    [ ] Route events to NotificationService

[ ] 3.4 NotificationService Logic
    [ ] Create Services/Interfaces/INotificationService.cs
    [ ] Create Services/NotificationService.cs
    [ ] Implement SendAsync()
    [ ] Implement HandleApplicationCreatedAsync()
    [ ] Implement HandleCvParsedAsync()
    [ ] Implement HandleCvFailedAsync()

[ ] 3.5 DI Registration
    [ ] Register INotificationService
    [ ] Register RabbitMQConsumerWorker as HostedService
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
# Expected: Worker reconnects and resumes processing
```

---

### Phase 4: SignalR Real-time (Day 4-5)

**Goal:** Push real-time notifications qua WebSocket (authenticated)

**Tasks:**
```
[ ] 4.1 SignalR Setup
    [ ] Configure SignalR trong Program.cs
    [ ] Configure JWT authentication cho SignalR (query string token)
    [ ] Setup CORS cho frontend

[ ] 4.2 Hub Implementation
    [ ] Create Hubs/NotificationHub.cs
    [ ] Add [Authorize] attribute
    [ ] Implement JoinUserRoom() - userId từ JWT claims
    [ ] Implement LeaveUserRoom()
    [ ] Add PII masking trong logs

[ ] 4.3 RealtimeService
    [ ] Create Services/Interfaces/IRealtimeService.cs
    [ ] Create Services/RealtimeService.cs
    [ ] Inject IHubContext<NotificationHub>
    [ ] Implement SendToUserAsync(userId, notification)
    [ ] Implement SendToRoleAsync(role, notification)

[ ] 4.4 Integration
    [ ] Update NotificationService to call RealtimeService
    [ ] Send push notification khi có event từ RabbitMQ
    [ ] Test với browser client

[ ] 4.5 DI Registration
    [ ] Register IRealtimeService → RealtimeService
```

**Client Connection (Next.js):**
```typescript
const connection = new signalR.HubConnectionBuilder()
    .withUrl("http://localhost:5000/hubs/notifications", {
        accessTokenFactory: () => getJwtToken(),
    })
    .withAutomaticReconnect()
    .build();

connection.on("ReceiveNotification", (notification) => {
    toast.info(notification.message);
});

await connection.start();
await connection.invoke("JoinUserRoom");
```

**Security Verification:**
```bash
# Test SignalR without token → expect connection refused
# Browser console:
const conn = new signalR.HubConnectionBuilder()
    .withUrl("http://localhost:5000/hubs/notifications")  // No token
    .build();
await conn.start();  // Expected: 401 Unauthorized

# Test SignalR with invalid token → expect connection refused
const conn2 = new signalR.HubConnectionBuilder()
    .withUrl("http://localhost:5000/hubs/notifications", {
        accessTokenFactory: () => "invalid-token"
    })
    .build();
await conn2.start();  // Expected: 401 Unauthorized
```

---

### Phase 5: Notification History (Day 5-6)

**Goal:** Lưu trữ và truy vấn notification history

**Tasks:**
```
[ ] 5.1 Database Schema
    [ ] Update Models/Notification.cs với all fields
    [ ] Run: dotnet ef migrations add AddNotificationHistory
    [ ] Seed test data (optional)

[ ] 5.2 Repository
    [ ] Update NotificationRepository interface
    [ ] Implement GetByIdAsync()
    [ ] Implement GetByUserIdAsync() với pagination
    [ ] Implement GetUnreadCountAsync()
    [ ] Implement MarkAsReadAsync()
    [ ] Implement DeleteAsync()

[ ] 5.3 API Endpoints
    [ ] GET /api/notifications/{userId} - với ownership check
    [ ] GET /api/notifications/{userId}/unread-count
    [ ] PUT /api/notifications/{id}/read
    [ ] DELETE /api/notifications/{id}

[ ] 5.4 Cleanup Job
    [ ] Create Workers/NotificationCleanupWorker.cs
    [ ] Run daily, delete > 30 days
    [ ] Log cleanup statistics
    [ ] Add PII masking in cleanup logs (mask userId, email in bulk delete logs)

[ ] 5.5 Integration
    [ ] Update NotificationService to save history
```

**Verification:**
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/notifications/user-123?page=1&limit=20
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
    [ ] Create tests/NotificationService.Tests/ project
    [ ] Add packages: xUnit, Moq, FluentAssertions
    [ ] Create Unit/EmailServiceTests.cs
    [ ] Create Unit/NotificationServiceTests.cs
    [ ] Create Unit/RealtimeServiceTests.cs
    [ ] Achieve >= 80% coverage

[ ] 6.2 Integration Tests
    [ ] Add TestContainers package
    [ ] Create Integration/RabbitMQConsumerTests.cs
    [ ] Create Integration/SmtpEmailSenderTests.cs
    [ ] Create Integration/NotificationRepositoryTests.cs

[ ] 6.3 Documentation
    [ ] Verify Swagger at /swagger
    [ ] Add XML comments cho public APIs
    [ ] Document environment variables

[ ] 6.4 CI/CD
    [ ] Create .github/workflows/notification-service.yml
    [ ] Build, Test, Docker push steps

[ ] 6.5 Final Review
    [ ] Security checklist (Section 5.3)
    [ ] Deployment checklist (Section 11.3)
    [ ] Code review với team lead
    [ ] Merge to dev branch
```

**Test Commands:**
```bash
dotnet test
dotnet test --collect:"XPlat Code Coverage"
reportgenerator -reports:**/coverage.cobertura.xml -targetdir:coveragereport
```

---

### Developer Notes

_Section này để developer ghi chú trong quá trình triển khai_

**Phase 1 Notes:**


**Phase 2 Notes:**


**Phase 3 Notes:**


**Phase 4 Notes:**


**Phase 5 Notes:**


**Phase 6 Notes:

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
SmtpSettings__Password="xxxx xxxx xxxx xxxx"
```

> **Warning:** Never commit real passwords to git.

---

## Appendix B: Useful Commands

```bash
# EF Core Migrations
dotnet ef migrations add MigrationName
dotnet ef database update
dotnet ef migrations remove

# Docker
docker build -t notification-service .
docker run -p 5000:5000 --env-file .env notification-service

# RabbitMQ Management
# Access: http://localhost:15672 (guest/guest)

# Test SignalR (browser console)
const connection = new signalR.HubConnectionBuilder()
    .withUrl("http://localhost:5000/hubs/notifications", {
        accessTokenFactory: () => "your-jwt-token"
    })
    .build();
await connection.start();
await connection.invoke("JoinUserRoom");
```

---
