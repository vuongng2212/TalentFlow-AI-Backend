# Notification Service Plan

## Context
TalentFlow AI là backend ATS theo kiến trúc 3 service:
- `api-gateway/` là service chính đang có implementation thực tế
- `cv-parser/` là service Spring Boot
- `notification/` được định hướng là service NestJS cho email, realtime notifications và notification history

Hiện tại `notification/` mới có tài liệu thiết kế, chưa có source code chạy thực tế. Mục tiêu là triển khai service này bám sát pattern đang dùng trong `api-gateway/` và tương thích với RabbitMQ contracts đã có sẵn.

## Current State
- Tài liệu chính của notification nằm ở:
  - `notification/README.md`
  - `notification/IMPLEMENTATION-PHASES.md`
- RabbitMQ constants cho notification đã có trong:
  - `api-gateway/src/queue/constants/queue.constants.ts`
- Pattern đang reuse từ `api-gateway`:
  - `api-gateway/src/main.ts`
  - `api-gateway/src/app.module.ts`
  - `api-gateway/src/prisma/*`
  - `api-gateway/src/health/*`
  - `api-gateway/src/queue/queue.service.ts`
  - `api-gateway/src/auth/*`

## Progress Snapshot
### Phase 1 status: partially completed
Đã scaffold xong nền tảng ban đầu cho Notification service.

#### Files đã tạo
- `notification/package.json`
- `notification/tsconfig.json`
- `notification/tsconfig.build.json`
- `notification/nest-cli.json`
- `notification/.env.example`
- `notification/Dockerfile`
- `notification/.dockerignore`
- `notification/prisma/schema.prisma`
- `notification/src/main.ts`
- `notification/src/app.module.ts`
- `notification/src/common/config/config.module.ts`
- `notification/src/common/config/config.schema.ts`
- `notification/src/prisma/prisma.module.ts`
- `notification/src/prisma/prisma.service.ts`
- `notification/src/health/health.module.ts`
- `notification/src/health/health.controller.ts`
- `notification/src/auth/auth.module.ts`
- `notification/src/auth/guards/jwt-auth.guard.ts`
- `notification/src/auth/strategies/jwt.strategy.ts`
- `notification/src/auth/decorators/public.decorator.ts`
- `notification/src/rabbitmq/rabbitmq.module.ts`
- `notification/src/rabbitmq/rabbitmq.service.ts`
- `notification/src/common/decorators/current-user.decorator.ts`
- `notification/src/common/types/auth-user.type.ts`

#### Những gì đã xong trong Phase 1
- Bootstrap NestJS app đã có tại `notification/src/main.ts`
- Root module đã có tại `notification/src/app.module.ts`
- Env validation đã có tại `notification/src/common/config/config.schema.ts`
- Prisma module/service đã có
- Health endpoints `/health` và `/ready` đã có
- JWT auth nền tảng đã có theo hướng stateless bearer token
- RabbitMQ connection service nền tảng đã có reconnect + exchange assertion cơ bản
- Prisma schema đã có model `Notification` và `NotificationStatus`
- `npm install`: OK
- `npx prisma generate`: OK
- `npm run build`: OK

#### Những gì Phase 1 chưa hoàn tất hẳn
- Chưa có ESLint config chạy được cho project mới
- `npm run lint` hiện đang fail không phải do source code, mà do ESLint 9 yêu cầu `eslint.config.js|mjs|cjs`
- Đã thử tạo file ESLint config nhưng bị hook môi trường chặn với lỗi kiểu: config protection không cho sửa/tạo `eslint.config.js` hoặc `eslint.config.mjs`

#### Trạng thái bảo mật / hardening đã chỉnh
- `GET /ready` không còn public nữa
- Swagger đã tắt `persistAuthorization`
- Dockerfile đã đổi sang cài production deps ở runtime stage và chạy bằng non-root user
- Đã thêm `.dockerignore` để tránh đưa file nhạy cảm vào build context

## Important Decisions Before Coding
### 1. JWT strategy
Notification service nên dùng **stateless JWT verification**:
- REST: nhận Bearer token
- WebSocket: nhận token từ Socket.IO handshake
- Không query local `users` table để authenticate

### 2. Event contracts
Cần xác nhận payload shape cho 4 routing keys:
- `notification.send`
- `application.created`
- `cv.parsed`
- `cv.failed`

## Recommended Implementation Order
### Phase 1: Scaffold notification service
Tạo skeleton NestJS service trong `notification/`:
- `package.json`
- `src/main.ts`
- `src/app.module.ts`
- `src/common/config/*`
- `src/prisma/*`
- `src/health/*`
- `prisma/schema.prisma`
- `.env.example`
- `Dockerfile`

