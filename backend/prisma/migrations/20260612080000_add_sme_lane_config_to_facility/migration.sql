-- AlterTable: Add sme_lane_config column to application_facilities
ALTER TABLE "application_facilities" ADD COLUMN IF NOT EXISTS "sme_lane_config" JSONB;