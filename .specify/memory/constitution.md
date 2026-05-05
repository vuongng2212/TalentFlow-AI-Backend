<!--
Sync Impact Report
Version change: 1.1.1 -> 1.2.0
Modified principles:
- I. Codebase Truth First -> I. Runtime Truth First
- II. Service Boundaries Are Explicit expanded to reflect API Gateway, CV Parser,
	and Notification maturity differences
- III. Validate At The Boundaries expanded with config, file, and event-contract
	guidance
- IV. Test The Contract, Not The Hunch expanded with service-local verification
	and producer/consumer checks
- V. Operate Safely And Transparently expanded with observability and async
	failure-handling rules
Added sections:
- Documentation & Knowledge Sync
Removed sections:
- None
Templates requiring updates:
- ✅ .specify/templates/plan-template.md reviewed; no change required
- ✅ .specify/templates/spec-template.md reviewed; no change required
- ✅ .specify/templates/tasks-template.md reviewed; no change required
- ✅ docs/INDEX.md reviewed; no change required
- ✅ README.md reviewed; no change required
Follow-up TODOs:
- None
-->

# TalentFlow AI Backend Constitution

## Core Principles

### I. Runtime Truth First
Current runtime code, generated contracts, schema files, and checked-in service
wiring are the source of truth for this brownfield repository. Legacy PRDs,
archived BMAD outputs, planning notes, and distillations are historical context,
not authority. When those artifacts conflict with live code or config, update the
documentation to match the runtime or record the gap explicitly.

### II. Service Boundaries Are Explicit
The API Gateway is the canonical HTTP surface. The CV Parser is an asynchronous
RabbitMQ worker. Notification is a scaffolded runtime shell with real NestJS
bootstrap, config validation, Prisma wiring, health checks, and messaging
foundations, but its business delivery flows remain incomplete. Cross-service
changes must preserve these maturity differences, the existing message topology,
and the ownership model instead of collapsing services into a shared abstraction.

### III. Validate At The Boundaries
All external input must be validated and typed at the edge: HTTP payloads, queue
messages, file metadata, config values, and external API responses. Use dedicated
DTOs for nested shapes, explicit types for contracts, and immutable mapping when
transforming inbound data. Do not introduce `any` for request, payload, or
contract data when a concrete type can be defined.

### IV. Test The Contract, Not The Hunch
Non-trivial changes must be verified before merge with the narrowest effective
test at the touched boundary. Preserve the separation between unit, integration,
and end-to-end tests. Cross-service behavior, auth, upload flow, queue flow, and
contract changes require focused producer/consumer coverage, and behavior changes
should fail before they pass when practical.

### V. Operate Safely And Transparently
Keep structured logging, correlation IDs, health checks, metrics, explicit error
handling, queue retry/DLQ safeguards, and deterministic failure states intact.
Avoid silent failure, hidden retries, or ad hoc state mutation. Preserve the
existing response envelope and keep operational values config-driven instead of
hardcoded.

## Brownfield Scope Guardrails

- Treat `api-gateway/`, `cv-parser/`, and `notification/` as distinct parts with
	different maturity levels: implemented, partial, and scaffolded runtime.
- Use the active brownfield context under `specs/001-brownfield-context/` and the
	runtime entrypoints as current authority; treat `_bmad-output/` and `docs/` as
	comparison material for gap analysis.
- For Notification, distinguish between the working service shell and the
	unfinished business flows; do not describe it as complete when the code only
	boots, validates config, exposes health, and loads Prisma/RabbitMQ foundations.
- Preserve the current runtime contract rule that CV upload events use `bucket`
	plus `fileKey`; do not reintroduce direct file URLs.
- Keep repository-wide changes minimal and localized unless a cross-service
	contract really requires coordinated updates.
- When a feature spans services, update producer and consumer contracts together
	and include the migration or compatibility story in the work.
- Keep storage, queue, auth, and Prisma changes aligned with the existing service
	responsibilities instead of inventing parallel flows.
- Move durable static values into environment config and validate them centrally.

## Workflow and Quality Gates

- For non-trivial work, plan first, then RED -> GREEN -> REFACTOR for the
	touched slice where practical, then validate before broadening scope.
- Use service-local commands and tests that match the runtime: Jest and NestJS
	checks in the gateway, Maven and Spring Boot tests in the parser, and
	scaffold-aware checks for Notification's current runtime shell until delivery
	features are complete.
- For Notification, validate bootstrapping, config schema, health probes, auth
	guards, Prisma wiring, and RabbitMQ connectivity alongside feature work.
- Schema changes in the gateway must update `prisma/schema.prisma` and the
	related migration path together.
- Documentation updates are required when contracts, flows, configuration
	expectations, or service maturity claims change.
- Keep generated brownfield docs aligned with the runtime snapshot so future AI
	work starts from the correct context.
- Review changes against the repository's actual runtime behavior, not only the
	planned architecture.
- Keep the repo's coverage expectations in mind: 80%+ overall and 90%+ on
	critical paths such as auth, upload, and CV processing.

## Documentation & Knowledge Sync

- The active documentation set is `specs/001-brownfield-context/` plus the
	runtime references in `docs/`. Legacy archive material is for comparison and
	gap analysis only.
- When durable rules change, update this constitution and the affected active
	guidance docs together so the repo does not drift back to archival truth.
- Preserve the reading order that starts from runtime truth, then uses generated
	documentation, and only then consults archived legacy materials.
- Keep project-management guidance concise and actionable; do not embed old
	planning narratives where the live code already defines the behavior.

## Governance

This constitution overrides lower-level guidance when there is a conflict.
Amendments require a documented rationale, a compatibility or migration note for
behavioral changes, and validation that the updated rule still matches the live
repository. Versioning follows semantic versioning: MAJOR for incompatible rule
changes, MINOR for new or materially expanded principles or sections, and PATCH
for wording or clarification changes.

All agents and contributors must check constitution compliance before making
implementation decisions. If a requested change would violate a principle, the
work must either justify the exception in the plan or revise the constitution
first. Keep this file synchronized with the brownfield reality of the repo and
review it whenever durable architecture, contract, or workflow rules change.

Compliance reviews must compare proposed work against the runtime code and the
active brownfield context, not only legacy planning materials. If a document or
task relies on archival truth that no longer matches the runtime, correct the
document or narrow the scope before implementation proceeds.

**Version**: 1.2.0 | **Ratified**: 2026-05-04 | **Last Amended**: 2026-05-05
