# Implementation Plan: Notification Service

**Branch**: `013-notification` | **Date**: 2026-05-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/013-notification/spec.md`

## Summary

Reverse-engineer the existing notification runtime into a migrated Spec Kit artifact set. The feature already exists in `notification/src/**`; the plan captures authenticated email sending, synthetic notification lookup, health checks, and the current RabbitMQ and auth scaffolding.

## Technical Context

**Primary Runtime**: notification  
**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: NestJS, class-validator, Mailer, Handlebars, Terminus, JWT auth, RabbitMQ client, Jest  
**Storage**: No persisted notification table in the current runtime slice; health checks query Prisma and RabbitMQ  
**Testing**: `cd notification && npm test`, focused service specs, `npm run build`  
**Target Platform**: Local development and Linux containers  
**Project Type**: NestJS notification service  
**Performance Goals**: Keep email send retries bounded and keep health checks lightweight  
**Constraints**: Preserve JWT protection, throttling, response shape, and the current synthesized lookup behavior  
**Scale/Scope**: One service shell with controller, service, email layer, auth, health, and RabbitMQ wiring; no schema migration required

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- Runtime code and current Spec Kit artifacts are authoritative.
- Frozen legacy sources are context only and must not be indexed as active requirements.
- Service boundaries must remain explicit.
- Cross-service changes require producer and consumer alignment.
- Validation, logging, retry behavior, and health checks must remain boundary-focused.
- Do not claim a completed notification event bus or websocket delivery path unless the runtime implements one.

## Project Structure

### Documentation (this feature)

```text
specs/013-notification/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
notification/
├── src/
│   ├── notification/
│   │   ├── notification.controller.ts
│   │   ├── notification.service.ts
│   │   ├── notification.module.ts
│   │   ├── notification.gateway.ts
│   │   └── dto/
│   ├── email/
│   ├── auth/
│   ├── health/
│   ├── rabbitmq/
│   ├── prisma/
│   └── config/
├── test/
└── package.json
```

**Structure Decision**: The notification service owns the feature boundary entirely. The HTTP controller, email delivery path, health checks, and RabbitMQ connectivity live under `notification/src/`, while the gateway and consumer files are still scaffolds and must be described as such.

## Delivery Phases

### Phase 0: Discovery And Contract Check

- Confirm the controller exposes send and lookup routes.
- Confirm the email service renders templates and retries transient failures.
- Confirm the health controller checks both Prisma and RabbitMQ readiness.

### Phase 1: Design And Data Shape

- Capture the notification send and response DTOs.
- Capture the template-to-type mapping and the synthesized response fields.
- Capture the current auth and throttling requirements on the send route.

### Phase 2: Implementation By Service

- Keep all runtime code in `notification/src/` and the shared auth/email/health boundary.
- Preserve the current email retry path and notification view synthesis.
- Avoid adding a persisted notification schema because the runtime slice does not include one.

### Phase 3: Verification And Hardening

- Run the focused email and guard unit tests first.
- Verify send, lookup, and readiness output shapes.
- Confirm the build still passes after the notification module is loaded.

## Validation Commands

- Notification slice: `cd notification && npm test`
- Notification build: `cd notification && npm run build`
- Focused unit tests if needed: `cd notification && npm test -- email`

## Complexity Tracking

Use this table only if the plan needs a justified exception to the normal brownfield guardrails.

| Violation | Why Needed                                                    | Simpler Alternative Rejected Because                                  |
| --------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| None      | No exception is required for this migrated notification slice | The existing runtime implementation already fits the service boundary |
