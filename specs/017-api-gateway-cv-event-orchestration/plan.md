# Implementation Plan: API Gateway CV Event Orchestration

**Branch**: `VuongND/feat/api-gateway-orchestrator-for-cv-parsing-events` | **Date**: 2026-06-18 | **Spec**: [specs/017-api-gateway-cv-event-orchestration/spec.md](specs/017-api-gateway-cv-event-orchestration/spec.md)
**Input**: Feature specification from `/specs/017-api-gateway-cv-event-orchestration/spec.md`

## Summary

The API Gateway will act as an Orchestrator/Enricher for CV parsing events. It will consume raw CV parsing result events (`cv.parsed`, `cv.failed`) from the CV Parser via RabbitMQ, persist the results into the PostgreSQL database (updating the `Application` record), enrich the events with context (Job, Recruiter, Applicant info), and publish enriched domain events (`notification.send` or new enriched domain events) to the Notification service. This requires changes to the `Application` Prisma schema, adding RabbitMQ consumers, and updating the `ApplicationsService` and `QueueService`.

## Technical Context

**Primary Runtime**: api-gateway
**Language/Version**: TypeScript 5.x
**Primary Dependencies**: NestJS 11, Prisma 6, RabbitMQ (amqplib/@golevelup/nestjs-rabbitmq), class-validator
**Storage**: PostgreSQL
**Testing**: npm test, npm run test:e2e
**Target Platform**: Linux containers / local dev
**Project Type**: Polyglot backend services
**Performance Goals**: Fast asynchronous processing of incoming events
**Constraints**: Resilient transactions for DB updates and event publishing. Do not lose events.
**Scale/Scope**: 1 Prisma schema change, 2 new RabbitMQ listeners, 2 new queue event interfaces.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- Runtime code and current Spec Kit artifacts are authoritative.
- Frozen legacy sources are context only and must not be indexed as active requirements.
- Service boundaries must remain explicit.
- Cross-service changes require producer and consumer alignment.
- Schema changes in the gateway require schema and migration updates together.
- Validation, logging, and failure behavior must remain boundary-focused.
- Tests and TDD: For non-trivial work, developers MUST author failing tests before implementing behavior (TDD). This TDD gate is required for Phase 2+ implementation unless a justified exception is documented in the plan.

## Project Structure

### Documentation (this feature)

```text
specs/017-api-gateway-cv-event-orchestration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
api-gateway/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── applications/
│   ├── queue/
```

**Structure Decision**: API Gateway owns this feature. Changes will be localized to `api-gateway/prisma/schema.prisma`, `api-gateway/src/applications/`, and `api-gateway/src/queue/`.

## Delivery Phases

### Phase 0: Discovery And Contract Check
Done in `research.md`.

### Phase 1: Design And Data Shape
Done in `data-model.md`, `contracts/`, and `quickstart.md`.

### Phase 2: Implementation By Service
- API Gateway `prisma/schema.prisma`: Add CV parsing fields to `Application`.
- API Gateway `src/queue/`: Add DTOs/interfaces for raw and enriched events. Add consumer logic.
- API Gateway `src/applications/`: Update service to handle parsing results and enrich events.

### Phase 3: Verification And Hardening
- Unit tests for consumer and service logic.
- Integration test for Prisma changes.

## Validation Commands

- API Gateway: `cd api-gateway && npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`

## Local Verification Strategy

- Add mock unit tests for `ApplicationsService.handleCvParsedEvent` and `QueueService` consumption.
- Prisma schema validation via `npx prisma migrate dev`.