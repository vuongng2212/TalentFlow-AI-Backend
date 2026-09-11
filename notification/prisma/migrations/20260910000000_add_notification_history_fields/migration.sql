-- Preserve the public notification types when records are stored.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'APPLICATION_CONFIRMATION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_APPLICATION_HR';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'APPLICATION_RESULT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WORKSPACE_INVITATION';

-- Link CV notifications to the application that the client should refresh.
ALTER TABLE "notifications" ADD COLUMN "application_id" TEXT;

CREATE INDEX "notifications_application_id_idx" ON "notifications"("application_id");
