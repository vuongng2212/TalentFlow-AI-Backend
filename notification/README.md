# Notification Service - Implementation Planning

**Version:** 2.0
**Created:** 2026-02-24
**Updated:** 2026-03-20
**Status:** Planning
**Tech Stack:** NestJS (TypeScript)
**Developer:** TBD

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
- **Real-time**: Push notification qua WebSocket (Socket.IO) đến frontend
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
│  │  (NestJS)   │         │(Spring Boot)│         │  (NestJS)   │           │
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
│         │    (NestJS)         │                                             │
│         └──────────┬──────────┘                                             │
│                    │                                                         │
│                    │ Socket.IO WebSocket (Authenticated)                     │
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
| Redis | Caching, Socket.IO adapter | 6379 | Upstash |
| Gmail SMTP | Email sending | 587 | Gmail / SendGrid |

### 1.4 Core Features

| Feature | Priority | Description |
|---------|----------|-------------|
| Email Sending | P0 (MVP) | Gửi email qua Gmail SMTP |
| RabbitMQ Consumer | P0 (MVP) | Subscribe events từ RabbitMQ |
| Health Check | P0 (MVP) | Kubernetes readiness/liveness |
| JWT Authentication | P0 (MVP) | Bảo vệ API và WebSocket Gateway |
| Socket.IO Gateway | P1 | Real-time WebSocket notifications |
| Notification History | P1 | Lưu trữ và truy vấn notification |
| Email Templates | P2 | HTML templates với Handlebars |
| Retry Mechanism | P2 | Retry failed emails với exponential backoff |

---

## 2. Architecture

### 2.1 Architecture Pattern: Modular NestJS Architecture

```
+-----------------------------------------------------------------------------+
|                         NOTIFICATION SERVICE (NestJS)                         |
+-----------------------------------------------------------------------------+
|                                                                              |
|  +-----------------------------------------------------------------------+  |
|  |                           API LAYER                                   |  |
|  |  +-------------------+  +-------------------+  +-------------------+  |  |
|  |  |   Controllers     |  | Socket.IO Gateway |  |   Health Module   |  |  |
|  |  |   @UseGuards()    |  |   @UseGuards()    |  |   @nestjs/terminus|  |  |
|  |  +-------------------+  +-------------------+  +-------------------+  |  |
|  +-----------------------------------------------------------------------+  |
|                                    |                                         |
|                                    v                                         |
|  +-----------------------------------------------------------------------+  |
|  |                        APPLICATION LAYER                              |  |
|  |  +-------------------+  +-------------------+  +-------------------+  |  |
|  |  | NotificationSvc   |  |  EmailService     |  |  RealtimeService  |  |  |
|  |  |                   |  |                   |  |                   |  |  |
|  |  +-------------------+  +-------------------+  +-------------------+  |  |
|  +-----------------------------------------------------------------------+  |
|                                    |                                         |
|                                    v                                         |
|  +-----------------------------------------------------------------------+  |
|  |                      INFRASTRUCTURE LAYER                             |  |
|  |  +-------------+  +-------------+  +-------------+  +-------------+   |  |
|  |  | Nodemailer  |  | RabbitMQ    |  | Socket.IO   |  | Prisma      |   |  |
|  |  | Transport   |  | Consumer    |  | Adapter     |  | Service     |   |  |
|  |  +-------------+  +-------------+  +-------------+  +-------------+   |  |
|  +-----------------------------------------------------------------------+  |
|                                                                              |
|  +-----------------------------------------------------------------------+  |
|  |                      CONSUMERS (RabbitMQ)                             |  |
|  |  +---------------------------+  +---------------------------+         |  |
|  |  |  NotificationConsumer     |  |    EmailRetryConsumer     |         |  |
|  |  +---------------------------+  +---------------------------+         |  |
|  +-----------------------------------------------------------------------+  |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### 2.2 Why This Architecture?

| Aspect | Benefit |
|--------|---------|
| **NestJS Modules** | Mỗi feature là 1 module, dễ quản lý dependency injection |
| **Testability** | Dễ mock services, unit test từng module |
| **Flexibility** | Dễ thay đổi email provider (SMTP → SendGrid) |
| **Consistency** | Cùng tech stack với API Gateway (NestJS) |
| **Security** | Authentication/Authorization qua Guards |

### 2.3 Data Flow

```
1. INBOUND (RabbitMQ → Service)
   RabbitMQ Queue --> NotificationConsumer --> NotificationService --> Email/Socket.IO

