# Project Vision & Checklist: TalentFlow AI Expansion

## Epics
- [ ] Epic 1: Foundation & Infrastructure Stabilization
- [ ] Epic 2: Workspace & Membership Management
- [ ] Epic 3: Billing & Payment Integration (Momo)
- [ ] Epic 4: Automation & Ingestion Pipeline
- [ ] Epic 5: Entitlement & Feature Gating

## User Stories

### STORY-001: Workspace Domain Naming & Modeling
- **Priority**: P0 (Must)
- **Story**: As a developer, I want to have a clear definition of Workspace, Organization, and Membership, so that I can build a consistent multi-tenant system.
- **Acceptance Criteria**:
  - [x] AC1: Choose between Workspace and Organization naming.
  - [x] AC2: Define relationship between User, Workspace, and WorkspaceMember.
  - [x] AC3: Update domain glossary.
- **Status**: Completed

### STORY-002: Security Baseline for Expansion
- **Priority**: P0 (Must)
- **Story**: As a security engineer, I want to define auth patterns for external integrations (n8n, Momo), so that the system is protected against unauthorized callbacks.
- **Acceptance Criteria**:
  - [x] AC1: Decide auth method for n8n (API key/signature).
  - [x] AC2: Define Momo callback verification logic.
  - [x] AC3: Define idempotency for payment and ingestion.
- **Status**: Completed

### STORY-003: Workspace Schema Implementation
- **Priority**: P1 (Should)
- **Story**: As a developer, I want to implement the Prisma schema for Workspaces, so that I can store tenant data.
- **Acceptance Criteria**:
  - [x] AC1: Implement Workspace and WorkspaceMember models in Prisma.
  - [x] AC2: Enforce unique constraints on memberships.
  - [ ] AC3: Define internal roles (Owner/Admin/Recruiter).
- **Status**: In-Progress

### STORY-004: Billing & Subscription Plans
- **Priority**: P1 (Should)
- **Story**: As a business owner, I want to have 3 distinct plans (Free, Plus, Business), so that I can monetize the platform.
- **Acceptance Criteria**:
  - [ ] AC1: Seed Free, Plus, and Business plans in the database.
  - [ ] AC2: Define daily limits for CV upload, AI evaluation, and Interview scheduling.
  - [ ] AC3: Implement plan versioning for auditing.
- **Status**: Pending

### STORY-005: Momo Checkout Flow
- **Priority**: P1 (Should)
- **Story**: As a user, I want to pay for a subscription using Momo, so that I can upgrade my plan easily.
- **Acceptance Criteria**:
  - [ ] AC1: Implement checkout session endpoint.
  - [ ] AC2: Map provider references to internal transactions.
  - [ ] AC3: Handle redirect and callback URLs.
- **Status**: Pending

### STORY-006: Automation Ingestion (n8n)
- **Priority**: P2 (Could)
- **Story**: As a recruiter, I want to automatically ingest candidates from emails via n8n, so that I don't have to upload CVs manually.
- **Acceptance Criteria**:
  - [ ] AC1: Design IngestionRule and IngestionEvent schema.
  - [ ] AC2: Implement duplicate prevention strategy.
  - [ ] AC3: Implement fallback for missing Job IDs.
- **Status**: Pending

### STORY-007: Quota & Entitlement Gating
- **Priority**: P0 (Must)
- **Story**: As a system, I want to enforce plan limits (e.g., Plus-first then Business fallback), so that users do not exceed their purchased quotas.
- **Acceptance Criteria**:
  - [ ] AC1: Implement usage tracking for CV uploads and AI evals.
  - [ ] AC2: Implement Plus-first usage logic for Business members.
  - [ ] AC3: Reset counters daily at UTC 00:00.
- **Status**: Pending
