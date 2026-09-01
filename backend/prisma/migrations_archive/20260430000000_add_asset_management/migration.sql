-- AddAssetManagement
-- Backfilled from schema: CREATE TYPE + CREATE TABLE statements that were
-- originally applied via `prisma db push` but missing from this baseline marker.

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('LAPTOP', 'DESKTOP', 'MONITOR', 'PERIPHERAL', 'PHONE', 'NETWORK', 'PRINTER', 'SOFTWARE_LICENSE', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('IN_STOCK', 'ASSIGNED', 'RESERVED', 'PENDING_RETURN', 'IN_REPAIR', 'RETIRED', 'DISPOSED', 'LOST');

-- CreateEnum
CREATE TYPE "ExecutiveRole" AS ENUM ('CEO', 'CTO', 'CFO', 'COO', 'CHRO', 'CMO', 'GROUP_CEO');

-- CreateTable: assets
CREATE TABLE "assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "asset_tag" VARCHAR(100) NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'IN_STOCK',
    "brand" VARCHAR(100),
    "model" VARCHAR(100),
    "serial_number" VARCHAR(100),
    "purchase_date" TIMESTAMP(6),
    "purchase_cost" DECIMAL(10,2),
    "warranty_expiry" TIMESTAMP(6),
    "notes" TEXT,
    "location" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT now(),

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_asset_tag_key" ON "assets"("asset_tag");

-- CreateTable: asset_assignments
CREATE TABLE "asset_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "returned_at" TIMESTAMP(6),
    "notes" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT now(),

    CONSTRAINT "asset_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_assignments_asset_id_idx" ON "asset_assignments"("asset_id");
CREATE INDEX "asset_assignments_user_id_idx" ON "asset_assignments"("user_id");

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add executive_role to users
ALTER TABLE "users" ADD COLUMN "executive_role" "ExecutiveRole";