CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionPlanCode') THEN
        CREATE TYPE "SubscriptionPlanCode" AS ENUM ('FREE', 'PLUS', 'BUSINESS');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionPlanScope') THEN
        CREATE TYPE "SubscriptionPlanScope" AS ENUM ('PERSONAL', 'WORKSPACE');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BillingPeriod') THEN
        CREATE TYPE "BillingPeriod" AS ENUM ('NONE', 'MONTHLY');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionStatus') THEN
        CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AiUsageContextType') THEN
        CREATE TYPE "AiUsageContextType" AS ENUM ('PERSONAL', 'WORKSPACE');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AiUsageAction') THEN
        CREATE TYPE "AiUsageAction" AS ENUM ('CV_SCORE', 'CV_FIT_ANALYSIS');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AiUsageDecision') THEN
        CREATE TYPE "AiUsageDecision" AS ENUM ('ALLOWED', 'DENIED');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "subscription_plans" (
    "id" TEXT NOT NULL,
    "code" "SubscriptionPlanCode",
    "name" TEXT NOT NULL,
    "scope" "SubscriptionPlanScope",
    "billing_period" "BillingPeriod",
    "daily_ai_request_limit" INTEGER,
    "trial_ai_request_limit" INTEGER,
    "can_score_cv" BOOLEAN NOT NULL DEFAULT true,
    "can_analyze_cv_fit" BOOLEAN NOT NULL DEFAULT false,
    "can_activate_workspace" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "code" "SubscriptionPlanCode";
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "scope" "SubscriptionPlanScope";
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "billing_period" "BillingPeriod";
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "daily_ai_request_limit" INTEGER;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "trial_ai_request_limit" INTEGER;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "can_score_cv" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "can_analyze_cv_fit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "can_activate_workspace" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "subscription_plans"
    ALTER COLUMN "billing_period" DROP DEFAULT,
    ALTER COLUMN "billing_period" TYPE "BillingPeriod" USING "billing_period"::TEXT::"BillingPeriod",
    ALTER COLUMN "billing_period" SET DEFAULT 'MONTHLY';

UPDATE "subscription_plans"
SET
    "code" = CASE UPPER("name")
        WHEN 'FREE' THEN 'FREE'::"SubscriptionPlanCode"
        WHEN 'PLUS' THEN 'PLUS'::"SubscriptionPlanCode"
        WHEN 'BUSINESS' THEN 'BUSINESS'::"SubscriptionPlanCode"
        ELSE "code"
    END
WHERE "code" IS NULL;

UPDATE "subscription_plans"
SET
    "scope" = CASE "code"
        WHEN 'BUSINESS' THEN 'WORKSPACE'::"SubscriptionPlanScope"
        ELSE 'PERSONAL'::"SubscriptionPlanScope"
    END,
    "billing_period" = CASE "code"
        WHEN 'FREE' THEN 'NONE'::"BillingPeriod"
        ELSE 'MONTHLY'::"BillingPeriod"
    END,
    "daily_ai_request_limit" = CASE "code"
        WHEN 'FREE' THEN 5
        WHEN 'PLUS' THEN 20
        WHEN 'BUSINESS' THEN 500
        ELSE "daily_ai_request_limit"
    END,
    "trial_ai_request_limit" = CASE "code"
        WHEN 'FREE' THEN 15
        ELSE NULL
    END,
    "can_score_cv" = true,
    "can_analyze_cv_fit" = CASE "code"
        WHEN 'FREE' THEN false
        ELSE true
    END,
    "can_activate_workspace" = CASE "code"
        WHEN 'BUSINESS' THEN true
        ELSE false
    END,
    "is_active" = true,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "code" IN ('FREE', 'PLUS', 'BUSINESS');

ALTER TABLE "subscription_plans" DROP COLUMN IF EXISTS "type";
ALTER TABLE "subscription_plans" DROP COLUMN IF EXISTS "description";
ALTER TABLE "subscription_plans" DROP COLUMN IF EXISTS "price";
ALTER TABLE "subscription_plans" DROP COLUMN IF EXISTS "currency";
ALTER TABLE "subscription_plans" DROP COLUMN IF EXISTS "sort_order";

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlanType')
       AND NOT EXISTS (
           SELECT 1
           FROM pg_attribute
           WHERE atttypid = '"PlanType"'::regtype
             AND attisdropped = false
       ) THEN
        DROP TYPE "PlanType";
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plans_code_key" ON "subscription_plans"("code");

INSERT INTO "subscription_plans" (
    "id",
    "code",
    "name",
    "scope",
    "billing_period",
    "daily_ai_request_limit",
    "trial_ai_request_limit",
    "can_score_cv",
    "can_analyze_cv_fit",
    "can_activate_workspace",
    "is_active",
    "updated_at"
)
SELECT
    '00000000-0000-4000-8000-000000000101',
    'FREE'::"SubscriptionPlanCode",
    'Free',
    'PERSONAL'::"SubscriptionPlanScope",
    'NONE'::"BillingPeriod",
    5,
    15,
    true,
    false,
    false,
    true,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "subscription_plans" WHERE "code" = 'FREE'
);

