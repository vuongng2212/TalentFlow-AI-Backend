ALTER TABLE "ai_usage_records" DROP CONSTRAINT IF EXISTS "ai_usage_records_workspace_id_fkey";

DROP INDEX IF EXISTS "ai_usage_records_workspace_id_usage_date_idx";

DELETE FROM "ai_usage_records"
WHERE "context_type"::TEXT = 'WORKSPACE'
   OR "workspace_id" IS NOT NULL;

ALTER TABLE "ai_usage_records" DROP COLUMN IF EXISTS "workspace_id";

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'AiUsageContextType'
          AND e.enumlabel = 'WORKSPACE'
    ) THEN
        ALTER TYPE "AiUsageContextType" RENAME TO "AiUsageContextType_old";
        CREATE TYPE "AiUsageContextType" AS ENUM ('PERSONAL');
        ALTER TABLE "ai_usage_records"
            ALTER COLUMN "context_type" TYPE "AiUsageContextType"
            USING "context_type"::TEXT::"AiUsageContextType";
        DROP TYPE "AiUsageContextType_old";
    END IF;
END $$;

ALTER TABLE "subscription_plans" DROP COLUMN IF EXISTS "can_activate_workspace";

DROP TABLE IF EXISTS "workspace_members";
DROP TABLE IF EXISTS "workspace_subscriptions";
DROP TABLE IF EXISTS "workspaces";

DROP TYPE IF EXISTS "WorkspaceMemberStatus";
DROP TYPE IF EXISTS "WorkspaceMemberRole";
