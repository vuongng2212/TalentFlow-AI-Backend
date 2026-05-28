---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "_bmad-output/docs-distillate.md"
---

# TalentFlow-AI-Backend - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for TalentFlow-AI-Backend, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-01: Users can authenticate with email/password credentials, obtain authenticated session access, and refresh access for protected APIs.
FR-02: The system enforces role-based authorization for ATS actions and returns explicit policy errors for denied actions.
FR-03: Users can create, edit, open, and close job descriptions with lifecycle state reflected in job list/detail views.
FR-04: Recruiters can configure per-job stage workflows, and candidate transitions are validated against stage rules.
FR-05: Recruiters can upload candidate CV files in PDF/DOCX, with unsupported type/size rejected using validation feedback.
FR-06: The system triggers asynchronous CV processing after accepted intake and emits one traceable processing request per accepted intake.
FR-07: The system extracts candidate core profile data from CVs (name, email, phone, skills, experience) for recruiter review.
FR-08: The system evaluates candidate-job fit and explains the scoring basis with score, percentile band, and top matching factors.
FR-09: The system provides AI screening summaries including matched keywords, strengths, and potential gaps.
FR-10: Recruiters can move candidates on workflow board with actor/timestamp audit continuity.
FR-11: Candidate profile centralizes timeline context (interactions, notes, attachments) for authorized users.
FR-12: The system automates communication on configured stage transitions and logs delivery outcomes.
FR-13: The system provides real-time pipeline status updates and records emission timestamps for verification.
FR-14: The system supports natural-language candidate search with ranked top-N results and confidence/relevance scoring (Growth scope).
FR-15: The system accepts authorized external automation ingestion requests and maps to job rules via priority-first, specificity tie-break.
FR-16: The system handles ingestion idempotently and prevents duplicate candidate/application side effects.
FR-17: Owners can start and track subscription lifecycle by owner context, with USER → WORKSPACE auto-migration and prorated credit.
FR-18: The system tracks payment transaction lifecycle and callback outcomes, with activation only after verified success and grace-window handling for verified refund/chargeback outcomes.
FR-19: The system enforces entitlement and quota policy gates on protected actions with deterministic allow/deny outcomes.
FR-20: Business plans support workspace membership collaboration limits with member eligibility and maximum active-member constraints.

### NonFunctional Requirements

NFR-01: CV extraction accuracy is at least 85% on validation dataset for core profile fields.
NFR-02: CV parse and match latency is under 10 seconds per CV at p95.
NFR-03: Candidate data paths enforce encryption at rest and in transit.
NFR-04: 100% of protected ATS endpoints require authenticated and authorized access.
NFR-05: Workflow transitions, ingestion outcomes, and payment/subscription transitions are fully audit-logged.
NFR-06: Duplicate retries for ingestion/callback flows are idempotent and do not create duplicate state mutations.
NFR-07: Payment callbacks and settlement-change events are signature-verified before transaction/subscription updates.
NFR-08: Quota resets and grace-window expirations execute consistently on UTC boundaries.

### Additional Requirements

- Starter Template (Brownfield): continue from the existing repository baseline; do not bootstrap a new starter. This must shape Epic 1 Story 1 initialization.
- Preserve current polyglot architecture boundaries: API Gateway (NestJS), CV Parser (Spring Boot), Notification as separate/planned boundary.
- PostgreSQL + Prisma remains the transactional source of truth; Redis remains session/cache/idempotency support layer.
- Enforce owner-context policy evaluation with deterministic `(ownerType, ownerId)` gating before protected actions.
- Maintain strict boundary security baseline: validation pipe, global guards, throttling, upload signature checks, sanitized error envelopes.
- Preserve CV processing event contract with `bucket + fileKey` payload semantics; avoid arbitrary URL-based processing contracts.
- Maintain RabbitMQ reliability controls: manual ACK semantics, retry/backoff behavior, DLQ isolation, and idempotent processing.
- Keep external API strategy as versioned REST + OpenAPI and evolve contracts additively for compatibility.
- Maintain observability requirements: structured logging, metrics, correlation IDs, and health/readiness checks.
- Keep deployment/runtime environment-driven and containerized with independent service deployability.
- Preserve auditability as a first-class requirement across workflow, ingestion, and payment/subscription lifecycle events.
- Follow architecture sequencing: boundary/security + contract consistency first, then core data/entitlement paths, then async reliability, then growth-scope capabilities.

### UX Design Requirements

