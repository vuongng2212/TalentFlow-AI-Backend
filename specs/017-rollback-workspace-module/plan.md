# Implementation Plan: Rollback Workspace Module

**Branch**: `017-rollback-workspace-module` | **Date**: 2026-06-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/017-rollback-workspace-module/spec.md`

## Summary

Rollback the active workspace management module from the API Gateway so the current release behaves as though workspace lifecycle management was never created. The smallest safe implementation path is an API Gateway-only cleanup: remove `api-gateway/src/workspaces/` from runtime wiring, remove workspace routes from generated OpenAPI docs, remove workspace-specific config/test surfaces, and clean Prisma workspace management schema state with a migration. Subscription billing from spec 016 remains active and must keep using the configurable mock `businessWorkspaceId` string for Business subscription records only.

This is HTTP, Prisma, test, and generated-contract cleanup in `D:\Project\TalentFlow-AI\TalentFlow-AI-Backend\api-gateway\`. It is not queue, storage, CV Parser, or Notification work, and it must preserve the existing CV upload queue rule that events use `bucket` plus `fileKey`.

## Technical Context

**Primary Runtime**: api-gateway  
**Language/Version**: TypeScript 5.7.x on Node/NestJS, Prisma 6.7  
**Primary Dependencies**: NestJS 11, Prisma 6.7, class-validator, Swagger, Jest, existing JWT/auth guards, existing subscription billing module  
**Storage**: PostgreSQL via Prisma; remove active workspace management tables/relations where they are not needed by billing-only subscription state  
**Testing**: `cd api-gateway && npm test -- workspaces subscriptions`, `cd api-gateway && npm run test:e2e -- subscriptions`, targeted removed-route e2e coverage, `npx prisma generate`, `npm run build`  
**Target Platform**: Local development and Linux containers  
**Project Type**: Polyglot backend services, single-service API Gateway change  
**Performance Goals**: Removed workspace paths fail at routing/auth boundary without invoking workspace state mutation; subscription plan/status/checkout/confirmation behavior remains within existing gateway request path.  
**Constraints**: Remove workspace APIs from the active API surface; fail closed for known workspace paths; keep Business subscription activation billing-only; keep mock Business workspace id as a string, not a foreign key; do not modify CV Parser, Notification, queue, or storage contracts.  
**Scale/Scope**: One API Gateway module removal, Prisma schema and migration cleanup, seed/config cleanup, OpenAPI regeneration, focused unit/e2e regression tests, and active Spec Kit docs for feature 017.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- Runtime code, Prisma schema, generated OpenAPI, and current Spec Kit artifacts are authoritative.
- Frozen legacy sources in `_bmad-output/`, `tmp-document/`, and `archive/` remain reference-only and are not active requirements.
- Service boundaries remain explicit: API Gateway owns rollback; CV Parser and Notification do not change.
- Cross-service queue/storage contracts are preserved; no producer/consumer queue change is planned.
- Gateway schema changes require `api-gateway/prisma/schema.prisma` and a migration update together.
- Validation, logging, and failure behavior remain boundary-focused: leftover workspace route calls must not mutate workspace data, and subscription billing failures continue to fail closed.

**Gate status**: PASS. The plan is localized to API Gateway and preserves spec 016 billing behavior. The only justified schema change is removing workspace management persistence that conflicts with the active release surface.

## Project Structure

### Documentation (this feature)

```text
specs/017-rollback-workspace-module/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- rollback-workspace.openapi.yaml
`-- checklists/
    `-- requirements.md
```

### Source Code (repository root)

```text
api-gateway/
|-- src/
|   |-- app.module.ts
|   |-- common/config/
|   |-- subscriptions/
|   |-- prisma/
|   `-- workspaces/              # remove from active runtime in this rollback
|-- prisma/
|   |-- schema.prisma
|   |-- migrations/
|   `-- seed.ts
|-- test/
|   |-- subscriptions.e2e-spec.ts
|   `-- workspaces.e2e-spec.ts   # replace/remove active workspace behavior expectations
|-- swagger-spec.json
`-- package.json

docs/openapi/
`-- api-gateway.openapi.json
```

**Structure Decision**: API Gateway owns the rollback because workspace management is an HTTP and Prisma surface under `api-gateway/`. `cv-parser/` and `notification/` remain out of scope. Generated API docs under `docs/openapi/` must be refreshed because active runtime contracts are part of the source of truth.

### Ownership Check

- Remove workspace HTTP behavior from `api-gateway/src/app.module.ts` and `api-gateway/src/workspaces/`.
- Clean workspace management schema from `api-gateway/prisma/schema.prisma` and add a migration under `api-gateway/prisma/migrations/`.
- Remove workspace seed/config expectations from `api-gateway/prisma/seed.ts`, `api-gateway/src/common/config/`, and related tests.
- Preserve subscription billing in `api-gateway/src/subscriptions/`; Business activation may store only `SUBSCRIPTION_BUSINESS_WORKSPACE_ID`.
- Update generated contracts in `api-gateway/swagger-spec.json` and `docs/openapi/api-gateway.openapi.json` so no workspace management operation remains.

## Delivery Phases

### Phase 0: Discovery And Contract Check

- Confirm currently exposed workspace routes: `POST /api/v1/workspaces`, `POST /api/v1/workspaces/:id/members`, and `GET /api/v1/workspaces/:id/members`.
- Confirm runtime wiring imports `WorkspacesModule` in `api-gateway/src/app.module.ts`.
- Confirm OpenAPI docs still expose `WorkspacesController_*`, `CreateWorkspaceDto`, `AddWorkspaceMemberDto`, and `WorkspaceMemberRole`.
- Confirm Prisma workspace management state: `Workspace`, `WorkspaceMember`, `WorkspaceMemberRole`, `WorkspaceMemberStatus`, `User.workspaceMembers`, `User.invitedWorkspaceMembers`, and `AiUsageRecord.workspaceId`/`workspace`.
- Confirm subscription billing already uses `UserSubscription.businessWorkspaceId` as a nullable string and does not require a real `Workspace` record.
- Confirm no CV Parser, Notification, RabbitMQ, MinIO, or CV upload contract work is needed.

