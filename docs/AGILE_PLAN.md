# Agile Project Plan: TalentFlow AI (SaaS B2B Expansion)

## Team & Responsibilities
- **Leader (Libero)**: Full-stack Frontend, Core Backend, DevOps, Code Review.
- **Baobei (Core Java Dev)**: Responsible for `cv-parser` service (Maintenance & Optimization).
- **BaoD (Backend Dev)**: Responsible for SaaS B2B Expansion (Workspaces, Billing, Subscriptions).
- **KietDM (Backend Dev)**: Responsible for `notification` service and `n8n` integration.

## Definition of Done (DoD)
- [ ] Code follows project standards (NestJS, Prisma, Spring Boot conventions)
- [ ] 80%+ Unit Test coverage for new logic
- [ ] No security vulnerabilities (XXE, ZIP-slip, Prompt Injection, Signature verification)
- [ ] Documentation updated (Swagger, README, CLAUDE.md)
- [ ] E2E flow verified (from Ingestion/Upload to Scoring & Notification)

## Current Progress Snapshot
- **Notification Service (KietDM)**: Phase 3 Completed.
- **CV Parser Service (Baobei)**: Phase 3 Completed.
- **Workspaces Module (BaoD)**: Initial Implementation Completed (Validated).
- **API Gateway**: Business Core Completed.

---

## Sprint 1 (Current)
*Focus: Foundation for Real-time, Billing & Optimization.*

- [ ] **US-001**: [Socket.IO Handshake & Authentication](https://github.com/vuongng2212/TalentFlow-AI-Backend/issues/50)
- [ ] **US-003**: [Subscription & Plan Schema](https://github.com/vuongng2212/TalentFlow-AI-Backend/issues/51)
- [ ] **US-007**: [CV Parser Performance Tuning](https://github.com/vuongng2212/TalentFlow-AI-Backend/issues/52)
- [ ] **US-002**: [Real-time Notification Push](https://github.com/vuongng2212/TalentFlow-AI-Backend/issues/53)
- [ ] **US-005**: [Workspace Refactor (Connect to Billing)](https://github.com/vuongng2212/TalentFlow-AI-Backend/issues/54)

---

## Product Backlog

### Epic 1: Real-time & Handshake (KietDM)
- [x] **US-001**: Socket.IO Handshake & Authentication (#50)
- [x] **US-002**: Real-time Notification Push (#53)

### Epic 2: SaaS Expansion & Billing (BaoD)
- [x] **US-003**: Subscription & Plan Schema (#51)
- [ ] **US-004**: Momo Payment Integration
  - **As a** User **I want to** pay via Momo **so that** I can upgrade my plan.
  - **Priority**: High | **Points**: 8
- [x] **US-005**: Workspace Refactor (Connect to Billing) (#54)

### Epic 3: Automation & n8n (KietDM - *After Socket.IO*)
- [ ] **US-006**: n8n Ingestion Flow
  - **As a** Recruiter **I want to** ingest CVs from Gmail via n8n **so that** my pipeline is automated.
  - **Priority**: Medium | **Points**: 5

### Epic 4: Maintenance & Optimization (Baobei)
- [x] **US-007**: CV Parser Performance Tuning (#52)

---

## Technical Roadmap (Team View)
1. **Immediate Focus**: KietDM (Socket.IO) & BaoD (Billing Schema).
2. **Next Step**: KietDM moves to n8n; BaoD completes Momo Integration.
3. **Integration Phase**: Connect Workspace + Billing + Entitlement Gating.
4. **Final Phase**: End-to-end Testing and Deployment.