UX-DR0: No standalone UX Design document exists in planning artifacts; UX requirements below are derived from runtime/API behavior in docs-distillate and must be treated as implementation-facing constraints.
UX-DR1: CV upload UX must present immediate `processing` state after submission and maintain visible async progression until parsed/failed terminal outcome.
UX-DR2: Upload UX must enforce PDF/DOCX and size constraints with deterministic, user-readable rejection messages before or at submit.
UX-DR3: Auth UX must support cookie-based login/refresh/logout lifecycle and provide clear re-authentication behavior on session expiry.
UX-DR4: Validation/error UX must map normalized API error envelopes into field-level messages and an accessible summary state.
UX-DR5: List/review UX must consume pagination meta (`total`, `page`, `limit`, `totalPages`) and keep controls/state consistent across refresh/navigation.
UX-DR6: Role/workspace-aware UX must hide/disable unauthorized actions and surface deterministic policy-denial explanations.
UX-DR7: Async status and error presentation must be accessible (keyboard navigation, focus management, screen-reader announcements, non-color-only status cues).
UX-DR8: Operational UX surfaces for internal users must expose actionable diagnostics paths (API docs, health, readiness, metrics) for troubleshooting flows.
UX-DR9: UX flows that depend on Notification runtime capabilities must be explicitly marked as planned/conditional until Notification service implementation exists.

### FR Coverage Map

FR-01: Epic 1 - Secure authentication lifecycle with protected access.
FR-02: Epic 1 - Role-based authorization and deterministic deny behavior.
FR-03: Epic 1 - Job lifecycle management (create/edit/open/close).
FR-04: Epic 1 - Per-job workflow stage configuration and transition-rule validation.
FR-05: Epic 2 - CV upload intake with format/size validation.
FR-06: Epic 2 - Async CV processing trigger with traceable request lifecycle.
FR-07: Epic 2 - Candidate profile extraction from CV content.
FR-08: Epic 2 - Candidate-job fit scoring with explainable factors.
FR-09: Epic 2 - AI screening summary for recruiter decision support.
FR-10: Epic 3 - Workflow-board stage movement with actor/timestamp audit continuity.
FR-11: Epic 3 - Centralized candidate timeline context for authorized users.
FR-12: Epic 3 - Automated communication on configured stage transitions.
FR-13: Epic 3 - Real-time pipeline status updates with emission traceability.
FR-14: Epic 6 - Natural-language candidate retrieval with ranked relevance.
FR-15: Epic 4 - Authorized external automation ingestion.
FR-16: Epic 4 - Idempotent duplicate handling for ingestion reliability.
FR-17: Epic 5 - Owner-context subscription lifecycle with USER→WORKSPACE migration.
FR-18: Epic 5 - Verified payment callback lifecycle and grace-window handling.
FR-19: Epic 5 - Entitlement/quota gating with deterministic allow/deny outcomes.
FR-20: Epic 5 - Workspace collaboration limits and member eligibility enforcement.

## Epic List

### Epic 1: Secure Access & Hiring Workspace Foundation
Establish trusted access and foundational hiring-workspace operations so users can securely run core ATS workflows from day one.
**FRs covered:** FR-01, FR-02, FR-03, FR-04

### Epic 2: AI-Assisted CV Intake & Candidate Evaluation
Enable recruiters to ingest candidate CVs and receive structured, explainable AI outputs for faster and more consistent screening.
**FRs covered:** FR-05, FR-06, FR-07, FR-08, FR-09

### Epic 3: Candidate Workflow Orchestration & Communication
Allow teams to progress candidates through auditable workflow stages with centralized context, automated communication, and real-time updates.
**FRs covered:** FR-10, FR-11, FR-12, FR-13

### Epic 4: External Automation Intake with Idempotent Reliability
Allow authorized automation sources to submit candidate intake with deterministic rule resolution and duplicate-safe processing.
**FRs covered:** FR-15, FR-16

### Epic 5: Subscription, Entitlement & Workspace Governance
Enable owners to manage plan lifecycle, payment outcomes, entitlement gates, and collaboration limits consistently by owner context.
**FRs covered:** FR-17, FR-18, FR-19, FR-20

### Epic 6: Natural-Language Candidate Search & Discovery (Growth)
Provide semantic candidate discovery with ranked relevance to improve retrieval quality and hiring velocity in growth phase.
**FRs covered:** FR-14

## Epic 1: Secure Access & Hiring Workspace Foundation

