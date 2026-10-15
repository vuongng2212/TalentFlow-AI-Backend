-- =============================================================
-- MoMo payment module
-- Financial records are append-only where possible. There is no historical
-- subscription/payment backfill and no entitlement mutation in this migration.
-- =============================================================

BEGIN;

CREATE TYPE "PaymentProvider" AS ENUM ('MOMO');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED', 'REJECTED');
CREATE TYPE "PaymentCheckoutStatus" AS ENUM ('NOT_REQUESTED', 'REQUESTING', 'READY', 'UNKNOWN', 'UNAVAILABLE');
CREATE TYPE "PaymentIdempotencyOperation" AS ENUM ('INITIATE_MOMO_CHECKOUT');
CREATE TYPE "PaymentResultDisposition" AS ENUM ('VERIFIED', 'REJECTED', 'DUPLICATE', 'CONFLICT_IGNORED');
CREATE TYPE "PaymentWorkKind" AS ENUM ('CREATE_CHECKOUT', 'RECONCILE_MOMO', 'APPLY_SUCCESS', 'APPLY_FAILURE', 'ISSUE_INVOICE', 'RENDER_INVOICE');
CREATE TYPE "PaymentWorkStatus" AS ENUM ('PENDING', 'LEASED', 'COMPLETED', 'RETRYABLE', 'MANUAL_REVIEW');
CREATE TYPE "PaymentOutcomeType" AS ENUM ('PAYMENT_CONFIRMED', 'PAYMENT_UNSUCCESSFUL');
CREATE TYPE "InvoiceDocumentStatus" AS ENUM ('PENDING_RENDER', 'AVAILABLE', 'RETRYABLE');
CREATE TYPE "PaymentAuditAction" AS ENUM (
  'PAYMENT_CREATED', 'IDEMPOTENCY_REPLAYED', 'CHECKOUT_READY', 'CHECKOUT_UNKNOWN',
  'PROVIDER_RESULT_VERIFIED', 'PROVIDER_RESULT_REJECTED', 'PROVIDER_RESULT_DUPLICATE',
  'PROVIDER_RESULT_CONFLICT', 'STATE_CHANGED', 'WORK_RETRIED', 'OUTCOME_RECORDED',
  'INVOICE_ISSUED', 'INVOICE_RENDERED', 'INVOICE_RENDER_FAILED', 'RECONCILIATION_COMPLETED'
);
CREATE TYPE "PaymentAuditActorKind" AS ENUM ('USER', 'MOMO', 'SCHEDULER', 'SYSTEM');

CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "requester_id" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'MOMO',
  "momo_order_id" TEXT NOT NULL,
  "momo_request_id" TEXT NOT NULL,
  "amount_vnd" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "charge_snapshot" JSONB NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "checkout_status" "PaymentCheckoutStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  "checkout_url" TEXT,
  "momo_transaction_id" BIGINT,
  "provider_result_code" INTEGER,
  "expires_at" TIMESTAMP(3),
  "succeeded_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_reference_key" UNIQUE ("reference"),
  CONSTRAINT "payments_momo_order_id_key" UNIQUE ("momo_order_id"),
  CONSTRAINT "payments_momo_request_id_key" UNIQUE ("momo_request_id"),
  CONSTRAINT "payments_amount_vnd_check" CHECK ("amount_vnd" BETWEEN 1000 AND 50000000),
  CONSTRAINT "payments_currency_check" CHECK ("currency" = 'VND')
);

CREATE TABLE "payment_idempotencies" (
  "id" TEXT NOT NULL,
  "requester_id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "operation" "PaymentIdempotencyOperation" NOT NULL,
  "key_digest" TEXT NOT NULL,
  "request_fingerprint" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_idempotencies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_idempotencies_payment_id_key" UNIQUE ("payment_id"),
  CONSTRAINT "payment_idempotencies_requester_id_workspace_id_operation_key_digest_key"
    UNIQUE ("requester_id", "workspace_id", "operation", "key_digest")
);

CREATE TABLE "payment_provider_results" (
  "id" TEXT NOT NULL,
  "semantic_key" TEXT NOT NULL,
  "payment_id" TEXT,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'MOMO',
  "partner_code" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "momo_transaction_id" BIGINT,
  "result_code" INTEGER NOT NULL,
  "claimed_outcome" TEXT NOT NULL,
  "disposition" "PaymentResultDisposition" NOT NULL,
  "reason_code" TEXT,
  "response_time" TIMESTAMP(3),
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "duplicate_count" INTEGER NOT NULL DEFAULT 0,
  "safe_payload" JSONB,
  CONSTRAINT "payment_provider_results_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_provider_results_semantic_key_key" UNIQUE ("semantic_key"),
  CONSTRAINT "payment_provider_results_duplicate_count_check" CHECK ("duplicate_count" >= 0)
);

