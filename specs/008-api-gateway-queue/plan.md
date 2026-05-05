# Implementation Plan: API Gateway Queue

**Branch**: `008-api-gateway-queue` | **Date**: 2026-05-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/008-api-gateway-queue/spec.md`

## Summary

Reverse-engineer the existing API Gateway queue boundary into a migrated Spec Kit artifact set. The feature already exists in `api-gateway/src/queue/**`; the plan captures the RabbitMQ topology, the CV upload event contract, and the resilience behavior used by the applications upload pipeline.

## Technical Context

**Primary Runtime**: api-gateway  
**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: NestJS, amqplib, ConfigService, Jest, existing logging/sanitization utilities  
**Storage**: RabbitMQ exchange and queues  
**Testing**: `cd api-gateway && npm test`, focused queue specs, `npm run build`  
**Target Platform**: Local development and Linux containers  
**Project Type**: Polyglot backend services  
**Performance Goals**: Keep publish and reconnect behavior bounded by configured timeouts and backoff settings  
**Constraints**: Preserve topology names, `bucket + fileKey` payloads, and production `amqps://` requirements  
**Scale/Scope**: One global utility module and its service tests; no migrations required

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Runtime code and current Spec Kit artifacts are authoritative.
- Frozen legacy sources are context only and must not be indexed as active requirements.
- Service boundaries must remain explicit.
- Cross-service changes require producer and consumer alignment.
- Schema changes in the gateway require schema and migration updates together.
- Validation, logging, and failure behavior must remain boundary-focused.

## Project Structure

### Documentation (this feature)

```text
specs/008-api-gateway-queue/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
api-gateway/
├── src/
│   ├── queue/
│   │   ├── queue.module.ts
│   │   ├── queue.service.ts
│   │   ├── constants/
│   │   └── interfaces/
│   ├── applications/
│   ├── storage/
│   ├── common/
│   └── config/
├── prisma/
├── test/
└── package.json
```

**Structure Decision**: The API Gateway owns the feature entirely. The queue module is a global utility under `api-gateway/src/queue/`, applications consume it for CV uploads, and storage is the upstream file source. No schema migration is required.

## Delivery Phases

### Phase 0: Discovery And Contract Check

- Confirm the queue module is global and the queue service owns connection setup.
- Confirm the exchange, queue, DLQ, and routing key names match the current broker topology.
- Confirm the `cv.uploaded` payload uses `bucket + fileKey` and not a file URL.

### Phase 1: Design And Data Shape

- Capture the queue topology, publish contract, and queue-stat surfaces.
- Capture the connection, heartbeat, timeout, and reconnect settings.
- Capture the failure behavior for missing config, buffer pressure, and connection loss.

### Phase 2: Implementation By Service

- Keep all runtime code in `api-gateway/src/queue/` and the shared config/logging boundary.
- Preserve the current reconnect strategy and topology setup.
- Avoid any schema changes because persistence is external RabbitMQ, not Prisma.

### Phase 3: Verification And Hardening

- Run the focused queue unit tests first.
- Verify topology setup, publish behavior, health reporting, queue stats, and reconnect handling.
- Confirm the build still passes after the queue module is loaded.

## Validation Commands

- API Gateway queue slice: `cd api-gateway && npm test -- queue`
- API Gateway build: `cd api-gateway && npm run build`
- Full gateway test suite if needed: `cd api-gateway && npm test`

## Complexity Tracking

Use this table only if the plan needs a justified exception to the normal brownfield guardrails.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | No exception is required for this migrated queue slice | The existing runtime implementation already fits the service boundary |