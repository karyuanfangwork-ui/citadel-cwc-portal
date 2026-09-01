-- Multi-Tenancy: Backfill tenant_id and set NOT NULL
-- Migration: tenant_backfill_set_not_null

-- Step 1: Insert default tenant (idempotent — uses slug uniqueness)
INSERT INTO "tenants" ("id", "name", "slug", "plan", "is_active", "created_at", "updated_at")
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Citadel',
    'citadel',
    'ENTERPRISE',
    true,
    NOW(),
    NOW()
) ON CONFLICT ("slug") DO NOTHING;

-- Step 2: Backfill tenant_id on all root models with the default tenant
UPDATE "users"              SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "requests"            SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "assets"              SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "crm_leads"           SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "crm_accounts"        SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "crm_opportunities"   SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "crm_contacts"        SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "crm_pipelines"       SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "credit_applications" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "kb_articles"         SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "notifications"       SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "audit_logs"          SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "announcements"       SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "announcement_reads"  SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "onboarding_requests"  SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "offboarding_requests" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "candidates"           SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "branches"             SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "entities"             SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "service_desks"        SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "service_categories"   SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "request_types"        SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "escalation_rules"     SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "system_settings"      SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "feature_flags"        SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "notification_templates" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

-- Step 3: Set tenant_id NOT NULL on all columns
ALTER TABLE "users"              ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "requests"            ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "assets"              ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "crm_leads"           ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "crm_accounts"        ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "crm_opportunities"   ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "crm_contacts"        ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "crm_pipelines"       ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "credit_applications" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "kb_articles"         ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "notifications"       ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "audit_logs"          ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "announcements"       ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "announcement_reads"  ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "onboarding_requests"  ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "offboarding_requests" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "candidates"           ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "branches"             ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "entities"             ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "service_desks"        ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "service_categories"   ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "request_types"        ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "escalation_rules"     ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "system_settings"      ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "feature_flags"        ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "notification_templates" ALTER COLUMN "tenant_id" SET NOT NULL;