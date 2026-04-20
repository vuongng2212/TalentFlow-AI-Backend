---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - "prd.md"
  - "project-context.md"
workflowType: "architecture"
project_name: "TalentFlow-AI-Backend"
user_name: "VuongNguyen"
date: "2026-04-17"
lastStep: 8
status: "complete"
completedAt: "2026-04-17"
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements**

- Identity and access: email/password authentication plus role-based authorization for protected ATS actions.
- Job management: create, edit, open, and close jobs; configure per-job workflow stages.
- Smart CV pipeline: PDF/DOCX intake, async processing, profile extraction, AI fit scoring, and screening summaries.
- Candidate management: Kanban stage movement and a centralized profile timeline.
- Automation and communication: event-driven processing, status-transition emails, and real-time recruiter updates.
- Growth expansion: natural-language candidate search, Gmail + n8n ingestion, plan/subscription lifecycle, workspace collaboration, and entitlement gating.

**Non-Functional Requirements**

- Candidate PII protection and role-restricted access.
- Auditability for stage transitions, ingestion, and payment/subscription state changes.
- Boundary validation for file intake, automation requests, and callbacks.
- Idempotent handling for ingestion retries and payment callback retries.
- Reliable async processing with traceability and explicit failure states.
- Deterministic owner-context entitlement enforcement for USER and WORKSPACE flows.
- CV extraction accuracy target: at least 85% on the validation dataset for core profile fields.
- Performance target: CV parse and match latency should stay under 10 seconds p95 per CV.

**Scale & Complexity**

- Primary domain: backend/API platform with async event-driven processing.
- Complexity level: medium in implementation surface, even though the PRD classifies the product as low complexity.
- Estimated architectural components: 8 core domains.

### Technical Constraints & Dependencies

- Existing implementation baseline is a brownfield polyglot backend.
- API Gateway is NestJS/Prisma/TypeScript with strict validation, guarded routes, cookie-based auth, Redis refresh rotation, and sanitized error responses.
- CV Parser is Spring Boot 3.3 on Java 17 with RabbitMQ manual ack, retry/backoff, DLQ routing, and JSON event conversion.
- File intake is constrained to PDF/DOCX with signature checks and a 10MB cap.
- Event payloads must use `bucket + fileKey`; do not introduce `fileUrl` back into the contract.
- The repo-specific `project-context.md` is the authoritative source for implementation rules.
- No UX, research, or brief documents were found; architecture is currently driven by the PRD plus project context only.

### Cross-Cutting Concerns Identified

- Authentication, authorization, and owner-context entitlement checks.
- Input validation at HTTP, queue, and file boundaries.
- Idempotency and retry safety for async processing.
- Audit logging and traceability across workflow, automation, and payment flows.
- File security, upload constraints, and storage access patterns.
- Real-time updates and notification consistency.
- Config-driven operational limits and observability.

### Validation Check

- The architecture should stay centered on the current codebase, not legacy documentation.
- The biggest architectural pressure points are async event contracts, owner-aware entitlement policy, and secure intake/processing boundaries.

## Starter Template Evaluation

### Primary Technology Domain

- API/Backend, continuing a brownfield codebase rather than starting from scratch.

### Starter Options Considered

- **Existing codebase** as the foundation.
- **External NestJS starter/boilerplate** as a replacement foundation.

### Selected Starter: Existing Codebase

**Rationale for Selection:**

- The repo already contains the NestJS gateway, Prisma schema, auth baseline, queue/event plumbing, and CV parser integration.
- The current structure is already opinionated around validation, logging, guards, and async contracts.
- Replacing the working brownfield base with a new starter would add churn and risk without architectural gain.

**Initialization Command:**

- None; continue the current repository.

**Architectural Decisions Provided by the Starter:**

- Module-by-domain backend structure.
- Strict validation and guarded routes.
- Prisma data access patterns.
- Async event-driven CV processing and notifications.
- Shared observability/logging conventions.

**Note:** This brownfield repository is the starter. Architecture work continues from the current codebase rather than a fresh bootstrap.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