### Phase 2: RabbitMQ consumer foundation
Tạo / hoàn thiện tiếp:
- `src/queue/constants/queue.constants.ts`
- `src/rabbitmq/rabbitmq.module.ts`
- `src/rabbitmq/rabbitmq.service.ts`
- `src/rabbitmq/notification.consumer.ts`
- `src/rabbitmq/events/*`

Lưu ý trạng thái hiện tại:
- `src/rabbitmq/rabbitmq.module.ts` đã có
- `src/rabbitmq/rabbitmq.service.ts` đã có bản nền tảng với connect/reconnect và assert exchange cơ bản
- Phase 2 cần mở rộng tiếp để assert queue + DLQ + bind routing keys + consumer logic thực tế

Yêu cầu:
- exchange: `talentflow.events`
- queue: `notification.events`
- DLQ: `notification.events.dlq`
- bind đủ 4 routing keys
- `prefetch(10)`
- manual ACK/NACK
- malformed JSON đi DLQ
- reconnect được khi RabbitMQ restart

### Phase 3: Notification domain + persistence
Tạo:
- `src/notification/notification.module.ts`
- `src/notification/notification.service.ts`
- `src/notification/dto/*`
- `src/notification/entities/*`
- `Notification` model trong `prisma/schema.prisma`

Schema tối thiểu:
- `id`
- `userId`
- `type`
- `title`
- `message`
- `metadata`
- `status`
- `sourceEvent`
- `externalId` hoặc `idempotencyKey`
- `readAt`
- timestamps

Lưu ý:
- cần idempotency để tránh duplicate notification khi redelivery

### Phase 4: Authenticated REST API
Tạo:
- `src/auth/*`
- `src/common/decorators/current-user.decorator.ts`
- `src/notification/notification.controller.ts`

MVP endpoints:
- `GET /api/v1/notifications`
- `GET /api/v1/notifications/unread-count`
- `PUT /api/v1/notifications/:id/read`
- optional: `PUT /api/v1/notifications/read-all`

Nguyên tắc:
- không dùng `userId` trên path để đọc notification
- lấy user từ JWT để tránh lộ dữ liệu chéo user

### Phase 5: Socket.IO realtime
Tạo:
- `src/notification/notification.gateway.ts`

Nguyên tắc:
- namespace `/notifications`
- verify JWT từ `handshake.auth.token` hoặc headers
- join room theo `userId`
- chỉ push sau khi persist notification thành công
- Redis adapter để sau, chưa cần cho MVP

### Phase 6: Email channel
Tạo:
- `src/email/email.module.ts`
- `src/email/email.service.ts`
- `src/email/templates/*`

Nguyên tắc:
- in-app notification/history là bản ghi chính
- email là side effect sau khi đã persist thành công
- retry bounded
- log phải mask PII
- không biến endpoint thành open relay

### Phase 7: Ops hardening
Sau khi service chạy ổn định:
- cập nhật `docker-compose.yml`
- thêm tests
- thêm Swagger decorators
- thêm CI/workflow
- hoàn thiện readiness/liveness cho DB + RabbitMQ

## Risks / Notes
- Tài liệu trong repo chưa hoàn toàn đồng nhất, nên ưu tiên `notification/README.md` làm nguồn gần nhất cho Notification service.
- JWT pattern ở `api-gateway` không copy nguyên xi được vì đang dùng cookie extractor và lookup user trong local DB.
- Event contracts hiện vẫn cần đối chiếu với publisher thực tế trước khi finalize DTO và handler.
- Vấn đề hiện tại cần nhớ khi sang session mới: `npm run lint` chưa verify được do thiếu ESLint flat config cho project mới, nhưng hook môi trường đang chặn việc tạo/sửa file `eslint.config.js` / `eslint.config.mjs`.
- Nếu tiếp tục sang Phase 2, có thể tiếp tục implement consumer logic trước; phần lint config cần xử lý riêng hoặc nhờ người dùng tắt hook config protection.

## Verification Checklist
### Bootstrap
- build service thành công
- app start được
- `GET /health` pass
- `GET /ready` pass khi DB + RabbitMQ sẵn sàng

### RabbitMQ
- queue `notification.events` và DLQ được tạo
- message hợp lệ được consume
- malformed JSON bị NACK và đi DLQ
- reconnect được sau khi RabbitMQ restart

### Persistence
- mỗi event tạo đúng 1 notification record
- redelivery không tạo duplicate nếu cùng `idempotencyKey`
- mark-as-read chỉ cập nhật record của user hiện tại

### Auth
- thiếu/invalid token -> `401`
- WebSocket token sai -> disconnect
- user không đọc được notification của user khác

### Realtime + Email
- client hợp lệ nhận realtime notification sau khi event được xử lý
- nhiều tab cùng user cùng nhận event
- email gửi được với SMTP hợp lệ
- nếu email fail thì notification history vẫn còn trong DB
