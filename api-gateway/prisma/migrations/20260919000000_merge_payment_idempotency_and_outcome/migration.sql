-- Merge one-to-one payment implementation details into the aggregate.
-- Existing payment records are populated before their former child tables are removed.

BEGIN;

ALTER TABLE "payments"
  ADD COLUMN "idempotency_operation" "PaymentIdempotencyOperation",
  ADD COLUMN "idempotency_key_digest" TEXT,
  ADD COLUMN "idempotency_request_fingerprint" TEXT,
  ADD COLUMN "outcome_recorded_at" TIMESTAMP(3);

UPDATE "payments" AS payment
SET
  "idempotency_operation" = idempotency."operation",
  "idempotency_key_digest" = idempotency."key_digest",
  "idempotency_request_fingerprint" = idempotency."request_fingerprint"
FROM "payment_idempotencies" AS idempotency
WHERE idempotency."payment_id" = payment."id";

UPDATE "payments" AS payment
SET "outcome_recorded_at" = outcome."occurred_at"
FROM "payment_outcomes" AS outcome
WHERE outcome."payment_id" = payment."id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "payments"
    WHERE "idempotency_operation" IS NULL
       OR "idempotency_key_digest" IS NULL
       OR "idempotency_request_fingerprint" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot merge payment idempotency: every payment must have an idempotency record';
  END IF;
END $$;

ALTER TABLE "payments"
  ALTER COLUMN "idempotency_operation" SET NOT NULL,
  ALTER COLUMN "idempotency_key_digest" SET NOT NULL,
  ALTER COLUMN "idempotency_request_fingerprint" SET NOT NULL,
  ADD CONSTRAINT "payments_idempotency_key"
    UNIQUE ("requester_id", "workspace_id", "idempotency_operation", "idempotency_key_digest");

DROP TABLE "payment_idempotencies";
DROP TABLE "payment_outcomes";
DROP TYPE "PaymentOutcomeType";

COMMIT;
