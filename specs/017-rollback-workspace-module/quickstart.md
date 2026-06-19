# Quickstart: Rollback Workspace Module

## Prerequisites

- Work on branch `017-rollback-workspace-module`.
- Keep implementation changes inside `api-gateway/`, `docs/openapi/`, and `specs/017-rollback-workspace-module/`.
- Do not change CV Parser, Notification, RabbitMQ, MinIO, or CV upload queue contracts.
- Preserve spec 016 subscription billing behavior and `SUBSCRIPTION_BUSINESS_WORKSPACE_ID`.

## Implementation Order

1. Remove `WorkspacesModule` import and module registration from `api-gateway/src/app.module.ts`.
2. Remove active workspace controller/service/DTO/spec files from `api-gateway/src/workspaces/` or exclude the module from compilation if the repo chooses a staged delete.
3. Update `api-gateway/prisma/schema.prisma` to remove active workspace management models, relations, enums, and workspace-only AI usage relation/fields.
4. Add a Prisma migration that drops workspace membership state before workspace identity state and cleans dependent constraints/indexes.
5. Remove `WORKSPACE_MAX_ACTIVE_MEMBERS` and workspace management seed expectations while keeping subscription billing config and seed data.
6. Replace `api-gateway/test/workspaces.e2e-spec.ts` success-path tests with rollback tests, or remove the workspace e2e file and add removed-route assertions to the gateway e2e suite.
7. Keep subscription billing tests proving plan listing, checkout, internal confirmation, duplicate confirmation idempotency, and Business mock workspace id assignment.
8. Regenerate `api-gateway/swagger-spec.json` and `docs/openapi/api-gateway.openapi.json`.
9. Scan runtime, tests, Prisma, and OpenAPI for stale workspace management references.

## Schema And Contract Refresh Notes

- Apply `api-gateway/prisma/migrations/20260619000000_rollback_workspace_module/migration.sql` after spec 016 billing migrations.
- Run `npx prisma format --schema prisma/schema.prisma` and `npx prisma generate` from `api-gateway/` after schema cleanup.
- The rollback migration deletes workspace-scoped AI usage rows before removing `workspace_id`, then drops workspace membership state before workspace identity state.
- On Windows, run Swagger generation with PowerShell env vars if the package script's POSIX env syntax is unavailable:

```powershell
cd api-gateway
$env:GENERATE_SWAGGER='true'; $env:EXIT_AFTER_GENERATE='true'; npx ts-node src/main.ts
Copy-Item -LiteralPath swagger-spec.json -Destination ..\docs\openapi\api-gateway.openapi.json
```

## Verification

Run from repository root:

```powershell
rg -n "WorkspacesController|/workspaces|CreateWorkspaceDto|AddWorkspaceMemberDto|WORKSPACE_MAX_ACTIVE_MEMBERS" api-gateway/src api-gateway/test api-gateway/prisma docs/openapi
cd api-gateway
npm test -- subscriptions
npm run test:e2e -- subscriptions
npm run test:e2e -- workspaces subscriptions
npx prisma generate
npm run swagger:generate
npm run build
npm run lint
```

## Expected Results

- No workspace creation, member invitation/addition, member listing, role assignment, or workspace administration operation appears in generated OpenAPI.
- Known workspace paths are not handled by an active workspace API and do not mutate state.
- Prisma client no longer exposes active workspace management models after generation.
- Migration application removes `workspaces`, `workspace_members`, workspace AI usage relation state, and `can_activate_workspace`.
- Business subscription activation still stores only the configured mock `businessWorkspaceId`.
- Plus subscription activation does not store a Business workspace id.
- Subscription billing does not create workspaces, workspace members, roles, invitations, queue events, parser work, or notification delivery.
