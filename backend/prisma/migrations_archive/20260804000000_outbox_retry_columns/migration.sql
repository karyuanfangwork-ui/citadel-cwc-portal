-- CreateEnum: OutboxEventStatus for outbox retry/dead-letter tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OutboxEventStatus') THEN
    CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'CLAIMED', 'PUBLISHED', 'FAILED', 'DEAD_LETTER');
  END IF;
END
$$;

-- AlterTable: Add retry and dead-letter columns to outbox_events
ALTER TABLE "outbox_events" ADD COLUMN IF NOT EXISTS "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "outbox_events" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "outbox_events" ADD COLUMN IF NOT EXISTS "max_attempts" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "outbox_events" ADD COLUMN IF NOT EXISTS "next_attempt_at" TIMESTAMP(6);
ALTER TABLE "outbox_events" ADD COLUMN IF NOT EXISTS "last_error" TEXT;
ALTER TABLE "outbox_events" ADD COLUMN IF NOT EXISTS "claimed_at" TIMESTAMP(6);
ALTER TABLE "outbox_events" ADD COLUMN IF NOT EXISTS "claimed_by" VARCHAR(100);

-- CreateIndex: Outbox dispatch queries
CREATE INDEX IF NOT EXISTS "outbox_events_status_next_attempt_at_idx" ON "outbox_events" ("status", "next_attempt_at");
CREATE INDEX IF NOT EXISTS "outbox_events_status_created_at_idx" ON "outbox_events" ("status", "created_at");