Establish trusted access and foundational hiring-workspace operations so users can securely run core ATS workflows from day one.

### Story 1.1: Set up initial project from starter template

As a developer on the TalentFlow backend,
I want to initialize local development from the existing brownfield starter baseline,
So that implementation starts from a consistent and validated architecture foundation.

**FRs:** FR-01
**Architecture Requirement:** Starter Template (Brownfield continuation)

**Acceptance Criteria:**

**Given** the existing repository starter baseline and required infrastructure definitions
**When** the project bootstrap steps are executed (install dependencies, load env config, start required services)
**Then** API Gateway and required dependencies run successfully in local development mode
**And** bootstrap documentation for this baseline is explicit and reproducible for contributors.

### Story 1.2: User Registration and Login Session Bootstrap

As a recruiter or hiring manager,
I want to register and login with email/password credentials,
So that I can securely access protected ATS capabilities.

**FRs:** FR-01

**Acceptance Criteria:**

**Given** a valid signup or login request on public auth endpoints
**When** the user submits credentials
**Then** the system authenticates successfully and sets secure auth cookies
**And** invalid credentials return deterministic sanitized errors suitable for field-level UX mapping.

### Story 1.3: Session Refresh and Secure Logout Lifecycle

As an authenticated user,
I want my session to refresh and logout safely,
So that session continuity and revocation are predictable.

**FRs:** FR-01

**Acceptance Criteria:**

**Given** a valid refresh token cookie and an active session
**When** the user requests token refresh or logout
**Then** refresh rotates token context and logout revokes session context
**And** expired or invalid refresh tokens return explicit re-authentication errors.

### Story 1.4: Role-Based Access Control Enforcement

As an admin,
I want protected ATS actions to enforce role policy,
So that unauthorized operations are blocked consistently.

**FRs:** FR-02

**Acceptance Criteria:**

**Given** a protected endpoint guarded by authentication and role policy
**When** a caller without required permission invokes the endpoint
**Then** access is denied with a deterministic policy error response
**And** authorized callers can proceed without bypassing guard checks.

### Story 1.5: Job Lifecycle Management Endpoints

As a recruiter,
I want to create, update, open, and close jobs,
So that hiring pipelines can be managed from requisition to closure.

**FRs:** FR-03

**Acceptance Criteria:**

**Given** a recruiter with valid permissions
**When** the recruiter performs create/edit/open/close operations on a job
**Then** job lifecycle state persists and is visible in list/detail responses
**And** responses follow standardized envelope and validation behavior.

### Story 1.6: Per-Job Workflow Stage Configuration

As a recruiter,
I want to configure stage workflows per job,
So that candidate transitions follow role-specific hiring processes.

**FRs:** FR-04

**Acceptance Criteria:**

**Given** an existing job with configurable workflow stages
**When** the recruiter defines or updates stage rules
**Then** stage configuration is persisted and validated for structural correctness
**And** invalid transition definitions are rejected with actionable validation errors.

## Epic 2: AI-Assisted CV Intake & Candidate Evaluation

Enable recruiters to ingest candidate CVs and receive structured, explainable AI outputs for faster and more consistent screening.

### Story 2.1: CV Intake Validation and Storage Key Registration

As a recruiter,
I want to upload candidate CV files with strict intake validation,
So that only supported and safe files enter the pipeline.

**FRs:** FR-05

**Acceptance Criteria:**

**Given** a CV upload request to the intake endpoint
**When** the uploaded file is PDF/DOCX and within configured limits
**Then** the system stores the file and returns processing metadata including stable storage references
**And** unsupported type/size or invalid signatures are rejected with deterministic user-readable errors.

### Story 2.2: Async Processing Request Emission with Traceability

As a recruiter,
I want accepted CV intake to trigger asynchronous parsing automatically,
So that screening starts without manual orchestration.

**FRs:** FR-06

**Acceptance Criteria:**

**Given** a successful CV intake transaction
**When** the intake is finalized
**Then** the system emits one `cv.uploaded` event containing `bucket + fileKey` and candidate/application context
**And** duplicate emission for the same accepted intake is prevented by idempotent safeguards.

### Story 2.3: Parser Outcome Ingestion for Candidate Profile Enrichment

As a recruiter,
I want parsed candidate profile outputs to be ingested reliably,
So that candidate records reflect extracted profile data for review.

**FRs:** FR-07

**Acceptance Criteria:**