### Phase 1: Design And Data Shape

- Treat workspace management as removed from the active API contract; do not replace it with "unsupported" controller actions.
- Remove the runtime module import and delete or quarantine the `api-gateway/src/workspaces/` implementation from active compilation.
- Remove workspace management persistence models and relations from Prisma, with a migration that drops `workspace_members` before `workspaces` and removes dependent foreign keys/indexes.
- Remove or reshape `AiUsageRecord.workspaceId` and `AiUsageContextType.WORKSPACE` from the active release unless another active billing-only requirement proves it is needed; personal subscription usage remains available.
- Keep `UserSubscription.businessWorkspaceId` as a string placeholder for Business subscription activation and explicitly avoid any foreign key to `Workspace`.
- Remove workspace management config such as `WORKSPACE_MAX_ACTIVE_MEMBERS` from required active configuration.
- Remove workspace management seed behavior and feature-completeness claims; keep Free, Plus, Business plan seed behavior from spec 016.
- Define a regression contract: known workspace paths route to the normal missing-route behavior and no workspace tables/services are invoked.

### Phase 2: Implementation By Service

- API Gateway: remove `WorkspacesModule` import and module entry from `api-gateway/src/app.module.ts`.
- API Gateway: delete or exclude `api-gateway/src/workspaces/` controller/service/DTO/spec files from active runtime and tests.
- API Gateway Prisma: update `api-gateway/prisma/schema.prisma` to remove workspace management models, relations, enums, and unused config-dependent fields.
- API Gateway Prisma: add a migration that safely drops workspace management tables/constraints and any workspace-specific AI usage relation/column if removed from schema.
- API Gateway seed/config: remove `WORKSPACE_MAX_ACTIVE_MEMBERS` validation/defaults and workspace management seed expectations; preserve `SUBSCRIPTION_BUSINESS_WORKSPACE_ID`.
- API Gateway tests: remove workspace success-path tests and add rollback tests asserting known workspace paths are absent and do not mutate state.
- API Gateway subscription tests: keep spec 016 tests proving plan listing, checkout, internal confirmation, idempotency, and Business mock workspace id activation still pass.
- API Gateway contracts: regenerate `api-gateway/swagger-spec.json` and `docs/openapi/api-gateway.openapi.json`; verify zero workspace management operations and schemas remain.

### Phase 3: Verification And Hardening

- Run focused workspace rollback route tests first to prove removed paths do not mutate state.
- Run subscription unit and e2e tests to prove spec 016 behavior remains passable.
- Run Prisma generation after schema cleanup.
- Run gateway build to catch stale imports from removed workspace DTOs, enums, or Prisma relations.
- Scan generated OpenAPI output for `WorkspacesController`, `/workspaces`, `CreateWorkspaceDto`, `AddWorkspaceMemberDto`, and workspace-management descriptions.
- Confirm CV upload queue references still use `bucket` plus `fileKey` if any touched code references upload events.

## Validation Commands

- Workspace rollback scan: `rg -n "WorkspacesController|/workspaces|CreateWorkspaceDto|AddWorkspaceMemberDto|WORKSPACE_MAX_ACTIVE_MEMBERS" api-gateway/src api-gateway/test api-gateway/prisma docs/openapi`
- Subscription unit tests: `cd api-gateway && npm test -- subscriptions`
- Removed-route / subscription e2e tests: `cd api-gateway && npm run test:e2e -- subscriptions`
- Prisma client generation: `cd api-gateway && npx prisma generate`
- Swagger generation: `cd api-gateway && npm run swagger:generate`
- Gateway build: `cd api-gateway && npm run build`
- Gateway lint: `cd api-gateway && npm run lint`

## Local Verification Strategy

- Assert known workspace paths are absent from generated OpenAPI and return the framework's missing-route response at runtime.
- Assert removed workspace requests do not create or update workspace, membership, role, invitation, subscription, or AI usage state.
- Assert Business subscription activation stores only the configured mock `businessWorkspaceId` and performs no workspace lifecycle action.
- Assert Free, Plus, and Business subscription billing endpoints remain available according to spec 016.
- Use source scans as a hard guard before finishing: no active controller, DTO, config, test, OpenAPI, or seed reference may describe workspace management as supported.

## Post-Design Constitution Check

- Runtime truth remains primary: plan aligns with current `app.module.ts`, Prisma schema, and generated OpenAPI findings.
- Active docs only: new artifacts live under `specs/017-rollback-workspace-module/`.
- Service boundary remains API Gateway-only; no CV Parser or Notification changes.
- Edge validation is explicit: removed routes fail closed and subscription confirmation remains trusted/internal.
- Contract testing is planned at the narrow boundary: route absence, OpenAPI absence, schema cleanup, and subscription regression.
- Operational safety is preserved: no silent workspace mutation and Business mock id remains auditable subscription data.

**Gate status**: PASS. No constitution violation remains unresolved.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| Breaking API removal | Spec 017 requires workspace management APIs to be removed from the active surface. | Returning 403/501 from existing workspace controllers would leave workspace APIs in the active contract. |
| Schema cleanup migration | "As though workspace module had not been created" requires removing active workspace management persistence and Prisma relations. | Leaving tables/models active lets future runtime code and generated clients keep depending on removed workspace behavior. |
