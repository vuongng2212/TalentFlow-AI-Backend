<!--
Sync Impact Report
Version change: 1.1.0 -> 1.1.1
Modified principles:
- None; this update clarified supporting governance sections without changing core principle titles
Added sections:
- None
Removed sections:
- None
Templates requiring updates:
- ✅ .specify/templates/plan-template.md reviewed; no change required
- ✅ .specify/templates/spec-template.md reviewed; no change required
- ✅ .specify/templates/tasks-template.md reviewed; no change required
- ✅ README.md reviewed; no change required
- ✅ docs/INDEX.md reviewed; no change required
Follow-up TODOs:
- None
-->

# TalentFlow AI Backend Constitution

## Core Principles

### I. Codebase Truth First
Current runtime code and checked-in configuration are the source of truth for this
brownfield repository. Generated docs, planning artifacts, and legacy notes are
context, not authority. When docs conflict with code or config, update the docs to
match the live implementation or explicitly flag the mismatch for follow-up.

### II. Service Boundaries Are Explicit
The API Gateway is the canonical HTTP surface. The CV Parser is an asynchronous
RabbitMQ worker. Notification is a scaffolded runtime shell: it has real NestJS
bootstrapping, config validation, Prisma schema, health checks, auth wiring, and
RabbitMQ/SMTP/WebSocket foundations, but its delivery and consumer flows remain
incomplete. Cross-service changes must preserve the current boundaries, message
topology, and ownership model instead of collapsing services into a shared
abstraction.

## Service Maturity Snapshot

- API Gateway: implemented HTTP gateway and canonical entry point.
- CV Parser: partially implemented asynchronous worker with real queue handling
	and placeholder persistence.
- Notification: scaffolded runtime service with infra/config/auth/health/
	persistence foundations, but incomplete email, WebSocket, and consumer flows.

### III. Validate At The Boundaries
All external input must be validated and typed at the edge: HTTP payloads, queue
messages, file metadata, config values, and external API responses. Use dedicated
DTOs and explicit types for nested shapes. Do not introduce `any` for request,
payload, or contract data when a concrete type can be defined.

### IV. Test The Contract, Not The Hunch
Non-trivial changes must be verified before merge with the narrowest effective
test at the touched boundary. Preserve the repo's separation between unit,
integration, and end-to-end tests. Cross-service behavior, auth, upload flow,
queue flow, and contract changes require focused integration coverage, and any
behavior change should fail before it passes when feasible.

### V. Operate Safely And Transparently
Keep structured logging, correlation IDs, health checks, metrics, and explicit
error handling intact. Avoid silent failure, hidden retries, or ad hoc state
mutation. Preserve the existing response envelope, sanitized errors, queue
retry/DLQ safeguards, and config-driven operational values.

## Brownfield Scope Guardrails

- Treat `api-gateway/`, `cv-parser/`, and `notification/` as distinct parts with
	different maturity levels: implemented, partial, and scaffolded runtime.
- For Notification, distinguish between the working service shell and the
	unfinished business flows; do not describe it as purely planned when the code
	already boots, validates config, exposes health, and loads Prisma/RabbitMQ.
- Prefer the current live contracts in source code and schema files, and
	runtime-derived generated docs, over older planning documents when choosing
	implementation details.
- Keep repository-wide changes minimal and localized unless a cross-part contract
	truly requires coordinated updates.
- When a feature spans services, update producer and consumer contracts together
	and include the migration or compatibility story in the work.
- Keep storage, queue, auth, and Prisma changes aligned with the existing service
	responsibilities instead of inventing parallel flows.
- Move durable static values into environment config and validate them centrally.

## Workflow and Quality Gates

- For non-trivial work, plan first, then RED -> GREEN -> REFACTOR for the
	touched slice where practical, then validate before broadening scope.
- Use service-local commands and tests that match the runtime: NestJS and Jest in
	the gateway, Spring Boot and Maven tests in the parser, and scaffold-aware
	checks for Notification's current runtime shell until the delivery features are
	complete.
- For Notification, validate bootstrapping, config schema, health probes, auth
	guards, Prisma wiring, and RabbitMQ connectivity alongside feature work.
- Schema changes in the gateway must update `prisma/schema.prisma` and the related
	migration path together.
- Documentation updates are required when contracts, flows, or configuration
	expectations change.
- Keep generated brownfield docs aligned with the runtime snapshot so future AI
	work starts from the correct context.
- Review changes against the repository's actual runtime behavior, not only the
	planned architecture.

## Governance

This constitution overrides lower-level guidance when there is a conflict.
Amendments require a documented rationale, a compatibility or migration note for
behavioral changes, and validation that the updated rule still matches the live
repository. Versioning follows semantic versioning: MAJOR for incompatible rule
changes, MINOR for new or materially expanded principles, and PATCH for wording
or clarification changes.

All agents and contributors must check constitution compliance before making
implementation decisions. If a requested change would violate a principle, the
work must either justify the exception in the plan or revise the constitution
first. Keep this file synchronized with the brownfield reality of the repo and
review it whenever durable architecture, contract, or workflow rules change.

**Version**: 1.1.1 | **Ratified**: 2026-05-04 | **Last Amended**: 2026-05-04
