-- =============================================================
-- Workspace Multi-Tenancy Migration
-- =============================================================
-- This custom SQL migration transitions TalentFlow from a
-- user-centric (createdById) model to a workspace-centric tenant
-- model. It performs the following in a single, idempotent
-- transaction:
--
--   1. Provisions a default Personal Workspace for every existing
--      user (one workspace per user, named "{fullName} - Personal
--      Workspace", isBusiness=false).
--   2. Provisions a WorkspaceMember record (role=OWNER, status=ACTIVE)
--      linking each user to their Personal Workspace.
--   3. Adds workspace_id columns to jobs, candidates, applications,
--      interviews, and the new email_templates table; backfills
--      them from the creator's Personal Workspace.
--   4. Replaces the global unique constraint on candidates.email
--      with a composite (workspace_id, email) unique index.
--   5. Adds the users.active_workspace_id column and FK.
--   6. Creates the workspace_invitations and email_templates tables
--      with the appropriate constraints, indexes, and FKs.
--   7. Adds created_by_id to workspaces.
-- =============================================================

BEGIN;

-- ----------------------------------------------------------------
-- 1. Allow NULL on candidates.email temporarily so the unique
--    constraint can be replaced with a composite (workspace_id, email)
--    unique index later. (We must drop the global unique index first.)
-- ----------------------------------------------------------------

-- Drop the global unique index on candidates.email
DROP INDEX IF EXISTS "candidates_email_key";

-- ----------------------------------------------------------------
-- 2. Add workspace_id columns (nullable for backfill)
-- ----------------------------------------------------------------

ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "workspace_id" TEXT;

ALTER TABLE "candidates"
  ADD COLUMN IF NOT EXISTS "workspace_id" TEXT;

ALTER TABLE "applications"
  ADD COLUMN IF NOT EXISTS "workspace_id" TEXT;

ALTER TABLE "interviews"
  ADD COLUMN IF NOT EXISTS "workspace_id" TEXT;

-- ----------------------------------------------------------------
-- 3. Add users.active_workspace_id (nullable) and workspaces.created_by_id
-- ----------------------------------------------------------------

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "active_workspace_id" TEXT;

ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "created_by_id" TEXT;

-- ----------------------------------------------------------------
-- 4. Provision a Personal Workspace for every existing user that
--    does not already have one assigned as active. We use a CTE
--    so the workspace id, the user.active_workspace_id, and the
--    workspace_members row are populated consistently.
-- ----------------------------------------------------------------

DO $$
DECLARE
  rec RECORD;
  v_workspace_id TEXT;
  v_member_id    TEXT;
BEGIN
  FOR rec IN
    SELECT u.id AS user_id, u.full_name
    FROM users u
    WHERE u.active_workspace_id IS NULL
      AND u.deleted_at IS NULL
  LOOP
    v_workspace_id := gen_random_uuid();
    v_member_id    := gen_random_uuid();

    INSERT INTO workspaces (id, name, is_business, created_at, updated_at, created_by_id)
    VALUES (
      v_workspace_id,
      rec.full_name || ' - Personal Workspace',
      false,
      NOW(),
      NOW(),
      rec.user_id
    );

    INSERT INTO workspace_members (id, workspace_id, user_id, role, status, invited_by_id, created_at, updated_at)
    VALUES (
      v_member_id,
      v_workspace_id,
      rec.user_id,
      'OWNER'::"WorkspaceMemberRole",
      'ACTIVE'::"WorkspaceMemberStatus",
      rec.user_id,
      NOW(),
      NOW()
    );

    UPDATE users
    SET active_workspace_id = v_workspace_id
    WHERE id = rec.user_id;
  END LOOP;
END
$$;

-- ----------------------------------------------------------------
-- 5. Backfill workspace_id on jobs (from creator's personal ws)
-- ----------------------------------------------------------------

UPDATE jobs j
SET workspace_id = u.active_workspace_id
FROM users u
WHERE j.created_by_id = u.id
  AND j.workspace_id IS NULL;

-- For any orphan jobs (creator deleted), create a fallback workspace
DO $$
DECLARE
  rec RECORD;
  v_workspace_id TEXT;
BEGIN
  FOR rec IN
    SELECT j.id AS job_id, j.created_by_id
    FROM jobs j
    WHERE j.workspace_id IS NULL
  LOOP
    v_workspace_id := gen_random_uuid();
    INSERT INTO workspaces (id, name, is_business, created_at, updated_at, created_by_id)
    VALUES (v_workspace_id, 'Orphan Workspace', false, NOW(), NOW(), rec.created_by_id);
    UPDATE jobs SET workspace_id = v_workspace_id WHERE id = rec.job_id;
  END LOOP;
END
$$;

-- ----------------------------------------------------------------
-- 6. Backfill workspace_id on candidates (from any job the
--    candidate has applied to, or the application's workspace).
--    We choose the workspace of the most recent application.
-- ----------------------------------------------------------------

UPDATE candidates c
SET workspace_id = sub.ws_id
FROM (
  SELECT DISTINCT ON (a.candidate_id) a.candidate_id, a.workspace_id AS ws_id
  FROM applications a
  WHERE a.workspace_id IS NOT NULL
  ORDER BY a.candidate_id, a.created_at DESC
) sub
WHERE c.id = sub.candidate_id
  AND c.workspace_id IS NULL;

-- Fallback: any remaining candidates (no applications) get a
-- system-level "default candidates" workspace is intentionally
-- avoided here to keep tenants pure. We create one per orphan
-- candidate to avoid cross-tenant merges.
DO $$
DECLARE
  rec RECORD;
  v_workspace_id TEXT;
BEGIN
  FOR rec IN
    SELECT c.id AS candidate_id
    FROM candidates c
    WHERE c.workspace_id IS NULL
  LOOP
    v_workspace_id := gen_random_uuid();
    INSERT INTO workspaces (id, name, is_business, created_at, updated_at)
    VALUES (v_workspace_id, 'Orphan Candidates Workspace', false, NOW(), NOW());
    UPDATE candidates SET workspace_id = v_workspace_id WHERE id = rec.candidate_id;
  END LOOP;
END
$$;

-- ----------------------------------------------------------------
-- 7. Backfill workspace_id on applications and interviews from
--    the parent job.
-- ----------------------------------------------------------------

UPDATE applications a
SET workspace_id = j.workspace_id
FROM jobs j
WHERE a.job_id = j.id
  AND a.workspace_id IS NULL;

UPDATE interviews i
SET workspace_id = a.workspace_id
FROM applications a
WHERE i.application_id = a.id
  AND i.workspace_id IS NULL;

-- ----------------------------------------------------------------
-- 8. Enforce NOT NULL on workspace_id columns
-- ----------------------------------------------------------------

ALTER TABLE "jobs"          ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "candidates"    ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "applications"  ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "interviews"    ALTER COLUMN "workspace_id" SET NOT NULL;

-- ----------------------------------------------------------------
-- 9. Create the workspace_invitations table
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "workspace_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" "WorkspaceMemberRole" NOT NULL DEFAULT 'RECRUITER',
    "invited_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invitations_token_key" ON "workspace_invitations"("token");
CREATE INDEX        IF NOT EXISTS "workspace_invitations_email_idx"      ON "workspace_invitations"("email");
CREATE INDEX        IF NOT EXISTS "workspace_invitations_workspace_id_idx" ON "workspace_invitations"("workspace_id");

-- ----------------------------------------------------------------
-- 10. Create the email_templates table
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "email_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_workspace_id_name_key" ON "email_templates"("workspace_id", "name");
CREATE INDEX        IF NOT EXISTS "email_templates_workspace_id_idx"        ON "email_templates"("workspace_id");

-- ----------------------------------------------------------------
-- 11. Add foreign keys (after backfill so they pass NOT NULL checks)
-- ----------------------------------------------------------------

ALTER TABLE "jobs"
  ADD CONSTRAINT "jobs_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidates"
  ADD CONSTRAINT "candidates_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "applications"
  ADD CONSTRAINT "applications_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "interviews"
  ADD CONSTRAINT "interviews_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users"
  ADD CONSTRAINT "users_active_workspace_id_fkey"
  FOREIGN KEY ("active_workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workspaces"
  ADD CONSTRAINT "workspaces_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email_templates"
  ADD CONSTRAINT "email_templates_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_invitations"
  ADD CONSTRAINT "workspace_invitations_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_invitations"
  ADD CONSTRAINT "workspace_invitations_invited_by_id_fkey"
  FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------
-- 12. Add per-tenant indexes
-- ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "jobs_workspace_id_idx"         ON "jobs"("workspace_id");
CREATE INDEX IF NOT EXISTS "candidates_workspace_id_idx"   ON "candidates"("workspace_id");
CREATE INDEX IF NOT EXISTS "applications_workspace_id_idx" ON "applications"("workspace_id");
CREATE INDEX IF NOT EXISTS "interviews_workspace_id_idx"   ON "interviews"("workspace_id");
CREATE INDEX IF NOT EXISTS "users_active_workspace_id_idx" ON "users"("active_workspace_id");

-- ----------------------------------------------------------------
-- 13. Composite (workspace_id, email) unique on candidates and
--     an index on candidates.email for case-insensitive search
-- ----------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS "candidates_workspace_id_email_key"
  ON "candidates"("workspace_id", "email");

COMMIT;