- Keep the current polyglot brownfield architecture: API Gateway (NestJS), CV Parser (Spring Boot), Notification service, with asynchronous integration through RabbitMQ.
- Preserve PostgreSQL + Prisma as the transactional source of truth for ATS and subscription state.
- Standardize owner-context entitlement evaluation around `(ownerType, ownerId)` with deterministic policy gates before protected actions.
- Keep strict boundary validation and security baseline (global validation pipe, guards, throttling, upload signature checks, sanitized errors).
- Preserve event contract rule for CV processing: payloads use `bucket + fileKey` and retain retry/DLQ semantics.

**Important Decisions (Shape Architecture):**

- Use REST + OpenAPI/Swagger as the external contract strategy for current scope.
- Keep Redis for refresh-token/session controls, lockout support, and short-lived idempotency/caching concerns.
- Maintain auditability as a first-class architectural concern for workflow transitions, ingestion, and payment/subscription lifecycle.
- Keep real-time user updates and notifications as event-driven capabilities, not tightly coupled synchronous flows.

**Deferred Decisions (Post-MVP):**

- Natural-language retrieval implementation details beyond current growth baseline.
- Search engine selection details for expanded semantic retrieval and ranking optimization.
- Multi-region active-active topology and cross-region event replication strategy.
- Contract registry tooling for event schema governance.

### Data Architecture

- **Primary transactional store:** PostgreSQL 16 via Prisma 6.7.0.
- **Modeling approach:** domain-centric entities for auth, jobs, candidates, applications, workflows, subscriptions, and entitlements.
- **Validation strategy:** schema/DTO validation at boundaries before persistence.
- **Migration approach:** Prisma migrations with repository migration discipline.
- **Caching/session layer:** Redis 7 for refresh/session and selected short-lived operational state.

### Authentication & Security

- **Authentication method:** cookie-based JWT with refresh rotation and blacklist/lockout controls.
- **Authorization model:** global guard enforcement with role policy checks.
- **Security middleware baseline:** Helmet, HPP, CORS policy control, cookie parser, request-size limits.
- **API protection:** throttling, strict input validation, sanitized error envelopes, upload file signature checks.
- **Data protection:** encrypted transport, encryption at rest for candidate data paths, and controlled access to candidate PII.
- **Payment integrity:** payment callbacks and settlement-change events must be signature-verified before any transaction or subscription update.

### API & Communication Patterns

- **External API style:** REST endpoints with versioned prefix and OpenAPI documentation.
- **Error handling standard:** centralized exception filter with deterministic response shape.
- **Async integration:** RabbitMQ event-driven communication between gateway/parser/notification paths.
- **Reliability pattern:** idempotent intake/callback handling, retry with backoff, and DLQ isolation.
- **Contract governance:** preserve current event naming/contracts and evolve additively for compatibility.

### Frontend Architecture

- Not in active scope for this backend architecture document.
- Frontend integration assumptions are represented as API consumers and realtime subscribers only.

### Infrastructure & Deployment

- **Runtime model:** containerized services with environment-driven configuration.
- **Local baseline:** Docker Compose for PostgreSQL, Redis, RabbitMQ, MinIO.
- **Service deployment:** independent deployability for API Gateway, CV Parser, Notification service.
- **Observability:** structured logging, metrics endpoints, correlation IDs, and operational health/readiness checks.
- **Scalability direction:** horizontal service scaling with queue-based load leveling.

### Decision Impact Analysis

**Implementation Sequence:**

1. Enforce boundary/security and contract consistency first.
2. Stabilize core data and entitlement policy paths.
3. Expand async workflow, notification, and ingestion reliability.
4. Add growth-scope capabilities (search, monetization refinements) on top of stable foundations.

**Cross-Component Dependencies:**

- Entitlement policy influences API authorization, workflow actions, and quota enforcement.
- Event contract integrity links Gateway, Parser, and Notification behavior.
- Audit and idempotency requirements span all write paths and callback-driven transitions.
- Upload/security constraints influence storage adapters, parser inputs, and validation boundaries.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**

- Naming consistency across API, database, and TypeScript code.
- Directory ownership and module boundaries in a polyglot repository.
- Response and error envelope stability across endpoints.
- Event contract evolution without breaking consumers.
- Retry/idempotency behavior in async flows.

### Naming Patterns

**Database Naming Conventions:**

- Database columns and relational keys use snake_case.
- Prisma model names remain PascalCase, mapped to physical naming as needed.
- Index/constraint naming should stay deterministic and descriptive.

