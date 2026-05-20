# TalentFlow AI Roadmap

## Roadmap Context

This roadmap is intentionally brownfield-first. It assumes the API Gateway already provides the current internal ATS core, the CV Parser has completed through Phase 3, and the Notification service has completed through Phase 3. The plan below therefore starts from the remaining work: finishing the parser and notification delivery paths, tightening cross-service contracts, and hardening the system for an internal MVP release.

The roadmap avoids re-planning the existing api-gateway business core and instead focuses on the work still needed to make the current system demonstrable, secure, and release-ready.

## Current Baseline

- API Gateway is the existing product core and remains the source of truth for auth, jobs, candidates, applications, storage, queue publishing, Redis support, metrics, and health checks.
- CV Parser is already complete through Phase 3, so the remaining work is Phase 4 through Phase 7.
- Notification is already complete through Phase 3, so the remaining work is Phase 4 through Phase 6.
- Queue payloads must continue to use `bucket` and `fileKey` rather than direct file URLs.
- The roadmap should preserve the existing service boundaries and extend them rather than collapsing them.

## Stages

### Stage 1: Contract Stabilization and Release Baseline

**Goal:** Freeze the runtime contracts between api-gateway, cv-parser, and notification so the remaining work can be completed safely without interface churn.

**Dependencies:** None. This stage starts from the current brownfield baseline.

**Deliverables:**

- Confirm the queue event shapes for CV upload, parsing, scoring, and notification delivery.
- Verify that the storage contract remains bucket-plus-fileKey across producer and consumer code.
- Align service startup validation, environment variables, and health checks across all three services.
- Add or update smoke tests that cover the current happy path from CV upload to queued processing.
- Document the exact remaining service phases so future work does not reopen already-complete scope.

**Validation:**

- `docker compose up` brings up the local stack without contract errors.
- A CV upload produces the expected queue payload and reaches the parser consumer.
- Invalid or malformed contract payloads fail fast rather than being silently accepted.
- Health endpoints for each service return OK in the local environment.

### Stage 2: Complete the CV Processing Pipeline

**Goal:** Finish the remaining CV Parser work so uploaded files are parsed, extracted, scored, and published as structured events.

**Dependencies:** Stage 1.

**Deliverables:**

- Complete parser Phase 4: scoring and event publishing.
- Complete parser Phase 5: orchestration and short-transaction integration.
- Complete parser Phase 6: test coverage, security cases, and integration tests.
- Complete parser Phase 7: Docker, CI, environment docs, and runbook material.
- Ensure parser failures publish deterministic failure events and do not duplicate business state.

**Validation:**

- A representative PDF and DOCX flow produces parsed output, extracted profile data, and a score.
- Retry and failure scenarios route to the expected dead-letter or failure handling path.
- Parser unit and integration tests pass locally and in CI.
- Coverage and security checks meet the agreed baseline before release.

### Stage 3: Complete Notification Delivery and User Reachability

**Goal:** Finish the remaining Notification service work so the system can deliver authenticated, traceable email and real-time notifications.

**Dependencies:** Stage 1. This track can proceed in parallel with Stage 2 once contracts are frozen.

**Deliverables:**

- Complete notification Phase 4: authenticated Socket.IO real-time delivery.
- Complete notification Phase 5: notification history, read state, and cleanup retention.
- Complete notification Phase 6: testing, documentation, and release hardening.
- Keep notification delivery aligned with the same event contract used by the parser and gateway.
- Preserve PII masking and secure logging across email, WebSocket, and persistence flows.

**Validation:**

- An authenticated client can join its room and receive a targeted notification.
- Unauthenticated or invalid-token clients are rejected.
- Notification history endpoints return the correct user-scoped results.
- Cleanup and delivery tests pass without leaking sensitive data into logs.

### Stage 4: End-to-End MVP Hardening and Release Readiness

**Goal:** Turn the already-built service pieces into a stable internal MVP with strong observability, auditability, and deployment readiness.

**Dependencies:** Stages 2 and 3.

**Deliverables:**

- Run full end-to-end tests across api-gateway, cv-parser, and notification.
- Verify idempotency, authorization, and failure handling across the entire intake-to-delivery path.
- Tighten operational documentation, deployment notes, and troubleshooting guidance.
- Confirm metrics, logs, and health checks give operators enough signal to support the MVP in production.
- Capture release criteria for the internal MVP and the separate future expansion track.

**Validation:**

- The full CV intake flow can be demonstrated locally from upload through parsing, scoring, and notification.
- Protected endpoints reject unauthenticated and unauthorized access.
- Observability surfaces show traceable request, queue, and notification context.
- CI passes for build, unit, integration, and end-to-end checks.

## Stage Dependencies

- Stage 1 is the foundation for every remaining stage.
- Stage 2 depends on Stage 1.
- Stage 3 depends on Stage 1 and can run in parallel with Stage 2.
- Stage 4 depends on both Stage 2 and Stage 3.

## Release Outcome

When these stages are complete, the repository should have a demonstrable internal ATS backend where the API Gateway remains the system of record, CV intake is processed through the parser pipeline, notifications are delivered securely, and the whole system is ready for a stable internal MVP release without breaking the current brownfield contracts.
