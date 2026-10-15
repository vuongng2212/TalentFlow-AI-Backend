-- =============================================================
-- Subscriptions and plan entitlements
-- Creates the canonical plan catalogue and exactly one active
-- subscription per existing workspace without changing is_business.
-- =============================================================

BEGIN;

CREATE TYPE "PlanCode" AS ENUM ('FREE', 'PLUS', 'BUSINESS');
CREATE TYPE "WorkspaceSubscriptionStatus" AS ENUM ('ACTIVE');

CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "code" "PlanCode" NOT NULL,
    "name" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "enables_business" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "WorkspaceSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");
CREATE UNIQUE INDEX "plans_display_order_key" ON "plans"("display_order");
CREATE UNIQUE INDEX "subscriptions_workspace_id_key" ON "subscriptions"("workspace_id");
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

ALTER TABLE "subscriptions"
    ADD CONSTRAINT "subscriptions_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscriptions"
    ADD CONSTRAINT "subscriptions_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "plans"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "plans" (
    "id", "code", "name", "display_order", "is_active",
    "enables_business", "created_at", "updated_at"
)
VALUES
    (gen_random_uuid()::text, 'FREE', 'Free', 1, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'PLUS', 'Plus', 2, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'BUSINESS', 'Business', 3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET
    "name" = EXCLUDED."name",
    "display_order" = EXCLUDED."display_order",
    "is_active" = EXCLUDED."is_active",
    "enables_business" = EXCLUDED."enables_business",
    "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "subscriptions" (
    "id", "workspace_id", "plan_id", "status", "started_at", "created_at", "updated_at"
)
SELECT
    gen_random_uuid()::text,
    workspace."id",
    plan."id",
    'ACTIVE'::"WorkspaceSubscriptionStatus",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "workspaces" AS workspace
JOIN "plans" AS plan
    ON plan."code" = CASE
        WHEN workspace."is_business" THEN 'BUSINESS'::"PlanCode"
        ELSE 'FREE'::"PlanCode"
    END
ON CONFLICT ("workspace_id") DO NOTHING;

COMMIT;
