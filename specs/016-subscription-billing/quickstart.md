# Quickstart: Subscription Billing

## Prerequisites

- Work on branch `016-subscription-billing`.
- Keep changes inside `api-gateway/` and `specs/016-subscription-billing/`.
- Do not implement workspace creation, invitations, role assignment, membership mutation, workspace quotas, CV Parser changes, or Notification changes.

## Configuration

Add validated API Gateway config for MoMo Billing:

- `MOMO_PARTNER_CODE`
- `MOMO_ACCESS_KEY`
- `MOMO_SECRET_KEY`
- `MOMO_PUBLIC_KEY` if the selected MoMo flow requires RSA encryption
- `MOMO_ENDPOINT_BASE_URL`
- `MOMO_REDIRECT_URL`
- `MOMO_IPN_URL`
- `MOMO_LANGUAGE`
- `SUBSCRIPTION_BUSINESS_WORKSPACE_ID`

Development and production both use MoMo. The environment may point to different MoMo credentials or endpoint base URLs, but the provider must remain `MOMO`.

## Implementation Order

1. Update Prisma schema and migration for payment transactions, confirmation audit, plan pricing, and optional `UserSubscription.businessWorkspaceId`.
2. Remove active subscription routes and service behavior that operate under `/workspaces/:workspaceId/...`.
3. Remove subscription service mutations of `Workspace.isBusiness`, `WorkspaceMember` roles, workspace membership checks, workspace quota checks, and workspace entitlement paths.
4. Add the MoMo billing adapter under `api-gateway/src/subscriptions/billing/`, based on MoMo's official NodeJS integration sample/library.
5. Add checkout endpoint for paid plans and keep Free as non-checkout.
6. Add MoMo/IPN ingestion or provider-result verification and internal confirmation flow.
7. Activate Plus or Business only after confirmed successful payment; assign the mock Business workspace id only for Business.
8. Update tests and OpenAPI output.

## Verification

Run from repository root:

```powershell
cd api-gateway
npm test -- subscriptions
npm run test:e2e -- subscriptions
npx prisma generate
npm run build
npm run lint
```

## Expected Results

- Plus and Business checkout create pending MoMo payment transactions.
- Paid subscriptions remain inactive until trusted confirmation passes.
- Duplicate successful confirmations return one active subscription period.
- Business subscriptions store `SUBSCRIPTION_BUSINESS_WORKSPACE_ID`.
- No workspace record, workspace member, role, invitation, quota, queue event, CV parser flow, or notification delivery changes during subscription billing.