**API Naming Conventions:**

- Route resources use plural nouns and stable versioned API base.
- Query parameters use camelCase at API boundary unless existing endpoints require backward-compatible names.
- Headers follow canonical HTTP naming; custom headers remain explicit and documented.

**Code Naming Conventions:**

- TypeScript variables/functions: camelCase.
- Classes, DTOs, and interfaces: PascalCase.
- File names follow established module-local conventions; avoid mixed naming styles within a module.

### Structure Patterns

**Project Organization:**

- Keep feature/domain-first module organization.
- Co-locate controllers/services/DTOs/validators per domain module.
- Keep infra adapters (queue/storage/cache/logger) separated from domain services.
- Keep tests either co-located or in module-aligned test paths consistently per package.

**File Structure Patterns:**

- Configuration schemas and environment access live in dedicated config layers.
- Shared utilities stay in common modules with narrow, reusable responsibilities.
- Avoid cross-domain cyclic dependencies; integrate through explicit interfaces/events.

### Format Patterns

**API Response Formats:**

- Success and error payloads must remain deterministic and documented.
- Error payloads must avoid leaking internal stack or sensitive context.
- Timestamps should be UTC and ISO-8601 for interchange consistency.

**Data Exchange Formats:**

- JSON payload keys should stay consistent across producers/consumers.
- Nullable fields must be explicit and documented.
- Use additive changes for payload evolution to maintain compatibility.

### Communication Patterns

**Event System Patterns:**

- Use stable dot-notated domain events and avoid ad-hoc naming drift.
- Keep event payload contracts explicit, typed, and version-aware.
- Preserve retry + DLQ semantics for failure isolation.

**State Management Patterns:**

- Use immutable update patterns for in-memory state transitions.
- Ensure each async operation has explicit success/failure outcomes.
- Preserve idempotent processing for retried ingestion/callback operations.

### Process Patterns

**Error Handling Patterns:**

- Validate at boundaries and fail fast with deterministic error responses.
- Separate internal diagnostics from user-facing error messages.
- Log with correlation IDs for cross-service traceability.

**Loading/Processing State Patterns:**

- Represent long-running async tasks through explicit workflow states.
- Avoid hidden implicit state transitions; log each state mutation.
- Ensure retried operations converge to one deterministic outcome.

### Enforcement Guidelines

**All AI Agents MUST:**

- Follow naming and module-boundary conventions consistently.
- Preserve response/event contract stability.
- Implement boundary validation and explicit failure handling.

**Pattern Enforcement:**

- Use linting, tests, and contract checks as merge gates.
- Treat pattern violations as architecture drift and correct before merge.
- Update this document when durable new patterns are introduced.

### Pattern Examples

**Good Examples:**

- Coherent module ownership with DTO/service/controller grouped by domain.
- Event payloads evolved additively without breaking existing consumers.
- Idempotent callback handling with traceable state transitions.

**Anti-Patterns:**

- Cross-module direct coupling that bypasses defined boundaries.
- Inconsistent naming conventions across API/database/code.
- Silent retries without explicit idempotency keys or audit trail.

## Project Structure & Boundaries

### Representative Project Directory Structure

- This snapshot highlights the main directories relevant to the architecture decisions and is not a literal file-by-file inventory.

