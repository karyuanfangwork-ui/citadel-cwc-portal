ALTER TABLE "crm_leads" ADD COLUMN "lost_at" TIMESTAMP(6);
UPDATE "crm_leads" SET "lost_at" = "updated_at" WHERE "status" = 'LOST' AND "lost_at" IS NULL;
ALTER TABLE "crm_activities" ADD COLUMN "outcome_recorded_at" TIMESTAMP(6);
ALTER TABLE "crm_activities" ADD COLUMN "source" VARCHAR(10) NOT NULL DEFAULT 'CRM';
UPDATE "crm_activities" SET "outcome_recorded_at" = "created_at"
WHERE "call_outcome" IS NOT NULL OR "email_outcome" IS NOT NULL OR "meeting_outcome" IS NOT NULL OR "engagement_outcome" IS NOT NULL;
UPDATE "crm_activities" SET "source" = 'SYSTEM' WHERE "activity_type" = 'NOTE'
  AND ("subject" LIKE 'Lead converted to opportunity:%' OR "subject" LIKE 'Deal moved to %');
CREATE INDEX "crm_activities_source_created_at_idx" ON "crm_activities" ("source", "created_at" DESC);
CREATE INDEX "crm_activities_outcome_recorded_at_idx" ON "crm_activities" ("outcome_recorded_at" DESC);
CREATE INDEX "crm_leads_lost_at_idx" ON "crm_leads" ("lost_at");
