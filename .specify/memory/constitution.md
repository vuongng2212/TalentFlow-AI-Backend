# TalentFlow AI Backend Constitution

## Project Identity

TalentFlow AI Backend is a polyglot microservices Applicant Tracking System (ATS) backend composed of three primary service boundaries: `api-gateway/` (NestJS/TypeScript) for the primary HTTP API, `cv-parser/` (Spring Boot/Java) for the RabbitMQ-driven document processing worker, and `notification/` (NestJS/TypeScript) for the email and WebSocket delivery runtime.

## Core Principles

### I. Runtime Truth First

Current runtime code, generated contracts, schema files, and checked-in service wiring are the source of truth. When runtime code and documentation conflict, the runtime wins and the document must be corrected or explicitly marked as stale.

### II. Active Docs Only

The active documentation system is Spec Kit under `.specify/` and the current feature artifacts under `specs/`. Frozen legacy sources are reference-only and must not be promoted into active guidance. System-level architecture is maintained in `docs/`.

### III. Service Boundaries Are Explicit

The API Gateway is the canonical HTTP surface and orchestrator. The CV Parser is an asynchronous RabbitMQ worker for heavy processing and AI integration. Notification is a NestJS runtime shell with messaging and persistence foundations; its delivery flows must only be claimed when the code actually implements them.

### IV. Validate At The Edges

Validate HTTP payloads, queue messages, file metadata, config values, and external API responses at the boundary. Use dedicated DTOs for nested shapes, explicit contract types, and strict mapping for inbound data. Do not use `any` for request, payload, or contract data when a concrete type can be defined.

### V. Test The Contract

Non-trivial changes must be verified with the narrowest effective test at the touched boundary. Keep unit, integration, and end-to-end tests distinct. Cross-service behavior, auth, upload flow, queue flow, and storage contract changes require focused producer/consumer coverage.

### VI. Operate Safely

Keep structured logging, correlation IDs, health checks, metrics, explicit error handling, queue retry/DLQ safeguards, and deterministic failure states intact. Avoid silent failure, hidden retries, or hardcoded operational values.

## Architecture Scope Guardrails

- Treat `api-gateway/`, `cv-parser/`, and `notification/` as distinct service boundaries with different maturity levels.
- Keep `api-gateway/src/` as the HTTP, queue producer, storage, metrics, and Prisma boundary.
- Keep `cv-parser/src/main/java/com/talentflow/cvparser/` as the parser/consumer boundary.
- Keep `notification/src/` as the notification delivery boundary.
- Use runtime entrypoints and current Spec Kit artifacts as authority; use frozen legacy sources only for context recovery or comparison.
- Preserve the current runtime contract rule that CV upload events use `bucket` plus `fileKey`; do not reintroduce direct file URLs.
- Keep repository changes minimal and localized unless a cross-service contract requires coordinated updates.
- When a feature spans services, update producer and consumer contracts together and include the migration or compatibility story.
- Keep storage, queue, auth, and Prisma changes aligned with the existing service responsibilities instead of inventing parallel flows.
- Move durable static values into environment config and validate them centrally.

## Workflow And Quality Gates

- For non-trivial work, plan first, then RED -> GREEN -> REFACTOR for the touched slice where practical, then validate before broadening scope.
- Use service-local commands and tests that match the runtime:
  - API Gateway: `cd api-gateway && npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`
  - CV Parser: `cd cv-parser && mvn test` (test files located in `src/test/java/com/talentflow/cvparser/`)
  - Notification: `cd notification && npm test`, `npm run test:e2e`, `npm run lint`, `npm run build` (unit tests in `test/unit/`, integration in `test/integration/`)
- For Notification, validate bootstrapping, config schema, health probes, auth guards, Prisma wiring, and RabbitMQ connectivity alongside feature work.
- Schema changes in the gateway must update `prisma/schema.prisma` and the related migration path together.
- Documentation updates are required when contracts, flows, configuration expectations, or service maturity claims change.
- Keep generated SDD docs aligned with runtime truth so future work starts from the correct context.
- Target coverage expectations: 80%+ overall and 90%+ on critical paths such as auth, upload, and CV processing.

## Documentation And Knowledge Sync

- The active documentation set is `.specify/`, feature artifacts under `specs/`, and system documentation under `docs/`.
- Frozen legacy sources remain available for comparison only and must not be used to seed new indexes or active doc trees.
- When durable rules change, update this constitution and the affected active guidance docs together so the repo does not drift back to archived truth.
- Keep project-management guidance concise and actionable.

## Governance

This constitution overrides lower-level guidance when there is a conflict. Amendments require a documented rationale, a compatibility or migration note for behavioral changes, and validation that the updated rule still matches the live repository. Versioning follows semantic versioning: MAJOR for incompatible rule changes, MINOR for new or materially expanded principles or sections, and PATCH for wording or clarification changes.

All agents and contributors must check constitution compliance before making implementation decisions. If a requested change would violate a principle, the work must either justify the exception in the plan or revise the constitution first. Keep this file synchronized with the brownfield reality of the repo and review it whenever durable architecture, contract, or workflow rules change.

**Version**: 1.6.0 | **Ratified**: 2026-05-11 | **Last Amended**: 2026-05-11