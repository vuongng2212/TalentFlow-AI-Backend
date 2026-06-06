# Quickstart: Subscription Plans

## Prerequisites

- API Gateway dependencies installed: `cd api-gateway && npm install`
- Database connection configured with `DATABASE_URL` and `DIRECT_URL`
- Existing auth and workspace flows pass before subscription changes are introduced

## Local Setup

1. Generate or apply the subscription Prisma migration.

   ```powershell
   cd api-gateway
   npm run db:migrate
   ```

2. Seed the fixed plan catalog if the migration does not insert it.

   ```powershell
   npm run db:seed
   ```

3. Generate Prisma client after schema changes.

   ```powershell
   npx prisma generate
   ```

## Verification Flow

1. Create a new account.
2. Confirm the account has Free as the effective personal plan.
3. Request personal CV scoring until the Free daily limit of 5 is reached.
4. Activate Plus for the user.
5. Confirm personal quota is now 20 daily and CV fit analysis is available.
6. Create or select a workspace.
7. Activate Business for the workspace.
8. Confirm the purchaser can manage workspace members.
9. Invite an existing account into the workspace.
10. Confirm workspace AI requests consume from the workspace 500-per-day pool.
11. Confirm a Plus user in personal space consumes Plus quota.
12. Confirm the same user in workspace space consumes Business workspace quota.

## Test Commands

```powershell
cd api-gateway
npm test -- subscriptions
npm test -- auth workspaces
npm run test:e2e -- workspaces
npm run build
```

## Out Of Scope For This Feature

- Payment provider integration
- Pricing and checkout pages
- Invoices, taxes, refunds, and dunning
- Subscription lifecycle emails
- CV upload queue contract changes
