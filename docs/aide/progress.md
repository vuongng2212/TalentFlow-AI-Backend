# TalentFlow AI Progress

This file tracks the brownfield MVP and the separate SaaS expansion track using the vision and roadmap as the source of truth.

## Status Key

- 📋 Planned
- 🚧 In Progress
- ✅ Complete
- ⏸️ Deferred
- ❌ Excluded

## Current Baseline

- ✅ API Gateway is the active product core for auth, jobs, candidates, applications, storage, queue publishing, Redis support, metrics, and health checks.
- ✅ CV Parser is already established through Phase 3, with remaining work starting at Phase 4.
- ✅ Notification is already established through Phase 3, with remaining work starting at Phase 4.
- ✅ The current API Gateway workspace boundary, member logic, live `isBusiness` proxy, and `WORKSPACE_MAX_ACTIVE_MEMBERS` cap are part of the baseline.
- ✅ CV upload events already use `bucket` plus `fileKey` instead of direct file URLs.

## Stage 1: Contract Stabilization and Release Baseline

### Roadmap Deliverables

- 📋 Confirm the queue event shapes for CV upload, parsing, scoring, and notification delivery.
- 📋 Verify that the storage contract remains bucket-plus-fileKey across producer and consumer code.
- 📋 Align service startup validation, environment variables, and health checks across all three services.
- 📋 Add or update smoke tests that cover the current happy path from CV upload to queued processing.
- 📋 Document the exact remaining service phases so future work does not reopen already-complete scope.
- 📋 Make invalid or malformed contract payloads fail fast rather than being silently accepted.

### Vision Coverage

- 📋 Keep identity, access, and session control stable for protected ATS actions.
- 📋 Keep job management and workflow design aligned with the current gateway baseline.
- 📋 Keep CV intake, storage, and validation deterministic at the first security boundary.
- 📋 Preserve health checks, structured logs, and metrics as the baseline operational surface.

## Stage 2: Complete the CV Processing Pipeline

### Roadmap Deliverables

- 📋 Complete parser Phase 4 for scoring and event publishing.
- 📋 Complete parser Phase 5 for orchestration and short-transaction integration.
- 📋 Complete parser Phase 6 for test coverage, security cases, and integration tests.
- 📋 Complete parser Phase 7 for Docker, CI, environment docs, and runbook material.
- 📋 Ensure parser failures publish deterministic failure events and do not duplicate business state.

### Vision Coverage

- 📋 Finish asynchronous parsing and AI-assisted evaluation for uploaded CVs.
- 📋 Produce structured profile data, OCR output when needed, and recruiter-friendly scoring.
- 📋 Keep parser performance bounded enough for recruiter-facing workflows.
- 📋 Preserve idempotency and retry safety for parse, scoring, and downstream publishing.

## Stage 3: Complete Notification Delivery and User Reachability

### Roadmap Deliverables

- 📋 Complete notification Phase 4 for authenticated Socket.IO real-time delivery.
- 📋 Complete notification Phase 5 for notification history, read state, and cleanup retention.
- 📋 Complete notification Phase 6 for testing, documentation, and release hardening.
- 📋 Keep notification delivery aligned with the same event contract used by the parser and gateway.
- 📋 Preserve PII masking and secure logging across email, WebSocket, and persistence flows.

### Vision Coverage

- 📋 Complete workflow automation and notifications for candidate lifecycle changes.
- 📋 Keep delivery traceable so the system can explain who was notified and why.
- 📋 Keep notification side effects synchronized with the system of record.

## Stage 4: End-to-End MVP Hardening and Release Readiness

### Roadmap Deliverables

- 📋 Run full end-to-end tests across api-gateway, cv-parser, and notification.
- 📋 Verify idempotency, authorization, and failure handling across the full intake-to-delivery path.
- 📋 Tighten operational documentation, deployment notes, and troubleshooting guidance.
- 📋 Confirm metrics, logs, and health checks give operators enough signal to support the MVP in production.
- 📋 Capture release criteria for the internal MVP and the separate future expansion track.

### Vision Coverage

- 📋 Centralize candidate records, stage history, attachments, notes, and workflow actions into a coherent dossier.
- 📋 Accept authorized external automation intake through approved API contracts and deterministic rule matching.
- 📋 Keep observability, audit trails, and failure visibility strong enough for production support.
- 📋 Keep the internal MVP focused on ATS workflow efficiency rather than public SaaS expansion.

## Expansion Track: SaaS B2B Future Work

- ⏸️ Add subscription, entitlement, and workspace governance with plan lifecycle management.
- ⏸️ Support owner-context eligibility for `USER` versus `WORKSPACE` flows.
- ⏸️ Enforce collaboration limits, verified payment lifecycle handling, and quota gating.
- ⏸️ Add n8n-driven mail automation for the later SaaS phase.
- ⏸️ Preserve the current workspace routes while the billing-backed multi-tenant model is developed.
- ⏸️ Deliver the public SaaS B2B expansion after the internal MVP is stable.
