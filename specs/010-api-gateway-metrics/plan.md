# Implementation Plan: API Gateway Metrics

**Branch**: `010-api-gateway-metrics` | **Date**: 2026-05-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/010-api-gateway-metrics/spec.md`

## Summary

Reverse-engineer the existing API Gateway metrics boundary into a migrated Spec Kit artifact set. The feature already exists in `api-gateway/src/metrics/**`; the plan captures the public Prometheus endpoint, HTTP metric recording, and queue-depth collection used to observe the gateway.

## Technical Context

**Primary Runtime**: api-gateway  
**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: NestJS, prom-client, ConfigService, QueueService, Jest  
**Storage**: Prometheus registry plus queue stats  
**Testing**: `cd api-gateway && npm test`, focused metrics specs, `npm run build`  
**Target Platform**: Local development and Linux containers  
**Project Type**: Polyglot backend services  
**Performance Goals**: Keep metrics collection lightweight and avoid blocking the request path  
**Constraints**: Preserve public text output, label names, and queue-collector polling behavior  
**Scale/Scope**: One HTTP controller, one service, one collector, and their unit tests; no migrations required

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
specs/010-api-gateway-metrics/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
api-gateway/
├── src/
│   ├── metrics/
│   │   ├── metrics.controller.ts
│   │   ├── metrics.service.ts
│   │   ├── metrics.module.ts
│   │   └── queue-metrics.collector.ts
│   ├── queue/
│   ├── common/
│   └── auth/
├── prisma/
├── test/
└── package.json
```

**Structure Decision**: The API Gateway owns the feature entirely. The metrics controller exposes the public scrape endpoint, the metrics service owns the registry and HTTP series, and the queue metrics collector depends on the queue service for broker stats. No schema migration is required.

## Delivery Phases

### Phase 0: Discovery And Contract Check

- Confirm the metrics endpoint is public and returns Prometheus text.
- Confirm the HTTP request metrics are registered in the same Prometheus registry.
- Confirm the queue collector consumes stats from the queue service and writes gauges into the registry.

### Phase 1: Design And Data Shape

- Capture the registry, histogram, counter, and gauge surfaces.
- Capture the queue polling interval and shutdown behavior.
- Capture the error handling for failed queue-stat collection.

### Phase 2: Implementation By Service

- Keep all runtime code in `api-gateway/src/metrics/` and the shared queue/config boundary.
- Preserve the current metric names, labels, and text response format.
- Avoid any schema changes because metrics are external observability state, not persisted business data.

### Phase 3: Verification And Hardening

- Run the focused metrics unit tests first.
- Verify registry output, request recording, queue gauges, and collector shutdown.
- Confirm the build still passes after the metrics module is loaded.

## Validation Commands

- API Gateway metrics slice: `cd api-gateway && npm test -- metrics`
- API Gateway build: `cd api-gateway && npm run build`
- Full gateway test suite if needed: `cd api-gateway && npm test`

## Complexity Tracking

Use this table only if the plan needs a justified exception to the normal brownfield guardrails.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | No exception is required for this migrated metrics slice | The existing runtime implementation already fits the service boundary |