INSERT INTO "subscription_plans" (
    "id",
    "code",
    "name",
    "scope",
    "billing_period",
    "daily_ai_request_limit",
    "trial_ai_request_limit",
    "can_score_cv",
    "can_analyze_cv_fit",
    "can_activate_workspace",
    "is_active",
    "updated_at"
)
SELECT
    '00000000-0000-4000-8000-000000000102',
    'PLUS'::"SubscriptionPlanCode",
    'Plus',
    'PERSONAL'::"SubscriptionPlanScope",
    'MONTHLY'::"BillingPeriod",
    20,
    NULL,
    true,
    true,
    false,
    true,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "subscription_plans" WHERE "code" = 'PLUS'
);

INSERT INTO "subscription_plans" (
    "id",
    "code",
    "name",
    "scope",
    "billing_period",
    "daily_ai_request_limit",
    "trial_ai_request_limit",
    "can_score_cv",
    "can_analyze_cv_fit",
    "can_activate_workspace",
    "is_active",
    "updated_at"
)
SELECT
    '00000000-0000-4000-8000-000000000103',
    'BUSINESS'::"SubscriptionPlanCode",
    'Business',
    'WORKSPACE'::"SubscriptionPlanScope",
    'MONTHLY'::"BillingPeriod",
    500,
    NULL,
    true,
    true,
    true,
    true,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "subscription_plans" WHERE "code" = 'BUSINESS'
);

ALTER TABLE "subscription_plans"
    ALTER COLUMN "code" SET NOT NULL,
    ALTER COLUMN "scope" SET NOT NULL,
    ALTER COLUMN "billing_period" SET NOT NULL,
    ALTER COLUMN "daily_ai_request_limit" SET NOT NULL,
    ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "user_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "period_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "workspace_subscriptions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "purchaser_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "period_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_usage_records" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "context_type" "AiUsageContextType" NOT NULL,
    "workspace_id" TEXT,
    "plan_id" TEXT NOT NULL,
    "action" "AiUsageAction" NOT NULL,
    "usage_date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "decision" "AiUsageDecision" NOT NULL DEFAULT 'ALLOWED',
    "deny_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_subscriptions_user_id_status_idx" ON "user_subscriptions"("user_id", "status");
CREATE INDEX IF NOT EXISTS "user_subscriptions_plan_id_idx" ON "user_subscriptions"("plan_id");
CREATE INDEX IF NOT EXISTS "workspace_subscriptions_workspace_id_status_idx" ON "workspace_subscriptions"("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "workspace_subscriptions_purchaser_id_idx" ON "workspace_subscriptions"("purchaser_id");
CREATE INDEX IF NOT EXISTS "workspace_subscriptions_plan_id_idx" ON "workspace_subscriptions"("plan_id");
CREATE INDEX IF NOT EXISTS "ai_usage_records_actor_id_context_type_usage_date_idx" ON "ai_usage_records"("actor_id", "context_type", "usage_date");
CREATE INDEX IF NOT EXISTS "ai_usage_records_workspace_id_usage_date_idx" ON "ai_usage_records"("workspace_id", "usage_date");
CREATE INDEX IF NOT EXISTS "ai_usage_records_plan_id_idx" ON "ai_usage_records"("plan_id");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_subscriptions_user_id_fkey') THEN
        ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_subscriptions_plan_id_fkey') THEN
        ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_subscriptions_workspace_id_fkey') THEN
        ALTER TABLE "workspace_subscriptions" ADD CONSTRAINT "workspace_subscriptions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_subscriptions_purchaser_id_fkey') THEN
        ALTER TABLE "workspace_subscriptions" ADD CONSTRAINT "workspace_subscriptions_purchaser_id_fkey" FOREIGN KEY ("purchaser_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_subscriptions_plan_id_fkey') THEN
        ALTER TABLE "workspace_subscriptions" ADD CONSTRAINT "workspace_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_usage_records_actor_id_fkey') THEN
        ALTER TABLE "ai_usage_records" ADD CONSTRAINT "ai_usage_records_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_usage_records_workspace_id_fkey') THEN
        ALTER TABLE "ai_usage_records" ADD CONSTRAINT "ai_usage_records_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_usage_records_plan_id_fkey') THEN
        ALTER TABLE "ai_usage_records" ADD CONSTRAINT "ai_usage_records_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

INSERT INTO "user_subscriptions" (
    "id",
    "user_id",
    "plan_id",
    "status",
    "period_start",
    "period_end",
    "updated_at"
)
SELECT gen_random_uuid(), "users"."id", "subscription_plans"."id", 'ACTIVE', CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP
FROM "users"
JOIN "subscription_plans" ON "subscription_plans"."code" = 'FREE'
WHERE NOT EXISTS (
    SELECT 1
    FROM "user_subscriptions"
    WHERE "user_subscriptions"."user_id" = "users"."id"
      AND "user_subscriptions"."status" = 'ACTIVE'
      AND "user_subscriptions"."plan_id" = "subscription_plans"."id"
);
