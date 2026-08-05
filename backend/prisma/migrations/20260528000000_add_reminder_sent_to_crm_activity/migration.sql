-- AddReminderSentToCrmActivity
-- Sprint 2: Add reminder_sent flag to crm_activities and index on scheduled_at

-- 1. Add reminder_sent column with default false
ALTER TABLE "crm_activities" ADD COLUMN IF NOT EXISTS "reminder_sent" BOOLEAN NOT NULL DEFAULT false;

-- 2. Add index on scheduled_at for reminder queries
CREATE INDEX IF NOT EXISTS "CrmActivity_scheduledAt_idx" ON "crm_activities"("scheduled_at");