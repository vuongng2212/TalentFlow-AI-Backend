# Implementation Plan: Workspace Multi-Tenancy

**Branch**: `016-workspace-multi-tenancy` | **Date**: 2026-06-07 | **Spec**: [specs/016-workspace-multi-tenancy/spec.md](specs/016-workspace-multi-tenancy/spec.md)
**Input**: Feature specification from `specs/016-workspace-multi-tenancy/spec.md`

## Summary

This feature transforms TalentFlow AI into a multi-tenant B2B SaaS Applicant Tracking System (ATS). We will refactor the codebase to make the `Workspace` (Tenant) the primary security and data isolation boundary instead of the user-centric `createdById` filter. 
The implementation resides primarily in `api-gateway/` (Prisma schema, context resolution guard, active workspace switching, secure member invitations, and workspace-scoped RBAC), and hooks into the `notification/` service via a RabbitMQ invitation event to deliver invitation emails.

## Technical Context

**Primary Runtime**: api-gateway (NestJS), notification (NestJS/C# worker)
**Language/Version**: TypeScript 5.x / Node.js 20.x
**Primary Dependencies**: NestJS 11, Prisma 6, RabbitMQ, Redis, nestjs-cls, Swagger
**Storage**: PostgreSQL
**Testing**: npm test, npm run test:e2e
**Target Platform**: Linux containers / local dev
**Project Type**: Polyglot backend services
**Performance Goals**: Context resolution overhead under 5ms per HTTP request; 0% cross-tenant data leaks.
**Constraints**: Keep database transaction boundaries atomic during user signup and invitation acceptance.
**Scale/Scope**: Impacts 5 core recruiter services (Jobs, Candidates, Applications, Interviews, EmailTemplate), 1 custom database migration script, and 1 RabbitMQ event broker contract.

## Constitution Check

_GATE: Passed. Complies with all tenets._

- Runtime code and current Spec Kit artifacts are authoritative.
- Service boundaries remain explicitly decoupled. API Gateway is the data owner and HTTP surface; Notification is the consumer and email deliverer.
- Schema changes in the gateway update `prisma/schema.prisma` and the migration path together.
- Context resolution and workspace-scoped RBAC validate at the HTTP request edge.
- No `any` types used for contracts or request signatures.

## Project Structure

### Documentation (this feature)

```text
specs/016-workspace-multi-tenancy/
├── plan.md
├── research.md (to be generated in Phase 0)
├── data-model.md (to be generated in Phase 1)
├── quickstart.md (to be generated in Phase 1)
├── contracts/ (to be generated in Phase 1)
└── tasks.md (to be generated in next steps)
```

### Source Code (repository root)

```text
api-gateway/
├── src/
│   ├── auth/
│   │   ├── guards/
│   │   │   ├── workspace-context.guard.ts (new)
│   │   │   └── workspace-roles.guard.ts (new)
│   │   └── strategies/
│   │       └── jwt.strategy.ts (modified)
│   ├── users/
│   │   ├── users.service.ts (modified)
│   │   └── users.controller.ts (modified)
│   ├── workspaces/
│   │   ├── workspaces.service.ts (modified)
│   │   └── workspaces.controller.ts (modified)
│   ├── jobs/
│   │   └── jobs.service.ts (modified)
│   ├── candidates/
│   │   └── candidates.service.ts (modified)
│   ├── applications/
│   │   └── applications.service.ts (modified)
│   ├── interviews/
│   │   └── interviews.service.ts (modified)
│   └── email-templates/ (new)
├── prisma/
│   ├── schema.prisma (modified)
│   └── migrations/ (custom SQL migration script)
```

**Structure Decision**: API Gateway (`api-gateway/`) owns the data, context resolution, and REST surface. The Notification service (`notification/`) consumes the RabbitMQ event and triggers the workspace invitation email.

### Ownership Check

- API Gateway owns the database schemas, API controllers, service filtering logic, and publishing of the invitation event.
- Notification service owns the consumption of the `workspace.member.invited` event and sending the template email.

## Delivery Phases

### Phase 0: Discovery And Contract Check
- Confirm RabbitMQ connectivity and exchange configuration.
- Audit current Jobs, Candidates, and Applications services to extract existing `createdById` dependencies.
- Research candidate uniqueness constraints.

### Phase 1: Design And Data Shape
- Capture the updated database schemas in `data-model.md`.
- Document public API and RabbitMQ schema contracts in `/contracts/`.
- Validate the configuration and custom verification scripts in `quickstart.md`.

### Phase 2: Implementation By Service
- Update Prisma Schema, generate client, and write the SQL migration script.
- Build the `WorkspaceContextGuard` and integrate with `nestjs-cls` context.
- Build the `WorkspaceRolesGuard` and `@WorkspaceRoles()` decorator.
- Update `AuthService.signup` and `UsersService.create` to atomically provision a default Personal Workspace.
- Create Workspace invitation endpoints (`/invitations`, `/invitations/accept`) and publish event.
- Add consumer handling for `workspace.member.invited` in the Notification service.
- Refactor Jobs, Candidates, Applications, Interviews, and EmailTemplate services to query by workspace ID.

### Phase 3: Verification And Hardening
- Run local unit tests in the gateway and notification service.
- Write E2E test suites covering multi-tenant isolation, context switching, and secure invitations.
- Run linting and production build steps.

## Validation Commands

- API Gateway: `cd api-gateway && npm run lint && npm test && npm run test:e2e && npm run build`
- Notification: `cd notification && npm run lint && npm test`

## Local Verification Strategy

- Run unit tests for individual guards and services in isolation.
- Use PostgreSQL test database to apply the custom schema migration and check that existing data is assigned to default Personal Workspaces correctly.
- Perform end-to-end HTTP requests with and without `x-workspace-id` header to verify context fallback and RBAC.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------- |
| Schema migration | Introduce database-level multi-tenancy | Storing workspace contexts purely in-memory or JWT violates database-level isolation requirements. |
| Candidate unique key modification | Allow recruiters in separate workspaces to import the same candidate | Keeping candidate email globally unique would prevent Workspace A from inviting a candidate already stored in Workspace B. |