2. OUTBOUND (Client → Service)
   HTTP Request (+ JWT) --> @UseGuards() Controller --> NotificationService --> Response
   WebSocket (+ JWT) --> @UseGuards() Gateway --> Client Push
```

### 2.4 Message Broker vs Socket.IO

| Component | Vai trò | Protocol | Ai connect được? |
|-----------|---------|----------|------------------|
| **RabbitMQ** | Backend-to-backend messaging | AMQP | Chỉ backend services |
| **Socket.IO** | Real-time push đến browser | WebSocket | Frontend clients (authenticated) |

### 2.5 Scaling Considerations

#### Socket.IO Redis Adapter (Horizontal Scaling)

Khi chạy nhiều instances của Notification Service, cần Redis adapter để sync Socket.IO connections:

```typescript
// app.module.ts - Production setup với Redis adapter
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: any) {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}

// main.ts
const redisIoAdapter = new RedisIoAdapter(app);
await redisIoAdapter.connectToRedis();
app.useWebSocketAdapter(redisIoAdapter);
```

**Khi nào cần Redis adapter:**
- Chạy > 1 instance của Notification Service
- Load balancer phân phối connections giữa các instances
- User có thể connect tới instance A, nhưng message cần push từ instance B

#### RabbitMQ Multi-Consumer (Idempotency)

Khi scale nhiều instances, mỗi instance sẽ consume messages từ cùng queue:

```typescript
// Đảm bảo idempotency:
// 1. Sử dụng unique messageId để detect duplicates
// 2. Check trước khi insert notification (upsert pattern)