```text
TalentFlow-AI-Backend/
├── CLAUDE.md
├── PLANNING.md
├── README.md
├── docker-compose.yml
├── _bmad/
├── _bmad-output/
│   ├── project-context.md
│   └── planning-artifacts/
│       ├── prd.md
│       ├── prd-validation-report.md
│       └── architecture.md
├── api-gateway/
│   ├── package.json
│   ├── nest-cli.json
│   ├── tsconfig.json
│   ├── eslint.config.mjs
│   ├── jest.config.js
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── common/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── jobs/
│   │   ├── applications/
│   │   ├── candidates/
│   │   ├── interviews/
│   │   ├── workspaces/
│   │   ├── analytics/
│   │   ├── health/
│   │   ├── metrics/
│   │   ├── prisma/
│   │   ├── redis/
│   │   ├── queue/
│   │   └── storage/
│   └── test/
│       ├── app.e2e-spec.ts
│       ├── auth.e2e-spec.ts
│       ├── jobs.e2e-spec.ts
│       ├── applications.e2e-spec.ts
│       ├── cv-upload.e2e-spec.ts
│       ├── workspaces.e2e-spec.ts
│       ├── infrastructure.e2e-spec.ts
│       └── jest-e2e.json
├── cv-parser/
│   ├── pom.xml
│   └── src/main/
│       ├── java/com/talentflow/cvparser/
│       │   ├── CvParserApplication.java
│       │   └── shared/
│       │       ├── config/
│       │       ├── dto/
│       │       ├── exception/
│       │       ├── util/
│       │       └── validation/
│       └── resources/
│           ├── application.yml
│           ├── application-dev.yml
│           ├── application-test.yml
│           └── application-prod.yml
├── notification/
│   ├── README.md
│   └── IMPLEMENTATION-PHASES.md
└── k8s/
    └── api-gateway/
        ├── deployment.yaml
        ├── service.yaml
        ├── ingress.yaml
        ├── hpa.yaml
        ├── configmap.yaml
        ├── secret.yaml
        └── servicemonitor.yaml
```

### Architectural Boundaries

**API Boundaries:**

- External consumer boundary is API Gateway (`api-gateway/src/*`) under versioned HTTP routes.
- Internal access controls are enforced through global guards and policy checks.
- Upload ingestion remains an API boundary, not direct storage/queue access.

**Component Boundaries:**

- Domain modules in `api-gateway/src/*` own domain-specific controller/service/DTO logic.
- Shared concerns stay in `api-gateway/src/common/*` and infrastructure modules (`queue`, `storage`, `redis`, `prisma`).
- Parser concerns are isolated in `cv-parser` with explicit shared DTO/config packages.

**Service Boundaries:**

- API Gateway handles auth, orchestration, persistence coordination, and event publishing.
- CV Parser handles parsing/scoring work via asynchronous event consumption.
- Notification service is a separate integration boundary for outbound communications.

**Data Boundaries:**

- Transactional writes are controlled through Prisma/PostgreSQL in `api-gateway/prisma`.
- Ephemeral/operational state (sessions, throttling, cache) uses Redis.
- File objects are stored via storage adapters and referenced by `bucket + fileKey`.

### Requirements to Structure Mapping

**Functional Traceability:**

- Identity & access (FR-01/FR-02) -> `api-gateway/src/auth`, `api-gateway/src/users`.
- Job management (FR-03/FR-04) -> `api-gateway/src/jobs`.
- CV intake and screening (FR-05..FR-09) -> `api-gateway/src/storage`, `api-gateway/src/queue`, `cv-parser/src/main/java/com/talentflow/cvparser/shared/*`.
- Candidate workflow (FR-10/FR-11) -> `api-gateway/src/candidates`, `api-gateway/src/applications`, `api-gateway/src/interviews`.
- Automation and realtime (FR-12/FR-13/FR-15/FR-16) -> `api-gateway/src/queue`, `api-gateway/src/metrics`, gateway domain modules.
- Growth search (FR-14) -> deferred semantic-search subsystem; keep the search design isolated from core ATS flows until the growth-scope architecture is defined.
- Entitlement and collaboration (FR-17..FR-20) -> `api-gateway/src/workspaces`, related auth/policy layers.

**Non-Functional Traceability:**

- NFR-01 -> parser scoring and validation dataset checks.
- NFR-02 -> queue pipeline timing metrics and load-test instrumentation.
- NFR-03 -> encrypted transport plus at-rest encryption for candidate data paths.
- NFR-04 -> global guards and authorization policy checks.
- NFR-05 -> audit logs and reconciliation for workflow, ingestion, and payment events.
- NFR-06 -> idempotency keys, retry/backoff, and DLQ isolation.
- NFR-07 -> signature verification before any payment or settlement state mutation.
- NFR-08 -> UTC boundary handling for quota reset and grace-window expiration.

**Cross-Cutting Concerns:**

- Validation, filters, interceptors, logging -> `api-gateway/src/common/*` + `main.ts` bootstrap.
- Data schema and migrations -> `api-gateway/prisma/*`.
- Deployment/runtime config -> `k8s/api-gateway/*`, `docker-compose.yml`, service env files.

### Integration Points

**Internal Communication:**

