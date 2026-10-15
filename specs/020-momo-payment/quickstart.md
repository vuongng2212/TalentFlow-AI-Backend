# Quickstart: MoMo Payment Module

**Feature**: `020-momo-payment`  
**Audience**: API Gateway developers and deployment operators

## 1. Preconditions

- Use the Gateway's existing PostgreSQL, cookie-based authentication, workspace context, and test setup.
- Obtain **MoMo sandbox** merchant credentials before exercising a real provider call. Do not put production credentials in source control, fixtures, Swagger examples, or logs.
- Provision a private S3/R2-compatible invoice bucket. It must not have a public read URL or public-list policy.
- Choose a product-approved, server-owned payment catalogue. The current subscription Plans are not a price source and must not be used as one without a separate fulfilment feature.

## 2. Local configuration

Set local environment values in the Gateway's untracked `.env`; mirror only names/placeholders in `.env.example`.

```dotenv
# MoMo sandbox — supply real values only through your local secret manager/.env
MOMO_API_BASE_URL=https://test-payment.momo.vn
MOMO_PARTNER_CODE=<sandbox-partner-code>
MOMO_ACCESS_KEY=<sandbox-access-key>
MOMO_SECRET_KEY=<sandbox-secret-key>
MOMO_IPN_URL=https://<public-test-host>/api/v1/payments/momo/ipn
MOMO_REDIRECT_URL=http://localhost:3001/payment/return
MOMO_REQUEST_TIMEOUT_MS=30000

# Product-owned, server-side quotation catalogue. This example is deliberately fictitious.
PAYMENT_CATALOG_JSON=[{"code":"DEMO_SERVICE","description":"Demo service","amountVnd":10000,"taxVnd":0,"termsVersion":"2026-09-demo","enabled":true}]

# Retry and receipt policy
PAYMENT_RECOVERY_INTERVAL_SECONDS=30
PAYMENT_RECOVERY_LEASE_SECONDS=60
PAYMENT_RECOVERY_MAX_ATTEMPTS=10
PAYMENT_INVOICE_BUCKET=talentflow-payment-invoices-dev
PAYMENT_INVOICE_URL_TTL_SEC=300
PAYMENT_RECEIPT_ISSUER_NAME=TalentFlow AI (development)
PAYMENT_RECEIPT_ISSUER_ADDRESS=Development environment
```

The catalogue contains only approved, integer VND values. The API accepts its `code`, never its amount/tax/description. Every generated Payment copies the complete quote, so future configuration changes cannot alter a historical receipt.

## 3. Database and service start

From the Gateway service directory, generate the Prisma client, apply the payment migration in development, and start the API. Use the repository's normal migration workflow; never apply an unreviewed migration to production.

```powershell
Set-Location D:\Project\TalentFlow-AI\TalentFlow-AI-Backend\api-gateway
npm exec prisma generate
npm run db:migrate
npm run start:dev
```

For production, run the reviewed migration deployment command through the normal release pipeline. The payment migration has no historical payment backfill.

## 4. Initiate a checkout

Authenticate through the normal Gateway login flow so the browser holds the existing access-token cookie. Supply an active workspace context and a new opaque idempotency key.

```http
POST /api/v1/payments
Cookie: access_token=<existing session cookie>
x-workspace-id: <workspace-id>
Idempotency-Key: 8e12c4b4-0b88-4db8-9b29-13e8acb5f59a
Content-Type: application/json

{
  "payableItemCode": "DEMO_SERVICE"
}
```

Expected result:

- `201` when the stored payment has a ready `payUrl`.
- `202` when the payment was persisted but MoMo checkout creation is uncertain or still running; retry the **same** request with the same key to retrieve/resume the same payment.
- `409` when that key is reused for a materially different trusted payment intent.

The frontend may navigate to the returned `payUrl`. A redirect to `MOMO_REDIRECT_URL` is display-only: it must read the payment status from the authenticated API and must not mark a user paid.

## 5. IPN test and replay test

Expose the local IPN route through an approved HTTPS tunnel only for sandbox testing. Configure that exact public URL as `MOMO_IPN_URL`. MoMo sends a JSON `POST` after payment; the Gateway validates its documented HMAC, matches it to the stored payment, persists a safe result receipt, and returns 204 within 15 seconds.

Verify all of these in sandbox:

1. A valid successful IPN changes only the matching pending Payment to `SUCCEEDED`.
2. Re-sending the exact IPN does not create another outcome, invoice, or receipt PDF.
3. A modified amount, order, or signature is rejected and creates no success effect.
4. A later failure after success is stored as conflict evidence; the successful state is unchanged.
5. A failed invoice render remains retryable and never turns the Payment back to failed.

## 6. Retrieve a receipt

An active member of the owning workspace can retrieve the payment and receipt summary. Receipt detail is available after success processing; a download route returns a short-lived signed object URL only when the PDF is available. Owners and administrators additionally trigger safe reconciliation of an uncertain payment.

```http
GET /api/v1/payments/<payment-reference>/invoice
Cookie: access_token=<existing session cookie>
x-workspace-id: <workspace-id>

GET /api/v1/payments/<payment-reference>/invoice/download
Cookie: access_token=<existing session cookie>
x-workspace-id: <workspace-id>
```

Never paste a signed URL into a ticket, log, or public webpage. It is access-controlled but still a bearer capability until expiration.

## 7. Required test sequence

Before implementation, create the focused failing tests described in `plan.md`. During development run:

```powershell
Set-Location D:\Project\TalentFlow-AI\TalentFlow-AI-Backend\api-gateway
npm test -- payments
npm run test:e2e -- payments.e2e-spec.ts
npm run lint
npm run build
```

Run the complete repository test commands before release. Do not call production MoMo until sandbox tests, migration review, configuration validation, private-bucket access checks, and alerting are complete.

## 8. Operations and retention

- Alert on rejected IPN verification, payments left in `PENDING` beyond the recovery window, `MANUAL_REVIEW` work records, and retryable receipt renders. MoMo must not be a readiness dependency for the Gateway.
- Keep financial payments, idempotency digests, provider-result summaries, outcomes, invoices, and audit events longer than MoMo's minimum 31-day idempotency window, according to the approved financial-record retention policy.
- Operational logs and metrics use only safe references and reason codes. Never log an idempotency key, MoMo access/secret key, raw signature, checkout URL, signed download URL, or full provider payload.
