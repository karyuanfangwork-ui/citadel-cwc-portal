-- P2.4: Add governance lifecycle fields to RatingBandConfig
-- status, name, description columns for maker-checker workflow

ALTER TABLE "rating_band_configs" ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "rating_band_configs" ADD COLUMN "name" VARCHAR(200);
ALTER TABLE "rating_band_configs" ADD COLUMN "description" TEXT;

CREATE INDEX "rating_band_configs_status_idx" ON "rating_band_configs"("status");

-- Backfill existing rows to APPROVED/ACTIVE since they were seeded as canonical
UPDATE "rating_band_configs" SET "status" = 'ACTIVE' WHERE "approved_by_id" IS NOT NULL OR "version" = 1;