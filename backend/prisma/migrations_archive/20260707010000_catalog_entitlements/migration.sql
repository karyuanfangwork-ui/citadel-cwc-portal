-- P5-02: Catalog entitlement/audience rules
-- Controls which users can see which catalog items based on role, department, or entity.

-- 1. Create enum type
CREATE TYPE "CatalogEntitlementTarget" AS ENUM ('ROLE', 'DEPARTMENT', 'ENTITY', 'ALL');

-- 2. Create catalog_entitlements table
CREATE TABLE "catalog_entitlements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "request_type_id" UUID NOT NULL,
    "target_type" "CatalogEntitlementTarget" NOT NULL,
    "target_id" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT now(),

    CONSTRAINT "catalog_entitlements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "catalog_entitlements_request_type_id_fkey"
        FOREIGN KEY ("request_type_id") REFERENCES "request_types"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3. Create indexes
CREATE INDEX "catalog_entitlements_request_type_id_idx" ON "catalog_entitlements"("request_type_id");
CREATE INDEX "catalog_entitlements_tenant_id_idx" ON "catalog_entitlements"("tenant_id");
CREATE INDEX "catalog_entitlements_target_type_target_id_idx" ON "catalog_entitlements"("target_type", "target_id");