async handleApplicationCreated(event: ApplicationCreatedEvent): Promise<void> {
  // Idempotency check - tránh duplicate notifications
  const existing = await this.prisma.notification.findFirst({
    where: { externalId: event.applicationId },
  });

  if (existing) {
    this.logger.log(`Notification already processed for ${event.applicationId}`);
    return;
  }

  // Process notification...
}
```

**Best Practices:**
- **Prefetch count**: Set `channel.prefetch(10)` để control workload
- **Manual ACK**: Chỉ ACK sau khi xử lý thành công
- **Idempotency key**: Sử dụng `applicationId` hoặc `messageId` để detect duplicates
- **Dead Letter Queue**: NACK với `requeue: false` để chuyển failed messages vào DLQ

---

## 3. Tech Stack & Libraries

### 3.1 Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 20.x LTS | Runtime |
| **NestJS** | 10.x | Web framework |
| **TypeScript** | 5.x | Language |
| **Prisma** | 5.x | ORM |
| **PostgreSQL** | 16.x | Database |

### 3.2 Key Libraries

| Library | npm Package | Purpose |
|---------|-------------|---------|
| **Socket.IO** | `@nestjs/websockets` + `@nestjs/platform-socket.io` | Real-time WebSocket |
| **amqplib** | `amqplib` | RabbitMQ consumer |
| **Nodemailer** | `@nestjs-modules/mailer` + `nodemailer` | SMTP email sending |
| **Prisma** | `@prisma/client` | PostgreSQL ORM |
| **Winston** | `nest-winston` + `winston` | Structured logging |
| **Passport** | `@nestjs/passport` + `@nestjs/jwt` | Authentication |
| **Swagger** | `@nestjs/swagger` | API documentation |
| **Terminus** | `@nestjs/terminus` | Health checks |
| **Throttler** | `@nestjs/throttler` | Rate limiting |
| **Handlebars** | `handlebars` (via `@nestjs-modules/mailer`) | Email templates |
| **class-validator** | `class-validator` + `class-transformer` | DTO validation |

### 3.3 npm Packages (package.json)

```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/websockets": "^10.0.0",
    "@nestjs/platform-socket.io": "^10.0.0",
    "@nestjs/jwt": "^10.0.0",
    "@nestjs/passport": "^10.0.0",
    "@nestjs/swagger": "^7.0.0",
    "@nestjs/terminus": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/throttler": "^5.0.0",
    "@nestjs-modules/mailer": "^1.9.0",
    "@prisma/client": "^5.0.0",
    "amqplib": "^0.10.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.0",
    "nest-winston": "^1.9.0",
    "winston": "^3.11.0",
    "handlebars": "^4.7.0",
    "nodemailer": "^6.9.0",
    "rxjs": "^7.8.0",
    "reflect-metadata": "^0.2.0",
    "@socket.io/redis-adapter": "^8.2.0",
    "redis": "^4.6.0"
  },
  "devDependencies": {
    "@nestjs/testing": "^10.0.0",
    "@nestjs/cli": "^10.0.0",
    "@types/amqplib": "^0.10.0",
    "@types/nodemailer": "^6.4.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "prisma": "^5.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## 4. Project Structure

### 4.1 Module Layout

```
notification/
├── src/
│   ├── main.ts                           # Entry point
│   ├── app.module.ts                     # Root module
│   │
│   ├── notification/                     # Notification Module
│   │   ├── notification.module.ts
│   │   ├── notification.controller.ts    # REST API endpoints
│   │   ├── notification.service.ts       # Business logic
│   │   ├── notification.gateway.ts       # Socket.IO WebSocket Gateway
│   │   ├── dto/
│   │   │   ├── send-notification.dto.ts
│   │   │   ├── notification-response.dto.ts
│   │   │   └── query-notification.dto.ts
│   │   └── entities/
│   │       └── notification.entity.ts
│   │
│   ├── email/                            # Email Module
│   │   ├── email.module.ts
│   │   ├── email.service.ts              # Nodemailer integration
│   │   └── templates/                    # Handlebars email templates
│   │       ├── application-confirmation.hbs
│   │       ├── interview-invitation.hbs
│   │       ├── new-application-hr.hbs
│   │       └── application-result.hbs
│   │
│   ├── rabbitmq/                         # RabbitMQ Module
│   │   ├── rabbitmq.module.ts
│   │   ├── rabbitmq.service.ts           # Connection management
│   │   ├── notification.consumer.ts      # Event consumer
│   │   └── events/
│   │       ├── application-created.event.ts
│   │       ├── cv-parsed.event.ts
│   │       ├── cv-failed.event.ts
│   │       └── notification-send.event.ts
│   │
│   ├── auth/                             # Auth Module
│   │   ├── auth.module.ts
│   │   ├── jwt.strategy.ts               # Passport JWT strategy
│   │   ├── jwt-auth.guard.ts
│   │   └── ws-jwt.guard.ts               # WebSocket auth guard
│   │
│   ├── health/                           # Health Module
│   │   ├── health.module.ts
│   │   └── health.controller.ts
│   │
│   ├── prisma/                           # Prisma Module
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   │
│   ├── config/                           # Configuration
│   │   ├── app.config.ts
│   │   ├── smtp.config.ts
│   │   ├── rabbitmq.config.ts
│   │   ├── jwt.config.ts
│   │   └── validation.schema.ts          # Joi/Zod env validation
│   │
│   └── common/                           # Shared utilities
│       ├── decorators/
│       │   └── current-user.decorator.ts
│       ├── filters/
│       │   └── all-exceptions.filter.ts
│       └── utils/
│           └── pii-masker.ts             # PII masking for logs
│
├── prisma/
│   └── schema.prisma                     # Database schema
│
├── test/
│   ├── unit/
│   │   ├── email.service.spec.ts
│   │   ├── notification.service.spec.ts
│   │   └── notification.gateway.spec.ts
│   └── integration/
│       ├── rabbitmq.consumer.spec.ts
│       └── email.integration.spec.ts
│
├── Dockerfile
├── IMPLEMENTATION-PHASES.md              # Task tracking
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
├── .env.example
└── README.md
```

### 4.2 File Descriptions

| File/Folder | Purpose |
|-------------|---------|
| `main.ts` | Entry point, global pipes/filters, Socket.IO adapter setup |
| `app.module.ts` | Root module, imports all feature modules |
| `notification/` | Notification CRUD, REST API controller, Socket.IO gateway |
| `email/` | Email sending with Nodemailer + Handlebars templates |
| `rabbitmq/` | RabbitMQ connection, consumers, event DTOs |
| `auth/` | JWT Passport strategy, Guards cho REST và WebSocket |
| `health/` | Health checks via `@nestjs/terminus` |
| `prisma/` | Prisma ORM service + schema |
| `config/` | Typed configuration with `@nestjs/config` |
| `common/` | Shared decorators, filters, utilities |

---

## 5. Security

### 5.1 Authentication

Service sử dụng JWT Bearer token từ API Gateway:

```typescript
// auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      issuer: configService.get<string>('JWT_ISSUER'),
      audience: configService.get<string>('JWT_AUDIENCE'),
    });
  }

  async validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
```

### 5.2 Authorization

**Controllers:**
```typescript
import { Controller, Get, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  @Get(':userId')
  async getByUserId(
    @Param('userId') userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Chỉ cho phép user xem notification của chính mình
    if (user.userId !== userId) {
      throw new ForbiddenException();
    }
    // ...
  }
}
```

**Socket.IO Gateway:**
```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../auth/ws-jwt.guard';

@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: process.env.CORS_ORIGINS?.split(','), credentials: true },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization;
      const user = await this.authService.verifyToken(token);
      client.data.user = user;
      await client.join(`user_${user.userId}`);
      this.logger.log(`Client connected: ${client.id}, User: ${this.maskUserId(user.userId)}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinUserRoom')
  @UseGuards(WsJwtGuard)
  async handleJoinRoom(client: Socket) {
    const userId = client.data.user?.userId;
    if (!userId) throw new Error('User not authenticated');
    await client.join(`user_${userId}`);
  }
}
```

### 5.3 Security Checklist

- [ ] JWT validation với issuer, audience, expiry
- [ ] Socket.IO Gateway yêu cầu authentication
- [ ] User chỉ access notification của chính mình
- [ ] CORS chỉ allow specific origins
- [ ] Rate limiting trên endpoints
- [ ] Input validation cho tất cả DTOs (class-validator)
- [ ] PII masking trong logs
- [ ] Secrets từ environment variables (không hardcode)

### 5.4 Secrets Management

**KHÔNG BAO GIỜ** commit secrets vào git:

```typescript
// config/validation.schema.ts
import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Required secrets
  JWT_SECRET: Joi.string().min(32).required(),
  SMTP_PASSWORD: Joi.string().required(),
  RABBITMQ_URL: Joi.string().uri().required(),
  DATABASE_URL: Joi.string().required(),

  // Optional with defaults
  PORT: Joi.number().default(5000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
});

// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
    }),
  ],
})
export class AppModule {}
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

### 6.3 Socket.IO Gateway Events

| Direction | Event | Description |
|-----------|-------|-------------|
| Client → Server | `joinUserRoom` | Subscribe to authenticated user's notifications |
| Client → Server | `leaveUserRoom` | Unsubscribe |
| Server → Client | `receiveNotification` | Push notification to client |

**Client Connection (Next.js):**
```typescript
import { io } from 'socket.io-client';

const socket = io('https://notification-service.example.com/notifications', {
  auth: {
    token: getJwtToken(), // JWT từ auth context
  },
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

socket.on('receiveNotification', (notification) => {
  toast.info(notification.message);
});

socket.on('connect', () => {
  socket.emit('joinUserRoom'); // userId lấy từ JWT server-side
});
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

### 8.1 main.ts (Entry Point)

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              return `[${timestamp}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
            }),
          ),
        }),
      ],
    }),
  });

  const configService = app.get(ConfigService);

  // ==================== VALIDATION ====================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ==================== CORS ====================
  const allowedOrigins = configService.get<string>('CORS_ORIGINS')?.split(',') || ['http://localhost:3000'];
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // ==================== SOCKET.IO ADAPTER ====================
  if (configService.get('NODE_ENV') === 'production') {
    const redisIoAdapter = new RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
  }

  // ==================== SWAGGER ====================
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Notification Service')
    .setDescription('TalentFlow AI Notification Service API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger', app, document);

  // ==================== START ====================
  const port = configService.get<number>('PORT', 5000);
  await app.listen(port);
  Logger.log(`🚀 Notification Service running on port ${port}`, 'Bootstrap');
}
bootstrap();
```

### 8.2 app.module.ts (Root Module)

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { NotificationModule } from './notification/notification.module';
import { EmailModule } from './email/email.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { validationSchema } from './config/validation.schema';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
    }),

    // Rate Limiting
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute
      limit: 100,
    }]),

    // Feature Modules
    PrismaModule,
    AuthModule,
    NotificationModule,
    EmailModule,
    RabbitmqModule,
    HealthModule,
  ],
})
export class AppModule {}
```

