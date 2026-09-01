-- P5-01: Add catalog governance fields to RequestType
-- Adds: ownerId (catalog item owner), lifecycleStatus (DRAFT/PUBLISHED/DEPRECATED/RETIRED), reviewDate

-- 1. Create enum type
CREATE TYPE "CatalogLifecycleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED', 'RETIRED');

-- 2. Add columns to request_types
ALTER TABLE "request_types" ADD COLUMN "owner_id" UUID;
ALTER TABLE "request_types" ADD COLUMN "lifecycle_status" "CatalogLifecycleStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "request_types" ADD COLUMN "review_date" TIMESTAMP(6);

-- 3. Set existing active items to PUBLISHED, inactive to RETIRED
UPDATE "request_types" SET "lifecycle_status" = 'PUBLISHED' WHERE "is_active" = true;
UPDATE "request_types" SET "lifecycle_status" = 'RETIRED' WHERE "is_active" = false;

-- 4. Add foreign key and indexes
ALTER TABLE "request_types" ADD CONSTRAINT "request_types_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "request_types_owner_id_idx" ON "request_types"("owner_id");
CREATE INDEX "request_types_lifecycle_status_idx" ON "request_types"("lifecycle_status");