**Given** parser success events received from the queue
**When** `cv.parsed` messages are processed
**Then** extracted candidate profile fields are persisted or updated with traceable timestamps
**And** processing remains retry-safe without duplicate state mutation.

### Story 2.4: Explainable Fit Scoring and Screening Summary Exposure

As a recruiter,
I want candidate-job fit scores with explanation and summary,
So that I can make faster and more consistent screening decisions.

**FRs:** FR-08, FR-09

**Acceptance Criteria:**

**Given** a completed parse/scoring workflow for an application
**When** the recruiter fetches candidate screening data
**Then** the response includes score, percentile/relevance context, matched factors, and summary highlights
**And** response shape remains stable and suitable for downstream UI rendering.

### Story 2.5: Processing Status and Failure Outcome Visibility

As a recruiter,
I want clear processing states and failure outcomes,
So that I can act on pending and failed CV evaluations without ambiguity.

**FRs:** FR-06, FR-09

**Acceptance Criteria:**

**Given** an application with asynchronous CV processing lifecycle
**When** parsing is in-progress, succeeded, or failed
**Then** the system exposes deterministic status states with terminal success/failure information
**And** failure responses include non-sensitive error details and retryability indicators.

## Epic 3: Candidate Workflow Orchestration & Communication

Allow teams to progress candidates through auditable workflow stages with centralized context, automated communication, and real-time updates.

### Story 3.1: Audited Candidate Stage Transition Actions

As a recruiter,
I want to move candidates through workflow stages,
So that hiring progress is controlled and traceable.

**FRs:** FR-10

**Acceptance Criteria:**

**Given** a candidate application in a valid current stage
**When** a recruiter performs a stage transition permitted by configured rules
**Then** the new stage state is persisted and returned in workflow views
**And** audit records capture actor, timestamp, and transition metadata.

### Story 3.2: Centralized Candidate Timeline Context Retrieval

As a hiring manager,
I want one consolidated candidate timeline,
So that I can evaluate context without switching tools.

**FRs:** FR-11

**Acceptance Criteria:**

**Given** an authorized user opening a candidate profile
**When** timeline data is requested
**Then** interactions, notes, and attachments are returned in a single coherent timeline response
**And** list/timeline responses include deterministic pagination metadata where applicable.

### Story 3.3: Automated Communication on Stage Changes

As a recruiter,
I want configured stage transitions to trigger automated communications,
So that candidate communication remains consistent with workflow changes.

**FRs:** FR-12

**Acceptance Criteria:**

**Given** a workflow transition mapped to communication automation
**When** the transition succeeds
**Then** the system enqueues or triggers the communication attempt for that transition
**And** delivery attempt outcomes are logged for audit and troubleshooting.

### Story 3.4: Real-Time Pipeline Status Broadcasts

As a recruiter,
I want real-time pipeline status updates,
So that dashboard state reflects workflow and processing changes promptly.

**FRs:** FR-13

**Acceptance Criteria:**

**Given** relevant processing or stage-change events occur
**When** subscribed channels request live updates
**Then** status updates are published with deterministic payload shape and emission timestamp
**And** unavailable planned notification capabilities are explicitly marked as conditional/planned behavior.

## Epic 4: External Automation Intake with Idempotent Reliability

Allow authorized automation sources to submit candidate intake with deterministic rule resolution and duplicate-safe processing.

### Story 4.1: Protected External Automation Intake Endpoint

As an integration owner,
I want a protected ingestion endpoint for external automation,
So that automation can submit candidate intake without bypassing platform controls.

**FRs:** FR-15

**Acceptance Criteria:**

**Given** an external automation request with valid authorization
**When** the request is submitted to the ingestion boundary
**Then** schema validation and policy checks run before any domain write/event side effect
**And** unauthorized or invalid requests are rejected with deterministic API errors.

### Story 4.2: Deterministic Ingestion Rule Resolution

As an integration owner,
I want job mapping rules to resolve deterministically,
So that automation outcomes are predictable and governable.

**FRs:** FR-15

**Acceptance Criteria:**

**Given** multiple ingestion rules matching an incoming request
**When** rule resolution executes
**Then** the system selects highest priority rule and applies specificity tie-break when needed
**And** the selected rule context is traceable in processing records.

### Story 4.3: Idempotent Duplicate Handling for Ingestion Retries

As an integration owner,
I want ingestion retries to be duplicate-safe,
So that repeated submissions do not create duplicate candidate/application state.

**FRs:** FR-16

