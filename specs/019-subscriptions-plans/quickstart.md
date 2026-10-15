# Quickstart: Subscriptions and Plan Entitlements

## Prerequisites

- Run commands from the repository's `api-gateway/` directory.
- Have the local PostgreSQL service available through the repository Docker Compose configuration.
- Set the existing Gateway environment values, including database URLs and `SEED_DEFAULT_PASSWORD` if using the development seed.

## Apply Schema and Data Migration

```powershell
cd api-gateway
npm run db:migrate:deploy
npx prisma generate
```

The migration must create the fixed Plan catalogue and backfill a single current Subscription for every existing Workspace. Do not use `db:seed` as a substitute for migrating an existing environment.

To reset local sample data only where that is already an accepted development workflow:

```powershell
$env:SEED_DEFAULT_PASSWORD = 'local-development-only-password'
npm run db:seed
```

The seed should leave the canonical three plans intact and create one subscription for every seeded workspace.

## Run Focused Tests First

```powershell
npm test -- subscriptions
npm test -- workspace-core
npm test -- users
npm test -- auth
npm run test:e2e -- subscriptions
```

Then run the Gateway quality suite:

```powershell
npm test
npm run test:e2e
npm run lint
npm run build
```

`npm run lint` has autofix enabled; review the working tree afterwards.

## Manual HTTP Verification

Use an authenticated session/token. The existing gateway supports its normal authentication method; substitute the corresponding header/cookie below.

1. Read the catalogue:

```http
GET /api/v1/subscriptions/plans
Authorization: Bearer <token>
```

Expect exactly Free, Plus, Business in display order 1–3.

2. Read the subscription for the active workspace:

```http
GET /api/v1/subscriptions/current
Authorization: Bearer <token>
x-workspace-id: <workspace-id>
```

Expect an ACTIVE Free subscription for a newly created workspace and `isBusiness: false`.

3. As that workspace's owner/admin, select Business:

```http
PUT /api/v1/subscriptions/current
Authorization: Bearer <token>
x-workspace-id: <workspace-id>
Content-Type: application/json

{ "planCode": "BUSINESS" }
```

Expect the selected Business plan and `isBusiness: true`. Repeat with `PLUS` and `FREE`; expect `isBusiness: false`.

4. Verify safeguards:

   - Repeat the same plan selection; exactly one subscription remains.
   - Try selection as a recruiter/viewer or with another workspace header; expect 403 and no state change.
   - Try an inactive/unknown plan; expect the documented error and no state change.
   - Submit `isBusiness` to workspace create/update; expect 400.
   - After upgrade/downgrade, run the existing member/invitation flow to prove its Business gate tracks the synchronized projection.

## Migration Acceptance Query

Use a read-only database client against local development data to verify the invariant:

```sql
SELECT
  w.id,
  w.is_business,
  COUNT(s.id) AS subscription_count,
  p.code,
  p.enables_business
FROM workspaces w
LEFT JOIN subscriptions s ON s.workspace_id = w.id
LEFT JOIN plans p ON p.id = s.plan_id
GROUP BY w.id, w.is_business, p.code, p.enables_business
ORDER BY w.id;
```

Every row must have `subscription_count = 1`; `is_business` must equal `enables_business`; migrated Business workspaces must have `BUSINESS`, and all other migrated workspaces must have `FREE`.
