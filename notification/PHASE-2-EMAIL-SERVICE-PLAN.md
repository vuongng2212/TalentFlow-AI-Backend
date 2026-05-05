# Phase 2 Email Service Implementation Plan

## Scope

Implement the Notification service email capability described in `IMPLEMENTATION-PHASES.md` Phase 2.

Goal: authenticated clients can call `POST /api/notifications/send` and the service sends an email through SMTP using templates, retry, validation, rate limiting, and safe logging.

## Current State

Some Phase 2 files already exist, but several are empty or incomplete:

- `src/email/email.module.ts` exists but is empty.
- `src/email/email.service.ts` exists but is empty.
- `src/notification/dto/send-notification.dto.ts` exists but is empty.
- `src/common/utils/pii-masker.ts` exists but is empty.
- `src/email/templates/` exists with template files.
- `src/notification/notification.controller.ts` currently only exposes `GET /api/notifications/:id`.
- `package.json` does not yet include `@nestjs-modules/mailer`, `nodemailer`, or `handlebars`.

## Implementation Tasks

### 2.1 Email DTOs

- Implement `SendNotificationDto` with `class-validator`.
- Implement `NotificationResponseDto` if current shape is incomplete.
- Implement or finalize `Notification` entity for service/API responses.
- Validate:
  - `to` is a valid email.
  - `subject` is not empty.
  - `body` or `templateId` is present.
  - `type` and `channel` use constrained values.
  - `templateData` is an object when provided.

### 2.2 Email Infrastructure

- Install runtime dependencies:
  - `@nestjs-modules/mailer`
  - `nodemailer`
  - `handlebars`
- Install typings if needed:
  - `@types/nodemailer`
- Implement `EmailModule` with `MailerModule.forRootAsync`.
- Read SMTP settings from `ConfigService`.
- Implement `EmailService.sendEmail()`.
- Implement retry with exponential backoff:
  - max attempts: 3
  - delays: 2s, 4s, 8s
  - log each failed attempt with masked recipient/PII
- Implement `common/utils/pii-masker.ts` for email and phone masking.

### 2.3 Email Templates

- Verify templates compile and render through `@nestjs-modules/mailer`.
- Required templates:
  - `application-confirmation.hbs`
  - `interview-invitation.hbs`
  - `new-application-hr.hbs`
- Keep `application-result.hbs` if already used by later phases.
- Add unit tests for template selection and template data passing.

### 2.4 REST API Endpoint

- Add `POST /api/notifications/send` to `NotificationController`.
- Protect endpoint with `JwtAuthGuard`.
- Add rate limiting with `@Throttle()`.
- Use Nest validation pipe behavior from `main.ts`; add it if missing.
- Call `NotificationService.send()`.
- Return a stable `NotificationResponseDto`.
- Expected status:
  - `201` or `202` for accepted/sent request.
  - `400` for invalid payload.
  - `401` for missing/invalid JWT.
  - `429` for rate-limit violations.
  - `502` or `503` for SMTP delivery failure after retries.

### 2.5 DI Registration

- Import `EmailModule` into `NotificationModule`.
- Register and export `EmailService` from `EmailModule`.
- Ensure SMTP config is validated at startup.
- Ensure service startup does not log SMTP password or JWT secret.

## Tests

### Unit Tests

- `test/unit/email.service.spec.ts`
  - sends plain body email.
  - sends templated email.
  - retries on transient SMTP failure.
  - stops after 3 attempts.
  - masks recipient/PII in logs.

- `src/notification/notification.controller.spec.ts` or existing test location
  - validates `POST /api/notifications/send` route behavior.
  - verifies guard is applied.

### E2E/Security Tests

- Missing auth header returns `401`.
- Invalid JWT returns `401`.
- Invalid email payload returns `400`.
- Rate limit returns `429` after configured threshold.
- SMTP failure triggers retry logs and final error response.

## Verification Commands

```powershell
cd d:\project\TalentFlow-AI\TalentFlow-AI-Backend\TalentFlow-AI-Backend\notification
npm run build
npm test -- --runInBand
```

With infrastructure running:

```powershell
curl -X POST http://localhost:5000/api/notifications/send `
  -H "Authorization: Bearer <jwt-token>" `
  -H "Content-Type: application/json" `
  -d "{\"to\":\"test@example.com\",\"subject\":\"Test\",\"body\":\"Hello\",\"type\":\"email\"}"
```

## Definition of Done

- `npm run build` passes.
- Unit tests for `EmailService` pass.
- `POST /api/notifications/send` exists and is protected by JWT.
- Invalid payloads return `400`.
- Invalid/missing tokens return `401`.
- Rate limiting is active.
- SMTP send path retries 3 times with exponential backoff.
- Logs mask email addresses, phone numbers, and do not expose secrets.
- `IMPLEMENTATION-PHASES.md` Phase 2 checklist can be updated to completed only after verification passes.

## Suggested Order

1. Install mailer dependencies.
2. Implement DTOs and PII masker.
3. Implement `EmailModule` and `EmailService`.
4. Wire `EmailModule` into `NotificationModule`.
5. Add `POST /api/notifications/send`.
6. Add focused unit tests.
7. Run build and tests.
8. Run authenticated curl verification.
