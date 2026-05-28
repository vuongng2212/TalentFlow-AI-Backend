# Tasks: API Gateway Metrics

**Input**: Design documents from `/specs/010-api-gateway-metrics/`
**Prerequisites**: plan.md, spec.md

**Organization**: Tasks are grouped by service boundary and then by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or has no dependency on another task
- **[Story]**: Which user story the task belongs to, such as US1, US2, or US3
- Always include exact file paths in the description

## Path Conventions

- API Gateway: `api-gateway/src/`, `api-gateway/prisma/`, `api-gateway/test/`
- Shared planning docs: `specs/010-api-gateway-metrics/`

## Phase 1: Setup And Contract Lock

**Purpose**: Confirm runtime ownership, lock the contract surface, and record the existing metrics behavior.

- [x] T001 Review the current runtime entrypoint and affected metrics files for the feature in `api-gateway/src/app.module.ts`, `api-gateway/src/metrics/metrics.module.ts`, and `api-gateway/src/metrics/**`
- [x] T002 [P] Capture the metrics HTTP and registry contract in `specs/010-api-gateway-metrics/spec.md` from `api-gateway/src/metrics/metrics.controller.ts`, `api-gateway/src/metrics/metrics.service.ts`, and `api-gateway/src/metrics/queue-metrics.collector.ts`
- [x] T003 [P] Record validation, registry, and polling requirements in `api-gateway/src/metrics/**` and the queue service dependency

---

## Phase 2: Foundational Work

**Purpose**: Build the shared prerequisites that block all user stories for this feature.

- [x] T004 Wire `api-gateway/src/metrics/metrics.module.ts` with `MetricsController`, `MetricsService`, `QueueMetricsCollector`, and `QueueModule`
- [x] T005 [P] Define the Prometheus registry, HTTP metrics, and queue gauge surfaces in `api-gateway/src/metrics/metrics.service.ts` and `api-gateway/src/metrics/queue-metrics.collector.ts`
- [x] T006 [P] Establish public endpoint behavior and queue polling configuration in `api-gateway/src/metrics/metrics.controller.ts`, `api-gateway/src/metrics/queue-metrics.collector.ts`, and `api-gateway/src/common/config/config.schema.ts`
- [x] T007 Keep the minimum Prometheus and queue wiring in `api-gateway/src/metrics/metrics.service.ts` and `api-gateway/src/metrics/queue-metrics.collector.ts`

**Checkpoint**: The metrics boundary is wired and user story work can be validated independently.

---

## Phase 3: User Story 1 - Expose Prometheus Metrics (Priority: P1)

**Goal**: Serve Prometheus-formatted metrics for scraping.

**Independent Test**: `GET /metrics` returns the registry payload as plain text with the Prometheus content type.

### Tests for User Story 1

- [x] [P] [US1] Cover metrics controller behavior in `api-gateway/src/metrics/metrics.controller.spec.ts`
- [x] [P] [US1] Cover registry contents and default metrics in `api-gateway/src/metrics/metrics.service.spec.ts`

### Implementation for User Story 1

- [x] [US1] Implement the metrics endpoint in `api-gateway/src/metrics/metrics.controller.ts`
- [x] [US1] Implement the Prometheus registry and default metric registration in `api-gateway/src/metrics/metrics.service.ts`
- [x] [US1] Preserve the public scrape route in `api-gateway/src/metrics/metrics.controller.ts` and `api-gateway/src/app.module.ts`

**Checkpoint**: Prometheus scraping should now be fully functional and independently testable.

---

## Phase 4: User Story 2 - Record HTTP Request Metrics (Priority: P2)

**Goal**: Record HTTP request duration and count metrics.

**Independent Test**: Calling the request recorder updates the histogram and counter series in the registry.

### Tests for User Story 2

- [x] [P] [US2] Cover request-recording behavior in `api-gateway/src/metrics/metrics.service.spec.ts`

### Implementation for User Story 2

- [x] [US2] Implement HTTP histogram and counter recording in `api-gateway/src/metrics/metrics.service.ts`
- [x] [US2] Preserve labeled method/path/status metrics in `api-gateway/src/metrics/metrics.service.ts`

**Checkpoint**: HTTP request metrics should now be independently testable.

---

## Phase 5: User Story 3 - Collect Queue Depth Metrics (Priority: P3)

**Goal**: Collect RabbitMQ queue depth and consumer-count metrics.

**Independent Test**: The queue collector polls queue stats and populates Prometheus gauges on schedule.

### Tests for User Story 3

- [x] [P] [US3] Cover queue collector behavior in `api-gateway/src/metrics/queue-metrics.collector.spec.ts`

### Implementation for User Story 3

- [x] [US3] Implement queue gauge collection in `api-gateway/src/metrics/queue-metrics.collector.ts`
- [x] [US3] Implement queue polling interval handling and shutdown cleanup in `api-gateway/src/metrics/queue-metrics.collector.ts`
- [x] [US3] Preserve queue-service integration in `api-gateway/src/metrics/queue-metrics.collector.ts` and `api-gateway/src/queue/queue.service.ts`

**Checkpoint**: Queue metrics collection should now be independently testable.

---

## Phase 6: Cross-Cutting Validation

**Purpose**: Work that touches multiple stories or service boundaries.

- [x] T024 [P] Update the migrated documentation in `specs/010-api-gateway-metrics/spec.md`, `specs/010-api-gateway-metrics/plan.md`, and `specs/010-api-gateway-metrics/tasks.md`
- [x] T025 [P] Run or update the owning service tests using the real gateway commands in `api-gateway/package.json`
- [x] T026 [P] Preserve observability and failure-path behavior in `api-gateway/src/metrics/**`
- [x] T027 Validate backward compatibility for the existing metric names, registry behavior, and scrape route in `api-gateway/src/metrics/**`

## Gaps Found

- There is no dedicated HTTP e2e test that exercises the metrics endpoint through the full Nest runtime; current coverage is primarily unit-level.
- The queue metrics collector depends on the queue service for stats, so broker visibility is only as strong as the queue boundary.
- No Prisma schema or migration work was required for this slice because metrics are external observability data rather than persisted business data.

## Dependencies & Execution Order

### Phase Dependencies

- Setup and contract lock can start immediately.
- Foundational work blocks all user stories.
- User stories can proceed in priority order once the foundation is ready.
- Cross-cutting validation comes after the story slices that it depends on.

### Service-Specific Validation Commands

- API Gateway: `cd api-gateway && npm test -- metrics`, `cd api-gateway && npm run build`, `cd api-gateway && npm test`

### Implementation Notes

- Keep tests close to the touched boundary.
- Prefer controller, service, and collector tests for observability behavior.
- Preserve the public text scrape contract so external Prometheus scrapers keep working.
- Avoid cross-story coupling unless the contract truly requires it.

## Notes

- [P] tasks can run in parallel because they touch different files with no dependency.
- Each user story is independently completable and testable.
- This feature is already present in runtime code; the tasks document records what exists rather than a work queue to execute.