CREATE TABLE "payment_processing_records" (
  "id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "work_key" TEXT NOT NULL,
  "kind" "PaymentWorkKind" NOT NULL,
  "status" "PaymentWorkStatus" NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_owner" TEXT,
  "lease_expires_at" TIMESTAMP(3),
  "last_attempt_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "safe_failure_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_processing_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_processing_records_work_key_key" UNIQUE ("work_key"),
  CONSTRAINT "payment_processing_records_attempt_count_check" CHECK ("attempt_count" >= 0)
);

CREATE TABLE "payment_outcomes" (
  "id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "type" "PaymentOutcomeType" NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" JSONB NOT NULL,
  CONSTRAINT "payment_outcomes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_outcomes_payment_id_key" UNIQUE ("payment_id"),
  CONSTRAINT "payment_outcomes_dedupe_key_key" UNIQUE ("dedupe_key")
);

CREATE TABLE "invoices" (
  "id" TEXT NOT NULL,
  "invoice_reference" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "issuer_snapshot" JSONB NOT NULL,
  "payer_snapshot" JSONB NOT NULL,
  "line_items_snapshot" JSONB NOT NULL,
  "subtotal_vnd" INTEGER NOT NULL,
  "tax_vnd" INTEGER NOT NULL,
  "total_vnd" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "document_status" "InvoiceDocumentStatus" NOT NULL DEFAULT 'PENDING_RENDER',
  "storage_bucket" TEXT,
  "storage_key" TEXT,
  "content_sha256" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoices_invoice_reference_key" UNIQUE ("invoice_reference"),
  CONSTRAINT "invoices_payment_id_key" UNIQUE ("payment_id"),
  CONSTRAINT "invoices_total_vnd_check" CHECK ("total_vnd" >= 1000),
  CONSTRAINT "invoices_currency_check" CHECK ("currency" = 'VND')
);

CREATE TABLE "payment_audit_events" (
  "id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "invoice_id" TEXT,
  "action" "PaymentAuditAction" NOT NULL,
  "previous_state" "PaymentStatus",
  "new_state" "PaymentStatus",
  "actor_kind" "PaymentAuditActorKind" NOT NULL,
  "correlation_id" TEXT,
  "reason_code" TEXT,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payments_workspace_id_created_at_idx" ON "payments"("workspace_id", "created_at");
CREATE INDEX "payments_workspace_id_status_updated_at_idx" ON "payments"("workspace_id", "status", "updated_at");
CREATE INDEX "payments_status_checkout_status_expires_at_idx" ON "payments"("status", "checkout_status", "expires_at");
CREATE INDEX "payments_momo_transaction_id_idx" ON "payments"("momo_transaction_id");
CREATE INDEX "payment_idempotencies_workspace_id_idx" ON "payment_idempotencies"("workspace_id");
CREATE INDEX "payment_provider_results_payment_id_idx" ON "payment_provider_results"("payment_id");
CREATE INDEX "payment_provider_results_partner_code_order_id_request_id_idx" ON "payment_provider_results"("partner_code", "order_id", "request_id");
CREATE INDEX "payment_provider_results_momo_transaction_id_idx" ON "payment_provider_results"("momo_transaction_id");
CREATE INDEX "payment_processing_records_status_available_at_lease_expires_at_idx" ON "payment_processing_records"("status", "available_at", "lease_expires_at");
CREATE INDEX "payment_processing_records_payment_id_idx" ON "payment_processing_records"("payment_id");
CREATE INDEX "payment_audit_events_payment_id_occurred_at_idx" ON "payment_audit_events"("payment_id", "occurred_at");
CREATE INDEX "payment_audit_events_invoice_id_idx" ON "payment_audit_events"("invoice_id");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "payments_requester_id_fkey"
  FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_idempotencies"
  ADD CONSTRAINT "payment_idempotencies_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_provider_results"
  ADD CONSTRAINT "payment_provider_results_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_processing_records"
  ADD CONSTRAINT "payment_processing_records_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_outcomes"
  ADD CONSTRAINT "payment_outcomes_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_audit_events"
  ADD CONSTRAINT "payment_audit_events_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "payment_audit_events_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