**Acceptance Criteria:**

**Given** repeated ingestion requests representing the same intake intent
**When** idempotency checks run
**Then** the first valid request creates the canonical outcome and subsequent duplicates are marked deterministically
**And** duplicate handling is auditable and does not emit duplicate downstream side effects.

## Epic 5: Subscription, Entitlement & Workspace Governance

Enable owners to manage plan lifecycle, payment outcomes, entitlement gates, and collaboration limits consistently by owner context.

### Story 5.1: Owner-Context Plan Eligibility Enforcement

As an owner,
I want plan selection constrained by owner context,
So that USER and WORKSPACE subscriptions follow policy boundaries.

**FRs:** FR-17

**Acceptance Criteria:**

**Given** an owner selecting a subscription plan
**When** the owner context is evaluated
**Then** USER contexts can only select personal tiers and WORKSPACE contexts can only select business tiers
**And** ineligible plan selection is rejected with deterministic policy messages.

### Story 5.2: Checkout Initiation and Pending Transaction Tracking

As an owner,
I want subscription checkout initiation to produce a traceable pending transaction,
So that payment lifecycle can be reconciled reliably.

**FRs:** FR-18

**Acceptance Criteria:**

**Given** an eligible plan selection
**When** checkout is initiated
**Then** the system creates pending transaction/subscription lifecycle records with owner context
**And** transaction state remains auditable until callback-driven settlement updates occur.

### Story 5.3: Verified Callback Settlement and Grace-Window Policy

As an owner,
I want payment callbacks to update subscription state only after verification,
So that entitlement changes are secure and policy-correct.

**FRs:** FR-18

**Acceptance Criteria:**

**Given** callback or settlement-change events from payment provider
**When** signature verification succeeds
**Then** transaction and subscription lifecycle transitions are applied deterministically
**And** verified refund/chargeback outcomes start grace-window handling before entitlement revocation.

### Story 5.4: USER→WORKSPACE Subscription Migration with Proration

As an owner upgrading context,
I want USER subscriptions to migrate to WORKSPACE with prorated credit,
So that plan continuity is preserved during ownership transition.

**FRs:** FR-17

**Acceptance Criteria:**

**Given** an owner upgrades from USER to WORKSPACE context
**When** migration is executed
**Then** subscription state transfers to WORKSPACE and prorated credit is calculated from remaining USER entitlement
**And** migration records are auditable and do not violate eligibility policy.

### Story 5.5: Entitlement, Quota, and Workspace Collaboration Limits

As an owner or workspace member,
I want gated actions to enforce entitlement and collaboration limits,
So that usage and access remain within active plan policy.

**FRs:** FR-19, FR-20

**Acceptance Criteria:**

**Given** a gated feature action under current owner/workspace context
**When** entitlement and quota policy evaluation executes
**Then** the action is deterministically allowed or denied with policy reason
**And** workspace active-member limits and UTC-bound quota/reset windows are enforced consistently.

## Epic 6: Natural-Language Candidate Search & Discovery (Growth)

Provide semantic candidate discovery with ranked relevance to improve retrieval quality and hiring velocity in growth phase.

### Story 6.1: Natural-Language Query Intake and Intent Normalization

As a recruiter,
I want to submit natural-language search queries,
So that I can express hiring intent without rigid filter syntax.

**FRs:** FR-14

**Acceptance Criteria:**

**Given** a recruiter submits a natural-language query
**When** the query is processed by search intake
**Then** intent is normalized into a structured search request model
**And** invalid/empty queries return deterministic validation guidance.

### Story 6.2: Relevance Ranking and Confidence Scoring Pipeline

As a recruiter,
I want candidates ranked by semantic relevance,
So that top matches are prioritized for screening.

**FRs:** FR-14

**Acceptance Criteria:**

**Given** a normalized search request and eligible candidate pool
**When** ranking executes
**Then** results are ordered by relevance with confidence/scoring metadata
**And** ranking output remains traceable for quality tuning and audit review.

### Story 6.3: Top-N Retrieval API with Job-Context Filters

As a recruiter,
I want top-N candidate retrieval with optional job-context filtering,
So that discovery results fit specific requisition needs.

**FRs:** FR-14

**Acceptance Criteria:**

**Given** ranked search results and optional job-context filters
**When** retrieval response is requested
**Then** the API returns top-N candidates with stable response envelope and pagination metadata
**And** filter and pagination behavior is deterministic across repeated requests.

<!-- End story repeat -->