### 8.3 NotificationGateway (Socket.IO - Authenticated)

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { maskUserId } from '../common/utils/pii-masker';

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
})
@Injectable()
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(private readonly authService: AuthService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token
        || client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const user = await this.authService.verifyToken(token);
      client.data.user = user;
      await client.join(`user_${user.userId}`);

      this.logger.log(
        `Client connected: ${client.id}, User: ${maskUserId(user.userId)}`,
      );
    } catch {
      this.logger.warn(`Unauthorized connection attempt: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinUserRoom')
  async handleJoinRoom(@ConnectedSocket() client: Socket) {
    const userId = client.data.user?.userId;
    if (!userId) {
      client.disconnect();
      return;
    }
    await client.join(`user_${userId}`);
  }

  @SubscribeMessage('leaveUserRoom')
  async handleLeaveRoom(@ConnectedSocket() client: Socket) {
    const userId = client.data.user?.userId;
    if (!userId) return;
    await client.leave(`user_${userId}`);
    this.logger.log(`Client ${client.id} left room for user ${maskUserId(userId)}`);
  }

  // Push notification to specific user
  async sendToUser(userId: string, notification: any) {
    this.server.to(`user_${userId}`).emit('receiveNotification', notification);
  }

  // Push notification to role group
  async sendToRole(role: string, notification: any) {
    this.server.to(`role_${role}`).emit('receiveNotification', notification);
  }
}
```

### 8.4 NotificationConsumer (RabbitMQ)

```typescript
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';
import { NotificationService } from '../notification/notification.service';
import {
  ApplicationCreatedEvent,
  CvParsedEvent,
  CvFailedEvent,
  NotificationSendEvent,
} from './events';

@Injectable()
export class NotificationConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationConsumer.name);
  private connection: amqplib.Connection;
  private channel: amqplib.Channel;

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
  ) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async connect() {
    try {
      const url = this.configService.get<string>('RABBITMQ_URL');
      this.connection = await amqplib.connect(url);
      this.channel = await this.connection.createChannel();

      // Declare exchange and queue
      await this.channel.assertExchange('talentflow.events', 'topic', { durable: true });
      await this.channel.assertQueue('notification.events', { durable: true });

      // Bind routing keys
      const routingKeys = [
        'notification.send',
        'application.created',
        'cv.parsed',
        'cv.failed',
      ];

      for (const key of routingKeys) {
        await this.channel.bindQueue('notification.events', 'talentflow.events', key);
      }

      // Set prefetch
      await this.channel.prefetch(10);

      // Start consuming
      await this.channel.consume('notification.events', async (msg) => {
        if (!msg) return;

        const routingKey = msg.fields.routingKey;
        const content = msg.content.toString();

        try {
          await this.processMessage(routingKey, content);
          this.channel.ack(msg);
        } catch (error) {
          this.logger.error(`Error processing message: ${routingKey}`, error.stack);
          // Nack with requeue=false to send to DLQ
          this.channel.nack(msg, false, false);
        }
      });

      this.logger.log('✅ Subscribed to RabbitMQ queue: notification.events');
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ', error.stack);
      // Retry connection after delay
      setTimeout(() => this.connect(), 5000);
    }
  }

  private async processMessage(routingKey: string, message: string) {
    switch (routingKey) {
      case 'notification.send': {
        const event: NotificationSendEvent = JSON.parse(message);
        await this.notificationService.send(event);
        break;
      }
      case 'application.created': {
        const event: ApplicationCreatedEvent = JSON.parse(message);
        await this.notificationService.handleApplicationCreated(event);
        break;
      }
      case 'cv.parsed': {
        const event: CvParsedEvent = JSON.parse(message);
        await this.notificationService.handleCvParsed(event);
        break;
      }
      case 'cv.failed': {
        const event: CvFailedEvent = JSON.parse(message);
        await this.notificationService.handleCvFailed(event);
        break;
      }
      default:
        this.logger.warn(`Unknown routing key: ${routingKey}`);
    }
  }
}
```

### 8.5 EmailService (với Retry)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { maskEmail } from '../common/utils/pii-masker';

interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly maxRetries = 3;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async send(message: EmailMessage): Promise<boolean> {
    return this.retry(async () => {
      await this.mailerService.sendMail({
        to: message.to,
        subject: message.subject,
        html: message.body,
      });

      this.logger.log(
        `Email sent successfully to ${maskEmail(message.to)}, Subject: ${message.subject}`,
      );

      return true;
    });
  }

  async sendTemplate(
    templateId: string,
    to: string,
    context: Record<string, string>,
  ): Promise<boolean> {
    return this.retry(async () => {
      await this.mailerService.sendMail({
        to,
        subject: this.getSubjectForTemplate(templateId),
        template: templateId,
        context,
      });

      this.logger.log(
        `Template email sent to ${maskEmail(to)}, Template: ${templateId}`,
      );

      return true;
    });
  }

  private async retry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        this.logger.warn(
          `Retry ${attempt}/${this.maxRetries} after ${delay / 1000}s due to: ${error.message}`,
        );

        if (attempt === this.maxRetries) throw error;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private getSubjectForTemplate(templateId: string): string {
    const subjects: Record<string, string> = {
      'application-confirmation': 'Application Received - TalentFlow',
      'interview-invitation': 'Interview Invitation - TalentFlow',
      'application-result': 'Application Update - TalentFlow',
      'new-application-hr': 'New Application Received - TalentFlow',
      'cv-parsed-hr': 'CV Analysis Complete - TalentFlow',
      'cv-failed-hr': 'CV Processing Failed - TalentFlow',
    };
    return subjects[templateId] || 'Notification from TalentFlow';
  }
}
```

### 8.6 NotificationController (Authorized)

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationService } from './notification.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { QueryNotificationDto } from './dto/query-notification.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 100, ttl: 60000 } })
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send a notification (email or push)' })
  async send(
    @Body() dto: SendNotificationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.notificationService.send(dto);
    if (result.success) {
      return { success: true, data: result };
    }
    return { success: false, error: result.errorMessage };
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get notifications for a user (own only)' })
  async getByUserId(
    @Param('userId') userId: string,
    @Query() query: QueryNotificationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.userId !== userId) throw new ForbiddenException();
    const notifications = await this.notificationService.getByUserId(userId, query.page, query.limit);
    return { success: true, data: notifications };
  }

  @Get(':userId/unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(
    @Param('userId') userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.userId !== userId) throw new ForbiddenException();
    const count = await this.notificationService.getUnreadCount(userId);
    return { success: true, data: { count } };
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const notification = await this.notificationService.getById(id);
    if (!notification) throw new NotFoundException();
    if (notification.userId !== user.userId) throw new ForbiddenException();
    await this.notificationService.markAsRead(id);
    return { success: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const notification = await this.notificationService.getById(id);
    if (!notification) throw new NotFoundException();
    if (notification.userId !== user.userId) throw new ForbiddenException();
    await this.notificationService.delete(id);
    return { success: true };
  }
}
```

---

## 9. Configuration

### 9.1 .env (Development)

```bash
# Application
NODE_ENV=development
PORT=5000

# Database
DATABASE_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/talentflow_dev"

# RabbitMQ
RABBITMQ_URL="amqp://YOUR_RABBITMQ_USER:YOUR_RABBITMQ_PASSWORD@localhost:5672"

# SMTP (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=YOUR_SMTP_USERNAME
SMTP_PASSWORD=YOUR_SMTP_APP_PASSWORD
SMTP_FROM_EMAIL=noreply@talentflow.ai
SMTP_FROM_NAME=TalentFlow AI

# JWT (same key as API Gateway)
JWT_SECRET=YOUR_JWT_SECRET_KEY_MIN_256_BITS
JWT_ISSUER=talentflow-api-gateway
JWT_AUDIENCE=talentflow-services

# CORS
CORS_ORIGINS=http://localhost:3000

# Redis (for Socket.IO adapter in production)
REDIS_URL=redis://localhost:6379
```

### 9.2 Environment Variables (Production)

```bash
# Database
DATABASE_URL=postgresql://postgres:secret@db.supabase.co:5432/talentflow

# RabbitMQ (CloudAMQP)
RABBITMQ_URL=amqps://user:pass@rabbit.cloudamqp.com/vhost

# SMTP
SMTP_USER=prod-email@company.com
SMTP_PASSWORD=prod-app-password

# JWT (same key as API Gateway)
JWT_SECRET=your-256-bit-secret-key-here

# Node.js
NODE_ENV=production
PORT=5000

# CORS
CORS_ORIGINS=https://talentflow.example.com

# Redis
REDIS_URL=redis://user:pass@redis.upstash.io:6379
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

| Test Class | Coverage Target | Focus |
|------------|-----------------|-------|
| `email.service.spec.ts` | >= 80% | Template rendering, retry logic |
| `notification.service.spec.ts` | >= 80% | Business logic, event handling |
| `notification.gateway.spec.ts` | >= 80% | Socket.IO integration |

### 10.2 Integration Tests

| Test Class | Focus |
|------------|-------|
| `rabbitmq.consumer.spec.ts` | Message consumption with testcontainers |
| `email.integration.spec.ts` | Email sending with MailHog |
| `notification.repository.spec.ts` | Database operations with Prisma |

### 10.3 Test Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Run specific test file
npm test -- --testPathPattern=email.service

# Run e2e tests
npm run test:e2e

# Watch mode
npm run test:watch
```

---

## 11. Definition of Done

### 11.1 Code Complete Checklist

- [ ] All phases implemented (see IMPLEMENTATION-PHASES.md)
- [ ] Unit tests >= 80% coverage
- [ ] Integration tests passing
- [ ] No critical warnings in build
- [ ] Code reviewed by team lead
- [ ] Swagger documentation for public APIs

### 11.2 Security Checklist

- [ ] JWT authentication implemented
- [ ] Socket.IO Gateway protected with auth guard
- [ ] Controllers protected with `@UseGuards(JwtAuthGuard)`
- [ ] User can only access own notifications
- [ ] Rate limiting enabled (`@nestjs/throttler`)
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