- Domain modules communicate via service boundaries inside API Gateway.
- Async cross-service operations flow through RabbitMQ contracts.

**External Integrations:**

- Object storage (S3-compatible), queue broker, cache store, and optional observability backends.
- Payment/automation external systems enter only through protected API boundaries.

**Data Flow:**

- Intake request -> gateway validation/persistence -> event publish -> parser processing -> status/notification updates -> recruiter-facing API state.

### File Organization Patterns

**Configuration Files:**

- Runtime configs stay in package-level config files and environment variables.
- Parser environment variants remain in `cv-parser/src/main/resources`.

**Source Organization:**

- Domain-first modules in gateway; parser shared packages for DTO/config/exceptions.

**Test Organization:**

- E2E specs under `api-gateway/test`, unit specs co-located in source modules.

**Asset Organization:**

- CV binary payloads are externalized to object storage, not stored as code assets.

### Development Workflow Integration

**Development Server Structure:**

- Local development uses package-specific commands plus shared infra via Docker Compose.

**Build Process Structure:**

- API Gateway and CV Parser build independently with package-local toolchains.

**Deployment Structure:**

- Service-level deployment manifests and env-driven runtime configuration support independent rollout boundaries.

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**

- Core decisions are compatible with the existing brownfield stack and runtime boundaries.
- Security, validation, async communication, and data decisions reinforce each other without direct conflicts.

**Pattern Consistency:**

- Naming/structure/communication patterns align with chosen module boundaries and service responsibilities.
- Error/idempotency/process patterns are consistent with async operational requirements.

**Structure Alignment:**

- Directory boundaries and integration points are aligned with the architectural decisions and existing code organization.
- Project tree supports independent service evolution while preserving contract-driven interoperability.

### Requirements Coverage Validation ✅

**Feature Coverage:**

- Functional groups from PRD (identity, jobs, CV pipeline, candidate workflow, automation, entitlement/collaboration, growth-search) are mapped to concrete modules or explicitly deferred paths.

**Functional Requirements Coverage:**

- FR categories are architecturally supported through module ownership, persistence boundaries, event-driven orchestration, and the explicit traceability matrix above.

**Non-Functional Requirements Coverage:**

- Security, auditability, boundary validation, idempotency, performance, and operational reliability are explicitly represented in architectural controls and traceability notes.

### Implementation Readiness Validation ✅

**Decision Completeness:**

- Critical and important decisions are documented; deferred items are explicitly flagged as follow-up work.

**Structure Coverage:**

- Representative directory structure, service boundaries, and integration boundaries are defined for the current scope.

**Pattern Completeness:**

- Conflict-prone areas (naming, contract evolution, retry behavior, error handling) are covered with consistency rules.

### Gap Analysis Results

**Critical Gaps:**

- None that block current-scope implementation.

**Important Gaps:**

- Detailed strategy for growth-scope semantic search indexing/ranking remains to be specified in follow-up design.
- Event schema governance process/tooling detail can be expanded in implementation readiness follow-up.

**Nice-to-Have Gaps:**

- Expanded observability runbooks for cross-service incident handling.
- Additional automated contract-check tooling recommendations.

### Validation Issues Addressed

- Resolved scope ambiguity by explicitly treating this document as backend architecture only.
- Resolved starter ambiguity by selecting brownfield continuation instead of external bootstrap replacement.

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**

- [x] Critical decisions documented
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Security/performance reliability considerations addressed

**✅ Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**

- [x] Representative directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements-to-structure mapping completed for current scope

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION WITH FOLLOW-UP GAPS

**Confidence Level:** Medium-High

**Key Strengths:**

- Clear boundaries between gateway, parser, and infrastructure responsibilities.
- Strong consistency rules for multi-agent implementation.
- Explicit traceability from requirements to modules and integration flows.

**Areas for Future Enhancement:**

- Growth-scope search architecture detail.
- Event schema lifecycle governance automation.

### Implementation Handoff

**AI Agent Guidelines:**

- Follow architectural boundaries and consistency rules exactly.
- Treat event/API contracts as compatibility-sensitive artifacts.
- Preserve idempotency, auditability, and boundary validation in all new changes.

**First Implementation Priority:**

- Execute story planning and decomposition from this architecture, then implement highest-priority foundational stories.
