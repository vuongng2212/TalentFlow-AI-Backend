DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentProvider') THEN
        CREATE TYPE "PaymentProvider" AS ENUM ('MOMO');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentTransactionStatus') THEN
        CREATE TYPE "PaymentTransactionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REJECTED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentConfirmationSource') THEN
        CREATE TYPE "PaymentConfirmationSource" AS ENUM ('MOMO_IPN', 'INTERNAL_OPERATOR', 'INTERNAL_REPLAY');
    END IF;
END $$;

ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "is_paid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "price_amount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'VND';
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "checkout_eligible" BOOLEAN NOT NULL DEFAULT false;

UPDATE "subscription_plans"
SET
    "is_paid" = CASE "code" WHEN 'FREE' THEN false ELSE true END,
    "price_amount" = CASE "code"
        WHEN 'PLUS' THEN 99000
        WHEN 'BUSINESS' THEN 499000
        ELSE 0
    END,
    "currency" = 'VND',
    "checkout_eligible" = CASE "code" WHEN 'FREE' THEN false ELSE true END,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "code" IN ('FREE', 'PLUS', 'BUSINESS');

CREATE TABLE IF NOT EXISTS "payment_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MOMO',
    "provider_request_id" TEXT NOT NULL,
    "provider_order_id" TEXT NOT NULL,
    "provider_transaction_id" TEXT,
    "expected_amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "checkout_url" TEXT,
    "deeplink" TEXT,
    "qr_code_url" TEXT,
    "raw_provider_request" JSONB,
    "raw_provider_response" JSONB,
    "rejection_reason" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "payment_confirmations" (
    "id" TEXT NOT NULL,
    "payment_transaction_id" TEXT NOT NULL,
    "source" "PaymentConfirmationSource" NOT NULL,
    "result_code" INTEGER,
    "message" TEXT,
    "signature_valid" BOOLEAN NOT NULL DEFAULT false,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "rejection_reason" TEXT,
    "raw_payload" JSONB,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_confirmations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "payment_transaction_id" TEXT;
ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "business_workspace_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_provider_request_id_key" ON "payment_transactions"("provider_request_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_provider_order_id_key" ON "payment_transactions"("provider_order_id");
CREATE INDEX IF NOT EXISTS "payment_transactions_user_id_status_idx" ON "payment_transactions"("user_id", "status");
CREATE INDEX IF NOT EXISTS "payment_transactions_plan_id_idx" ON "payment_transactions"("plan_id");
CREATE INDEX IF NOT EXISTS "payment_transactions_status_idx" ON "payment_transactions"("status");
CREATE INDEX IF NOT EXISTS "payment_confirmations_payment_transaction_id_idx" ON "payment_confirmations"("payment_transaction_id");
CREATE INDEX IF NOT EXISTS "payment_confirmations_accepted_idx" ON "payment_confirmations"("accepted");
CREATE UNIQUE INDEX IF NOT EXISTS "user_subscriptions_payment_transaction_id_key" ON "user_subscriptions"("payment_transaction_id");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_transactions_user_id_fkey') THEN
        ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_transactions_plan_id_fkey') THEN
        ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_confirmations_payment_transaction_id_fkey') THEN
        ALTER TABLE "payment_confirmations" ADD CONSTRAINT "payment_confirmations_payment_transaction_id_fkey" FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_subscriptions_payment_transaction_id_fkey') THEN
        ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_payment_transaction_id_fkey" FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DROP TABLE IF EXISTS "workspace_subscriptions";
