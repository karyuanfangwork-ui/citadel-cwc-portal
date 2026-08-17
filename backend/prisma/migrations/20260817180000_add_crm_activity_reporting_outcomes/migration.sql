ALTER TABLE "crm_activities"
  ADD COLUMN "call_category" VARCHAR(30),
  ADD COLUMN "call_outcome" VARCHAR(30),
  ADD COLUMN "email_outcome" VARCHAR(30),
  ADD COLUMN "meeting_outcome" VARCHAR(30),
  ADD COLUMN "engagement_outcome" VARCHAR(30);