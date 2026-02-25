# Notification Service - Implementation Planning

**Version:** 2.0
**Created:** 2026-02-24
**Updated:** 2026-02-24
**Status:** Planning
**Tech Stack:** ASP.NET Core 8 (C# 12)
**Developer:** Yuki

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack & Libraries](#3-tech-stack--libraries)
4. [Project Structure](#4-project-structure)
5. [Security](#5-security)
6. [API Specification](#6-api-specification)
7. [Message Contracts](#7-message-contracts)
8. [Code Examples](#8-code-examples)
9. [Configuration](#9-configuration)
10. [Testing Strategy](#10-testing-strategy)
11. [Definition of Done](#11-definition-of-done)

---

## 1. Overview

### 1.1 Purpose

Notification Service là microservice chịu trách nhiệm:
- **Email**: Gửi email transactional (xác nhận ứng tuyển, mời phỏng vấn, kết quả)
- **Real-time**: Push notification qua WebSocket (SignalR) đến frontend
- **In-app**: Lưu trữ và quản lý notification history
- **Queue Consumer**: Nhận events từ API Gateway và CV Parser qua RabbitMQ

### 1.2 System Context

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SYSTEM ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER 1: SERVICE-TO-SERVICE (Backend Communication)                        │
│  ════════════════════════════════════════════════════                        │
│                                                                              │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │ API Gateway │         │  CV Parser  │         │Notification │           │
│  │  (NestJS)   │         │(Spring Boot)│         │  (ASP.NET)  │           │
│  └──────┬──────┘         └──────┬──────┘         └──────┬──────┘           │
│         │                       │                       ▲                   │
│         │ PUBLISH               │ PUBLISH               │ SUBSCRIBE         │
│         └───────────────────────┴───────────────────────┘                   │
│                                 │                                            │
│                         ┌───────▼───────┐                                   │
│                         │   RabbitMQ    │  ← Unified Message Broker         │
│                         │   (AMQP)      │    Message persistence + DLQ      │
│                         └───────────────┘                                   │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER 2: SERVICE-TO-CLIENT (Real-time Push)                                │
│  ═══════════════════════════════════════════                                │
│                                                                              │
│         ┌─────────────────────┐                                             │
│         │ Notification Service│                                             │
│         │    (ASP.NET)        │                                             │
│         └──────────┬──────────┘                                             │
│                    │                                                         │
│                    │ SignalR WebSocket (Authenticated)                       │
│                    ▼                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                         │
│  │  Browser 1  │  │  Browser 2  │  │  Browser 3  │  ← Frontend clients     │
│  │  (Next.js)  │  │  (Next.js)  │  │  (Next.js)  │                         │
│  └─────────────┘  └─────────────┘  └─────────────┘                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Key Dependencies

| Service | Purpose | Port | Provider (Production) |
|---------|---------|------|----------------------|
| PostgreSQL | Notification history | 5432 | Supabase / Neon |
| RabbitMQ | Message queue (AMQP) | 5672 | CloudAMQP |
| Redis | Caching, SignalR backplane | 6379 | Upstash |
| Gmail SMTP | Email sending | 587 | Gmail / SendGrid |

### 1.4 Core Features

| Feature | Priority | Description |
|---------|----------|-------------|
| Email Sending | P0 (MVP) | Gửi email qua Gmail SMTP |
| RabbitMQ Consumer | P0 (MVP) | Subscribe events từ RabbitMQ |
| Health Check | P0 (MVP) | Kubernetes readiness/liveness |
| JWT Authentication | P0 (MVP) | Bảo vệ API và SignalR Hub |
| SignalR Hub | P1 | Real-time WebSocket notifications |
| Notification History | P1 | Lưu trữ và truy vấn notification |
| Email Templates | P2 | HTML templates với Scriban |
| Retry Mechanism | P2 | Retry failed emails với Polly |

---

## 2. Architecture

### 2.1 Architecture Pattern: Clean Architecture (Simplified)

```
+-----------------------------------------------------------------------------+
|                         NOTIFICATION SERVICE                                 |
+-----------------------------------------------------------------------------+
|                                                                              |
|  +-----------------------------------------------------------------------+  |
|  |                           API LAYER                                   |  |
|  |  +-------------------+  +-------------------+  +-------------------+  |  |
|  |  |   Controllers     |  |   SignalR Hub     |  |   Health Checks   |  |  |
|  |  |   [Authorize]     |  |   [Authorize]     |  |                   |  |  |
|  |  +-------------------+  +-------------------+  +-------------------+  |  |
|  +-----------------------------------------------------------------------+  |
|                                    |                                         |
|                                    v                                         |
|  +-----------------------------------------------------------------------+  |
|  |                        APPLICATION LAYER                              |  |
|  |  +-------------------+  +-------------------+  +-------------------+  |  |
|  |  |  INotification    |  |  IEmailService    |  |  IRealtimeService |  |  |
|  |  |     Service       |  |                   |  |                   |  |  |
|  |  +-------------------+  +-------------------+  +-------------------+  |  |
|  +-----------------------------------------------------------------------+  |
|                                    |                                         |
|                                    v                                         |
|  +-----------------------------------------------------------------------+  |
|  |                      INFRASTRUCTURE LAYER                             |  |
|  |  +-------------+  +-------------+  +-------------+  +-------------+   |  |
|  |  | SmtpEmail   |  | RabbitMQ    |  | SignalR     |  | EF Core     |   |  |
|  |  | Sender      |  | Consumer    |  | Broadcaster |  | Repository  |   |  |
|  |  +-------------+  +-------------+  +-------------+  +-------------+   |  |
|  +-----------------------------------------------------------------------+  |
|                                                                              |
|  +-----------------------------------------------------------------------+  |
|  |                      BACKGROUND SERVICES                              |  |
|  |  +---------------------------+  +---------------------------+         |  |
|  |  |  RabbitMQConsumerWorker   |  |    EmailRetryWorker       |         |  |
|  |  +---------------------------+  +---------------------------+         |  |
|  +-----------------------------------------------------------------------+  |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### 2.2 Why This Architecture?

| Aspect | Benefit |
|--------|---------|
| **Separation of Concerns** | API, Business Logic, Infrastructure tách biệt |
| **Testability** | Dễ mock interfaces, unit test từng layer |
| **Flexibility** | Dễ thay đổi email provider (SMTP → SendGrid) |
| **Maintainability** | Code rõ ràng, dễ đọc và maintain |
| **Security** | Authentication/Authorization ở API layer |

### 2.3 Data Flow

```
1. INBOUND (RabbitMQ → Service)
   RabbitMQ Queue --> RabbitMQConsumerWorker --> NotificationService --> Email/SignalR

2. OUTBOUND (Client → Service)
   HTTP Request (+ JWT) --> [Authorize] Controller --> NotificationService --> Response
   WebSocket (+ JWT) --> [Authorize] SignalR Hub --> Client Push
```

### 2.4 Message Broker vs SignalR

| Component | Vai trò | Protocol | Ai connect được? |
|-----------|---------|----------|------------------|
| **RabbitMQ** | Backend-to-backend messaging | AMQP | Chỉ backend services |
| **SignalR** | Real-time push đến browser | WebSocket | Frontend clients (authenticated) |

### 2.5 Scaling Considerations

#### SignalR Redis Backplane (Horizontal Scaling)

Khi chạy nhiều instances của Notification Service, cần Redis backplane để sync SignalR connections:

```csharp
// Program.cs - Production setup với Redis backplane
builder.Services.AddSignalR()
    .AddStackExchangeRedis(builder.Configuration["Redis:ConnectionString"]!,
        options =>
        {
            options.Configuration.ChannelPrefix = "NotificationService";
        });

// NuGet Package cần thêm:
// <PackageReference Include="Microsoft.AspNetCore.SignalR.StackExchangeRedis" Version="8.0.0" />
```

**Khi nào cần Redis backplane:**
- Chạy > 1 instance của Notification Service
- Load balancer phân phối connections giữa các instances
- User có thể connect tới instance A, nhưng message cần push từ instance B

#### RabbitMQ Multi-Consumer (Idempotency)

Khi scale nhiều instances, mỗi instance sẽ consume messages từ cùng queue:

```csharp
// RabbitMQ đã tự động load-balance giữa các consumers
// Mỗi message chỉ được deliver tới 1 consumer

// Đảm bảo idempotency:
// 1. Sử dụng unique messageId để detect duplicates
// 2. Check trước khi insert notification (upsert pattern)

public async Task HandleApplicationCreatedAsync(ApplicationCreatedEvent evt)
{
    // Idempotency check - tránh duplicate notifications
    var existing = await _repository.GetByExternalIdAsync(evt.ApplicationId);
    if (existing != null)
    {
        _logger.LogInformation("Notification already processed for {AppId}", evt.ApplicationId);
        return;
    }

    // Process notification...
}
```

**Best Practices:**
- **Prefetch count**: Set `channel.BasicQos(prefetchCount: 10)` để control workload
- **Manual ACK**: Chỉ ACK sau khi xử lý thành công
- **Idempotency key**: Sử dụng `applicationId` hoặc `messageId` để detect duplicates
- **Dead Letter Queue**: NACK với `requeue: false` để chuyển failed messages vào DLQ

---

## 3. Tech Stack & Libraries

### 3.1 Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **.NET** | 8.0 LTS | Runtime |
| **ASP.NET Core** | 8.0 | Web framework |
| **C#** | 12 | Language |
| **Entity Framework Core** | 8.0 | ORM |
| **PostgreSQL** | 16.x | Database |

### 3.2 Key Libraries

| Library | NuGet Package | Purpose |
|---------|---------------|---------|
| **SignalR** | Microsoft.AspNetCore.SignalR | Real-time WebSocket |
| **RabbitMQ.Client** | RabbitMQ.Client | RabbitMQ consumer |
| **MailKit** | MailKit | SMTP email sending |
| **Npgsql** | Npgsql.EntityFrameworkCore.PostgreSQL | PostgreSQL driver |
| **Serilog** | Serilog.AspNetCore | Structured logging |
| **Polly** | Polly | Retry/Circuit breaker |
| **JWT Bearer** | Microsoft.AspNetCore.Authentication.JwtBearer | Authentication |

### 3.3 NuGet Packages (.csproj)

```xml
<ItemGroup>
    <!-- ASP.NET Core -->
    <!-- Note: SignalR is included in ASP.NET Core 8 shared framework, no separate package needed -->
    <!-- Only add if targeting .NET Standard or need specific SignalR features -->
    <!-- <PackageReference Include="Microsoft.AspNetCore.SignalR.Client" Version="8.0.0" /> -->
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.0.0" />

    <!-- Database -->
    <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="8.0.0" />

    <!-- Message Queue -->
    <PackageReference Include="RabbitMQ.Client" Version="6.8.1" />

    <!-- Email -->
    <PackageReference Include="MailKit" Version="4.3.0" />
    <PackageReference Include="Scriban" Version="5.9.1" />

    <!-- Resilience -->
    <PackageReference Include="Polly" Version="8.2.0" />
    <PackageReference Include="Microsoft.Extensions.Http.Polly" Version="8.0.0" />

    <!-- Logging -->
    <PackageReference Include="Serilog.AspNetCore" Version="8.0.0" />
    <PackageReference Include="Serilog.Sinks.Console" Version="5.0.1" />

    <!-- Health Checks -->
    <PackageReference Include="AspNetCore.HealthChecks.Rabbitmq" Version="8.0.0" />
    <PackageReference Include="AspNetCore.HealthChecks.NpgSql" Version="8.0.0" />

    <!-- Swagger -->
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />
</ItemGroup>
```

---

## 4. Project Structure

### 4.1 Solution Layout

```
notification/
├── src/
│   └── NotificationService/
│       ├── NotificationService.csproj
│       │
│       ├── Program.cs                      # Entry point
│       │
│       ├── Controllers/                    # API Endpoints
│       │   ├── NotificationsController.cs  # [Authorize]
│       │   └── HealthController.cs
│       │
│       ├── Hubs/                           # SignalR Real-time
│       │   └── NotificationHub.cs          # [Authorize]
│       │
│       ├── Models/                         # Domain Models
│       │   ├── Notification.cs
│       │   ├── NotificationType.cs
│       │   ├── NotificationStatus.cs
│       │   └── EmailMessage.cs
│       │
│       ├── DTOs/                           # Data Transfer Objects
│       │   ├── SendNotificationRequest.cs
│       │   ├── NotificationResponse.cs
│       │   └── Events/
│       │       ├── ApplicationCreatedEvent.cs
│       │       ├── CvParsedEvent.cs
│       │       ├── CvFailedEvent.cs
│       │       └── NotificationSendEvent.cs
│       │
│       ├── Services/                       # Business Logic
│       │   ├── Interfaces/
│       │   │   ├── INotificationService.cs
│       │   │   ├── IEmailService.cs
│       │   │   └── IRealtimeService.cs
│       │   ├── NotificationService.cs
│       │   ├── EmailService.cs
│       │   └── RealtimeService.cs
│       │
│       ├── Infrastructure/                 # External Integrations
│       │   ├── Auth/
│       │   │   └── JwtConfiguration.cs
│       │   ├── Email/
│       │   │   ├── SmtpEmailSender.cs
│       │   │   └── EmailTemplates/
│       │   │       ├── ApplicationConfirmation.html
│       │   │       ├── InterviewInvitation.html
│       │   │       └── ApplicationResult.html
│       │   ├── Messaging/
│       │   │   ├── RabbitMQConnection.cs
│       │   │   └── RabbitMQConsumer.cs
│       │   └── Persistence/
│       │       ├── AppDbContext.cs
│       │       └── NotificationRepository.cs
│       │
│       ├── Workers/                        # Background Services
│       │   ├── RabbitMQConsumerWorker.cs
│       │   └── EmailRetryWorker.cs
│       │
│       ├── Configuration/                  # Config Classes
│       │   ├── SmtpSettings.cs
│       │   ├── RabbitMQSettings.cs
│       │   ├── JwtSettings.cs
│       │   └── SignalRSettings.cs
│       │
│       └── appsettings.json
│
├── tests/
│   └── NotificationService.Tests/
│       ├── NotificationService.Tests.csproj
│       ├── Unit/
│       │   ├── EmailServiceTests.cs
│       │   ├── NotificationServiceTests.cs
│       │   └── RealtimeServiceTests.cs
│       └── Integration/
│           ├── RabbitMQConsumerTests.cs
│           └── SmtpEmailSenderTests.cs
│
├── Dockerfile
├── IMPLEMENTATION-PHASES.md               # Task tracking
└── NotificationService.sln
```

### 4.2 File Descriptions

| File/Folder | Purpose |
|-------------|---------|
| `Program.cs` | Entry point, DI configuration, middleware setup |
| `Controllers/` | HTTP API endpoints (REST) với `[Authorize]` |
| `Hubs/` | SignalR WebSocket endpoints với `[Authorize]` |
| `Models/` | Domain entities (EF Core) |
| `DTOs/` | Request/Response objects, Event contracts |
| `Services/` | Business logic interfaces & implementations |
| `Infrastructure/` | External service integrations (SMTP, RabbitMQ, DB) |
| `Workers/` | Background hosted services |
| `Configuration/` | Strongly-typed configuration classes |

---

## 5. Security

### 5.1 Authentication

Service sử dụng JWT Bearer token từ API Gateway:

```csharp
// Program.cs
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["JwtSettings:Issuer"],
            ValidAudience = builder.Configuration["JwtSettings:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["JwtSettings:SecretKey"]!))
        };

        // SignalR JWT from query string
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });
```

### 5.2 Authorization

**Controllers:**
```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize]  // Yêu cầu JWT token
public class NotificationsController : ControllerBase
{
    [HttpGet("{userId}")]
    public async Task<IActionResult> GetByUserId(string userId)
    {
        // Chỉ cho phép user xem notification của chính mình
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (currentUserId != userId)
            return Forbid();

        // ...
    }
}
```

**SignalR Hub:**
```csharp
[Authorize]
public class NotificationHub : Hub
{
    public async Task JoinUserRoom()
    {
        // Lấy userId từ JWT claims, KHÔNG từ client input
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
            throw new HubException("User not authenticated");

        await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
    }
}
```

### 5.3 Security Checklist

- [ ] JWT validation với issuer, audience, expiry
- [ ] SignalR Hub yêu cầu authentication
- [ ] User chỉ access notification của chính mình
- [ ] CORS chỉ allow specific origins
- [ ] Rate limiting trên endpoints
- [ ] Input validation cho tất cả DTOs
- [ ] PII masking trong logs
- [ ] Secrets từ environment variables (không hardcode)

### 5.4 Secrets Management

**KHÔNG BAO GIỜ** commit secrets vào git:

```csharp
// Program.cs - Startup validation
var smtpSettings = builder.Configuration.GetSection("SmtpSettings").Get<SmtpSettings>();
if (string.IsNullOrEmpty(smtpSettings?.Password))
{
    throw new InvalidOperationException(
        "SMTP credentials not configured. Set SmtpSettings__Password environment variable.");
}

var jwtSettings = builder.Configuration.GetSection("JwtSettings").Get<JwtSettings>();
if (string.IsNullOrEmpty(jwtSettings?.SecretKey))
{
    throw new InvalidOperationException(
        "JWT secret not configured. Set JwtSettings__SecretKey environment variable.");
}
```

---

## 6. API Specification

### 6.1 REST Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/notifications/send` | ✅ | Send notification (email/push) |
| GET | `/api/notifications/{userId}` | ✅ | Get user's notifications (own only) |
| GET | `/api/notifications/{userId}/unread-count` | ✅ | Get unread count |
| PUT | `/api/notifications/{id}/read` | ✅ | Mark as read |
| DELETE | `/api/notifications/{id}` | ✅ | Delete notification |
| GET | `/health` | ❌ | Health check |
| GET | `/health/ready` | ❌ | Readiness check |
| GET | `/health/live` | ❌ | Liveness check |

### 6.2 Request/Response Examples

**POST /api/notifications/send**
```json
// Request (với Authorization: Bearer <token>)
{
  "to": "candidate@example.com",
  "subject": "Application Received",
  "body": "Thank you for applying to Senior Developer position.",
  "type": "email",
  "metadata": {
    "applicationId": "uuid",
    "jobId": "uuid"
  }
}

// Response
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "sent",
    "sentAt": "2026-02-24T10:30:00Z"
  }
}
```

**GET /api/notifications/{userId}**
```json
// Response
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "application_update",
      "title": "Application Status Updated",
      "message": "Your application has been reviewed",
      "isRead": false,
      "createdAt": "2026-02-24T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45
  }
}
```

### 6.3 SignalR Hub Methods

| Direction | Method | Description |
|-----------|--------|-------------|
| Client → Server | `JoinUserRoom()` | Subscribe to authenticated user's notifications |
| Client → Server | `LeaveUserRoom()` | Unsubscribe |
| Server → Client | `ReceiveNotification(notification)` | Push notification to client |

**Client Connection (Next.js):**
```typescript
import * as signalR from "@microsoft/signalr";

const connection = new signalR.HubConnectionBuilder()
    .withUrl("https://notification-service.example.com/hubs/notifications", {
        accessTokenFactory: () => getJwtToken(), // JWT từ auth context
    })
    .withAutomaticReconnect()
    .build();

connection.on("ReceiveNotification", (notification) => {
    toast.info(notification.message);
});

await connection.start();
await connection.invoke("JoinUserRoom"); // userId lấy từ JWT
```

---

## 7. Message Contracts

### 7.1 RabbitMQ Configuration

| Property | Value |
|----------|-------|
| Exchange | `talentflow.events` |
| Exchange Type | `topic` |
| Queue | `notification.events` |

**Routing Keys:**

| Routing Key | Publisher | Description |
|-------------|-----------|-------------|
| `notification.send` | API Gateway | Generic notification request |
| `application.created` | API Gateway | New application submitted |
| `cv.parsed` | CV Parser | CV processing completed |
| `cv.failed` | CV Parser | CV processing failed |

### 7.2 Inbound Events (RabbitMQ Subscribe)

**Event: `notification.send`**
```json
{
  "type": "email",
  "to": "user@example.com",
  "subject": "Subject",
  "body": "Email body",
  "templateId": "application_confirmation",
  "templateData": {
    "candidateName": "Nguyen Van A",
    "jobTitle": "Senior Developer"
  }
}
```

**Event: `application.created`**
```json
{
  "applicationId": "uuid",
  "candidateId": "uuid",
  "candidateEmail": "candidate@example.com",
  "candidateName": "Nguyen Van A",
  "jobId": "uuid",
  "jobTitle": "Senior Developer",
  "companyName": "TechCorp Vietnam",
  "createdAt": "2026-02-24T10:30:00Z"
}
```

**Event: `cv.parsed`** (synced với CV Parser)
```json
{
  "candidateId": "uuid",
  "applicationId": "uuid",
  "jobId": "uuid",
  "aiScore": 85,
  "parsedData": {
    "fullName": "Nguyen Van A",
    "email": "nguyen.van.a@example.com",
    "phone": "+84912345678",
    "skills": ["Java", "Spring Boot", "PostgreSQL", "Docker"],
    "experience": [
      {
        "title": "Senior Developer",
        "company": "TechCorp Vietnam",
        "startDate": "2020-01",
        "endDate": "2024-02",
        "description": "Led development team..."
      }
    ],
    "education": [
      {
        "degree": "Bachelor of Computer Science",
        "institution": "HCMUS",
        "graduationYear": "2018"
      }
    ],
    "summary": "5 years experience in Java development..."
  },
  "scoringReasoning": "Strong skills match...",
  "parsedAt": "2026-02-24T10:30:15Z"
}
```

> **Schema Note:** All parsedData fields except `fullName`, `email`, `skills` are OPTIONAL. Consumer DTOs should handle null/missing values gracefully.

**Event: `cv.failed`** (synced với CV Parser)
```json
{
  "candidateId": "uuid",
  "applicationId": "uuid",
  "jobId": "uuid",
  "errorCode": "PARSING_FAILED",
  "errorMessage": "Unable to extract text from PDF",
  "retryable": false,
  "failedAt": "2026-02-24T10:30:15Z"
}
```

### 7.3 Email Templates

| Template ID | Trigger Event | Recipients |
|-------------|---------------|------------|
| `application_confirmation` | `application.created` | Candidate |
| `new_application_hr` | `application.created` | HR/Recruiter |
| `cv_parsed_hr` | `cv.parsed` | HR/Recruiter |
| `cv_failed_hr` | `cv.failed` | HR/Recruiter |

---

## 8. Code Examples

### 8.1 Program.cs (Entry Point)

```csharp
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using NotificationService.Configuration;
using NotificationService.Hubs;
using NotificationService.Infrastructure.Email;
using NotificationService.Infrastructure.Persistence;
using NotificationService.Services;
using NotificationService.Services.Interfaces;
using NotificationService.Workers;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// ==================== CONFIGURATION ====================

// Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .CreateLogger();
builder.Host.UseSerilog();

// Strongly-typed configuration
builder.Services.Configure<SmtpSettings>(
    builder.Configuration.GetSection("SmtpSettings"));
builder.Services.Configure<RabbitMQSettings>(
    builder.Configuration.GetSection("RabbitMQSettings"));
builder.Services.Configure<JwtSettings>(
    builder.Configuration.GetSection("JwtSettings"));

// ==================== STARTUP VALIDATION ====================

var smtpSettings = builder.Configuration.GetSection("SmtpSettings").Get<SmtpSettings>();
if (string.IsNullOrEmpty(smtpSettings?.Password))
{
    throw new InvalidOperationException("SMTP credentials not configured");
}

var jwtSettings = builder.Configuration.GetSection("JwtSettings").Get<JwtSettings>();
if (string.IsNullOrEmpty(jwtSettings?.SecretKey))
{
    throw new InvalidOperationException("JWT secret not configured");
}

// ==================== AUTHENTICATION ====================

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidAudience = jwtSettings.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSettings.SecretKey))
        };

        // SignalR JWT from query string
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// ==================== DATABASE ====================

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ==================== SERVICES (DI) ====================

builder.Services.AddScoped<IEmailService, SmtpEmailSender>();
builder.Services.AddScoped<INotificationService, NotificationService.Services.NotificationService>();
builder.Services.AddScoped<IRealtimeService, RealtimeService>();

// ==================== BACKGROUND WORKERS ====================

builder.Services.AddHostedService<RabbitMQConsumerWorker>();
builder.Services.AddHostedService<EmailRetryWorker>();

// ==================== SIGNALR ====================

// Basic SignalR (single instance)
builder.Services.AddSignalR();

// For horizontal scaling, use Redis backplane:
// builder.Services.AddSignalR()
//     .AddStackExchangeRedis(builder.Configuration["Redis:ConnectionString"]!,
//         options =>
//         {
//             options.Configuration.ChannelPrefix = "NotificationService";
//         });

// ==================== CONTROLLERS + SWAGGER ====================

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ==================== HEALTH CHECKS ====================

builder.Services.AddHealthChecks()
    .AddNpgSql(builder.Configuration.GetConnectionString("DefaultConnection")!)
    .AddRabbitMQ(builder.Configuration["RabbitMQSettings:ConnectionString"]!);

// ==================== CORS ====================

var allowedOrigins = builder.Configuration
    .GetSection("SignalRSettings:AllowedOrigins")
    .Get<string[]>() ?? ["http://localhost:3000"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// ==================== RATE LIMITING ====================

builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("notification", opt =>
    {
        opt.PermitLimit = 100;
        opt.Window = TimeSpan.FromMinutes(1);
    });
});

var app = builder.Build();

// ==================== MIDDLEWARE PIPELINE ====================

app.UseSerilogRequestLogging();
app.UseSwagger();
app.UseSwaggerUI();
app.UseCors("AllowFrontend");
app.UseRateLimiter();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

// ==================== ENDPOINTS ====================

app.MapControllers();
app.MapHub<NotificationHub>("/hubs/notifications");
app.MapHealthChecks("/health");

app.Run();
```

### 8.2 NotificationHub (Authenticated)

```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace NotificationService.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    private readonly ILogger<NotificationHub> _logger;

    public NotificationHub(ILogger<NotificationHub> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Client joins their own room (userId from JWT, not client input)
    /// </summary>
    public async Task JoinUserRoom()
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            throw new HubException("User not authenticated");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
        _logger.LogInformation(
            "Client {ConnectionId} joined room for user {UserId}",
            Context.ConnectionId, MaskUserId(userId));
    }

    /// <summary>
    /// Client leaves their room
    /// </summary>
    public async Task LeaveUserRoom()
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId)) return;

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{userId}");
        _logger.LogInformation(
            "Client {ConnectionId} left room for user {UserId}",
            Context.ConnectionId, MaskUserId(userId));
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        _logger.LogInformation(
            "Client connected: {ConnectionId}, User: {UserId}",
            Context.ConnectionId, MaskUserId(userId));
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation(
            "Client disconnected: {ConnectionId}, Exception: {Exception}",
            Context.ConnectionId, exception?.Message);
        await base.OnDisconnectedAsync(exception);
    }

    // Mask PII in logs
    private static string MaskUserId(string? userId)
    {
        if (string.IsNullOrEmpty(userId) || userId.Length < 8)
            return "***";
        return $"{userId[..4]}...{userId[^4..]}";
    }
}
```

### 8.3 RabbitMQConsumerWorker

```csharp
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using NotificationService.Configuration;
using NotificationService.DTOs.Events;
using NotificationService.Services.Interfaces;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace NotificationService.Workers;

public class RabbitMQConsumerWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly RabbitMQSettings _settings;
    private readonly ILogger<RabbitMQConsumerWorker> _logger;
    private IConnection? _connection;
    private IModel? _channel;

    public RabbitMQConsumerWorker(
        IServiceProvider serviceProvider,
        IOptions<RabbitMQSettings> settings,
        ILogger<RabbitMQConsumerWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _settings = settings.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("RabbitMQ Consumer Worker starting...");

        try
        {
            var factory = new ConnectionFactory
            {
                Uri = new Uri(_settings.ConnectionString),
                DispatchConsumersAsync = true
            };

            _connection = factory.CreateConnection();
            _channel = _connection.CreateModel();

            // Declare exchange and queue
            _channel.ExchangeDeclare(
                exchange: "talentflow.events",
                type: ExchangeType.Topic,
                durable: true);

            _channel.QueueDeclare(
                queue: "notification.events",
                durable: true,
                exclusive: false,
                autoDelete: false);

            // Bind routing keys
            var routingKeys = new[]
            {
                "notification.send",
                "application.created",
                "cv.parsed",
                "cv.failed"
            };

            foreach (var key in routingKeys)
            {
                _channel.QueueBind(
                    queue: "notification.events",
                    exchange: "talentflow.events",
                    routingKey: key);
            }

            // Consumer
            var consumer = new AsyncEventingBasicConsumer(_channel);
            consumer.Received += async (_, ea) =>
            {
                var body = Encoding.UTF8.GetString(ea.Body.ToArray());
                var routingKey = ea.RoutingKey;

                try
                {
                    await ProcessMessageAsync(routingKey, body);
                    _channel.BasicAck(ea.DeliveryTag, multiple: false);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing message: {RoutingKey}", routingKey);
                    // Nack with requeue=false to send to DLQ
                    _channel.BasicNack(ea.DeliveryTag, multiple: false, requeue: false);
                }
            };

            _channel.BasicConsume(
                queue: "notification.events",
                autoAck: false,
                consumer: consumer);

            _logger.LogInformation("Subscribed to RabbitMQ queue: notification.events");

            // Keep running
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("RabbitMQ Consumer Worker stopping...");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in RabbitMQ Consumer Worker");
        }
    }

    private async Task ProcessMessageAsync(string routingKey, string message)
    {
        using var scope = _serviceProvider.CreateScope();
        var notificationService = scope.ServiceProvider
            .GetRequiredService<INotificationService>();

        switch (routingKey)
        {
            case "notification.send":
                var sendEvent = JsonSerializer.Deserialize<NotificationSendEvent>(message);
                if (sendEvent != null)
                    await notificationService.SendAsync(sendEvent);
                break;

            case "application.created":
                var appEvent = JsonSerializer.Deserialize<ApplicationCreatedEvent>(message);
                if (appEvent != null)
                    await notificationService.HandleApplicationCreatedAsync(appEvent);
                break;

            case "cv.parsed":
                var parsedEvent = JsonSerializer.Deserialize<CvParsedEvent>(message);
                if (parsedEvent != null)
                    await notificationService.HandleCvParsedAsync(parsedEvent);
                break;

            case "cv.failed":
                var failedEvent = JsonSerializer.Deserialize<CvFailedEvent>(message);
                if (failedEvent != null)
                    await notificationService.HandleCvFailedAsync(failedEvent);
                break;

            default:
                _logger.LogWarning("Unknown routing key: {RoutingKey}", routingKey);
                break;
        }
    }

    public override Task StopAsync(CancellationToken cancellationToken)
    {
        _channel?.Close();
        _connection?.Close();
        return base.StopAsync(cancellationToken);
    }
}
```

### 8.4 SmtpEmailSender (với Retry)

```csharp
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using NotificationService.Configuration;
using NotificationService.Services.Interfaces;
using Polly;
using Polly.Retry;

namespace NotificationService.Infrastructure.Email;

public class SmtpEmailSender : IEmailService
{
    private readonly SmtpSettings _settings;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<SmtpEmailSender> _logger;
    private readonly AsyncRetryPolicy _retryPolicy;

    public SmtpEmailSender(
        IOptions<SmtpSettings> settings,
        IWebHostEnvironment env,
        ILogger<SmtpEmailSender> logger)
    {
        _settings = settings.Value;
        _env = env;
        _logger = logger;

        // Retry policy: 3 attempts with exponential backoff
        _retryPolicy = Policy
            .Handle<Exception>()
            .WaitAndRetryAsync(
                retryCount: 3,
                sleepDurationProvider: attempt => TimeSpan.FromSeconds(Math.Pow(2, attempt)),
                onRetry: (exception, timeSpan, retryCount, context) =>
                {
                    _logger.LogWarning(
                        "Retry {RetryCount} for email after {Delay}s due to: {Message}",
                        retryCount, timeSpan.TotalSeconds, exception.Message);
                });
    }

    public async Task<bool> SendAsync(
        EmailMessage message,
        CancellationToken cancellationToken = default)
    {
        return await _retryPolicy.ExecuteAsync(async () =>
        {
            var email = new MimeMessage();
            email.From.Add(new MailboxAddress(_settings.FromName, _settings.FromEmail));
            email.To.Add(MailboxAddress.Parse(message.To));
            email.Subject = message.Subject;

            var bodyBuilder = new BodyBuilder { HtmlBody = message.Body };
            email.Body = bodyBuilder.ToMessageBody();

            using var smtp = new SmtpClient();

            await smtp.ConnectAsync(
                _settings.Host,
                _settings.Port,
                SecureSocketOptions.StartTls,
                cancellationToken);

            await smtp.AuthenticateAsync(
                _settings.Username,
                _settings.Password,
                cancellationToken);

            await smtp.SendAsync(email, cancellationToken);
            await smtp.DisconnectAsync(true, cancellationToken);

            _logger.LogInformation(
                "Email sent successfully to {To}, Subject: {Subject}",
                MaskEmail(message.To),
                message.Subject);

            return true;
        });
    }

    public async Task<bool> SendTemplateAsync(
        string templateId,
        string to,
        Dictionary<string, string> templateData,
        CancellationToken cancellationToken = default)
    {
        // Use IWebHostEnvironment for correct path
        var templatePath = Path.Combine(
            _env.ContentRootPath,
            "Infrastructure", "Email", "EmailTemplates",
            $"{templateId}.html");

        if (!File.Exists(templatePath))
        {
            _logger.LogError("Email template not found: {TemplateId}", templateId);
            return false;
        }

        var template = await File.ReadAllTextAsync(templatePath, cancellationToken);

        // Replace placeholders (consider using Scriban for production)
        foreach (var kvp in templateData)
        {
            template = template.Replace($"{{{{{kvp.Key}}}}}",
                System.Web.HttpUtility.HtmlEncode(kvp.Value)); // XSS protection
        }

        var message = new EmailMessage
        {
            To = to,
            Subject = GetSubjectForTemplate(templateId),
            Body = template
        };

        return await SendAsync(message, cancellationToken);
    }

    private static string GetSubjectForTemplate(string templateId) => templateId switch
    {
        "application_confirmation" => "Application Received - TalentFlow",
        "interview_invitation" => "Interview Invitation - TalentFlow",
        "application_result" => "Application Update - TalentFlow",
        "new_application_hr" => "New Application Received - TalentFlow",
        "cv_parsed_hr" => "CV Analysis Complete - TalentFlow",
        "cv_failed_hr" => "CV Processing Failed - TalentFlow",
        _ => "Notification from TalentFlow"
    };

    // Mask PII in logs
    private static string MaskEmail(string email)
    {
        var parts = email.Split('@');
        if (parts.Length != 2) return "***@***";
        var name = parts[0];
        var masked = name.Length > 2
            ? $"{name[0]}***{name[^1]}"
            : "***";
        return $"{masked}@{parts[1]}";
    }
}
```

### 8.5 NotificationsController (Authorized)

```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using NotificationService.DTOs;
using NotificationService.Services.Interfaces;

namespace NotificationService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("notification")]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;
    private readonly ILogger<NotificationsController> _logger;

    public NotificationsController(
        INotificationService notificationService,
        ILogger<NotificationsController> logger)
    {
        _notificationService = notificationService;
        _logger = logger;
    }

    /// <summary>
    /// Send a notification (email or push)
    /// </summary>
    [HttpPost("send")]
    public async Task<IActionResult> Send([FromBody] SendNotificationRequest request)
    {
        var result = await _notificationService.SendAsync(request);

        if (result.Success)
        {
            return Ok(new { success = true, data = result });
        }

        return BadRequest(new { success = false, error = result.ErrorMessage });
    }

    /// <summary>
    /// Get notifications for a user (own only)
    /// </summary>
    [HttpGet("{userId}")]
    public async Task<IActionResult> GetByUserId(
        string userId,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20)
    {
        // Authorization: user can only access own notifications
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (currentUserId != userId)
        {
            return Forbid();
        }

        var notifications = await _notificationService.GetByUserIdAsync(userId, page, limit);
        return Ok(new { success = true, data = notifications });
    }

    /// <summary>
    /// Get unread notification count
    /// </summary>
    [HttpGet("{userId}/unread-count")]
    public async Task<IActionResult> GetUnreadCount(string userId)
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (currentUserId != userId)
        {
            return Forbid();
        }

        var count = await _notificationService.GetUnreadCountAsync(userId);
        return Ok(new { success = true, data = new { count } });
    }

    /// <summary>
    /// Mark notification as read
    /// </summary>
    [HttpPut("{id}/read")]
    public async Task<IActionResult> MarkAsRead(string id)
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        // Verify ownership before marking as read
        var notification = await _notificationService.GetByIdAsync(id);
        if (notification == null)
            return NotFound();
        if (notification.UserId != currentUserId)
            return Forbid();

        await _notificationService.MarkAsReadAsync(id);
        return Ok(new { success = true });
    }

    /// <summary>
    /// Delete a notification
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        var notification = await _notificationService.GetByIdAsync(id);
        if (notification == null)
            return NotFound();
        if (notification.UserId != currentUserId)
            return Forbid();

        await _notificationService.DeleteAsync(id);
        return Ok(new { success = true });
    }
}
```

---

## 9. Configuration

### 9.1 appsettings.json

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "Serilog": {
    "Using": ["Serilog.Sinks.Console"],
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "System": "Warning"
      }
    },
    "WriteTo": [
      {
        "Name": "Console",
        "Args": {
          "outputTemplate": "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}"
        }
      }
    ]
  },
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=talentflow_dev;Username=YOUR_DB_USER;Password=YOUR_DB_PASSWORD"
  },
  "RabbitMQSettings": {
    "ConnectionString": "amqp://YOUR_RABBITMQ_USER:YOUR_RABBITMQ_PASSWORD@localhost:5672"
  },
  "SmtpSettings": {
    "Host": "smtp.gmail.com",
    "Port": 587,
    "UseSsl": true,
    "Username": "YOUR_SMTP_USERNAME",
    "Password": "YOUR_SMTP_APP_PASSWORD",
    "FromEmail": "noreply@talentflow.ai",
    "FromName": "TalentFlow AI"
  },
  "JwtSettings": {
    "Issuer": "talentflow-api-gateway",
    "Audience": "talentflow-services",
    "SecretKey": "YOUR_JWT_SECRET_KEY_MIN_256_BITS"
  },
  "SignalRSettings": {
    "AllowedOrigins": ["http://localhost:3000"]
  }
}
```

### 9.2 Environment Variables (Production)

```bash
# Database
ConnectionStrings__DefaultConnection=Host=db.supabase.co;Port=5432;Database=talentflow;Username=postgres;Password=secret

# RabbitMQ (CloudAMQP)
RabbitMQSettings__ConnectionString=amqps://user:pass@rabbit.cloudamqp.com/vhost

# SMTP
SmtpSettings__Username=prod-email@company.com
SmtpSettings__Password=prod-app-password

# JWT (same key as API Gateway)
JwtSettings__SecretKey=your-256-bit-secret-key-here

# ASP.NET
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://+:5000

# CORS
SignalRSettings__AllowedOrigins__0=https://talentflow.example.com
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

| Test Class | Coverage Target | Focus |
|------------|-----------------|-------|
| `EmailServiceTests` | >= 80% | Template rendering, retry logic |
| `NotificationServiceTests` | >= 80% | Business logic, event handling |
| `RealtimeServiceTests` | >= 80% | SignalR integration |

### 10.2 Integration Tests

| Test Class | Focus |
|------------|-------|
| `RabbitMQConsumerTests` | Message consumption with TestContainers |
| `SmtpEmailSenderTests` | Email sending with MailHog |
| `NotificationRepositoryTests` | Database operations |

### 10.3 Test Commands

```bash
# Run all tests
dotnet test

# Run with coverage
dotnet test --collect:"XPlat Code Coverage"

# Run specific test class
dotnet test --filter "FullyQualifiedName~EmailServiceTests"

# Generate coverage report
reportgenerator -reports:**/coverage.cobertura.xml -targetdir:coveragereport
```

---

## 11. Definition of Done

### 11.1 Code Complete Checklist

- [ ] All phases implemented (see IMPLEMENTATION-PHASES.md)
- [ ] Unit tests >= 80% coverage
- [ ] Integration tests passing
- [ ] No critical warnings in build
- [ ] Code reviewed by team lead
- [ ] XML documentation for public APIs

### 11.2 Security Checklist

- [ ] JWT authentication implemented
- [ ] SignalR Hub protected with `[Authorize]`
- [ ] Controllers protected with `[Authorize]`
- [ ] User can only access own notifications
- [ ] Rate limiting enabled
- [ ] PII masked in logs
- [ ] Secrets from environment variables

### 11.3 Deployment Ready Checklist

- [ ] Docker image builds successfully
- [ ] Health checks passing (`/health`)
- [ ] Swagger documentation available at `/swagger`
- [ ] RabbitMQ connection verified
- [ ] SMTP credentials tested
- [ ] JWT secret matches API Gateway

---

