-- CreateEnum: OutboxEventStatus for outbox retry/dead-letter tracking
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'CLAIMED', 'PUBLISHED', 'FAILED', 'DEAD_LETTER');

-- AlterTable: Add retry and dead-letter columns to outbox_events
ALTER TABLE "outbox_events" ADD COLUMN "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "outbox_events" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "outbox_events" ADD COLUMN "max_attempts" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "outbox_events" ADD COLUMN "next_attempt_at" TIMESTAMP(6);
ALTER TABLE "outbox_events" ADD COLUMN "last_error" TEXT;
ALTER TABLE "outbox_events" ADD COLUMN "claimed_at" TIMESTAMP(6);
ALTER TABLE "outbox_events" ADD COLUMN "claimed_by" VARCHAR(100);

-- CreateIndex: Outbox dispatch queries
CREATE INDEX "outbox_events_status_next_attempt_at_idx" ON "outbox_events" ("status", "next_attempt_at");
CREATE INDEX "outbox_events_status_created_at_idx" ON "outbox_events" ("status", "created_at");