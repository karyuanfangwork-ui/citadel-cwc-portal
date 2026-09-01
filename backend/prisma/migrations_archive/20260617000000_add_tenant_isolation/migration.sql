-- Multi-Tenancy: Add Tenant model and tenant_id to all root data models
-- Migration: add_tenant_isolation

-- Step 0: Create TenantPlan enum
CREATE TYPE "TenantPlan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- Step 1: Create tenants table
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "plan" "TenantPlan" NOT NULL DEFAULT 'FREE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- Step 2: Add tenant_id column to all root data models (nullable initially for backfill)
ALTER TABLE "users" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "requests" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "assets" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "crm_leads" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "crm_accounts" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "crm_opportunities" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "crm_contacts" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "crm_pipelines" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "credit_applications" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "kb_articles" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "notifications" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "audit_logs" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "announcements" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "announcement_reads" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "onboarding_requests" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "offboarding_requests" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "candidates" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "branches" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "entities" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "service_desks" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "service_categories" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "request_types" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "escalation_rules" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "system_settings" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "feature_flags" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "notification_templates" ADD COLUMN "tenant_id" UUID;

-- Step 3: Create indexes
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");
CREATE INDEX "requests_tenant_id_idx" ON "requests"("tenant_id");
CREATE INDEX "assets_tenant_id_idx" ON "assets"("tenant_id");
CREATE INDEX "crm_leads_tenant_id_idx" ON "crm_leads"("tenant_id");
CREATE INDEX "crm_accounts_tenant_id_idx" ON "crm_accounts"("tenant_id");
CREATE INDEX "crm_opportunities_tenant_id_idx" ON "crm_opportunities"("tenant_id");
CREATE INDEX "crm_contacts_tenant_id_idx" ON "crm_contacts"("tenant_id");
CREATE INDEX "crm_pipelines_tenant_id_idx" ON "crm_pipelines"("tenant_id");
CREATE INDEX "credit_applications_tenant_id_idx" ON "credit_applications"("tenant_id");
CREATE INDEX "kb_articles_tenant_id_idx" ON "kb_articles"("tenant_id");
CREATE INDEX "notifications_tenant_id_idx" ON "notifications"("tenant_id");
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");
CREATE INDEX "announcements_tenant_id_idx" ON "announcements"("tenant_id");
CREATE INDEX "announcement_reads_tenant_id_idx" ON "announcement_reads"("tenant_id");
CREATE INDEX "onboarding_requests_tenant_id_idx" ON "onboarding_requests"("tenant_id");
CREATE INDEX "offboarding_requests_tenant_id_idx" ON "offboarding_requests"("tenant_id");
CREATE INDEX "candidates_tenant_id_idx" ON "candidates"("tenant_id");
CREATE INDEX "branches_tenant_id_idx" ON "branches"("tenant_id");
CREATE INDEX "entities_tenant_id_idx" ON "entities"("tenant_id");
CREATE INDEX "service_desks_tenant_id_idx" ON "service_desks"("tenant_id");
CREATE INDEX "service_categories_tenant_id_idx" ON "service_categories"("tenant_id");
CREATE INDEX "request_types_tenant_id_idx" ON "request_types"("tenant_id");
CREATE INDEX "escalation_rules_tenant_id_idx" ON "escalation_rules"("tenant_id");
CREATE INDEX "system_settings_tenant_id_idx" ON "system_settings"("tenant_id");
CREATE INDEX "feature_flags_tenant_id_idx" ON "feature_flags"("tenant_id");
CREATE INDEX "notification_templates_tenant_id_idx" ON "notification_templates"("tenant_id");

-- Step 4: Add foreign key constraints
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "requests" ADD CONSTRAINT "requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assets" ADD CONSTRAINT "assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_pipelines" ADD CONSTRAINT "crm_pipelines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "onboarding_requests" ADD CONSTRAINT "onboarding_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offboarding_requests" ADD CONSTRAINT "offboarding_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "entities" ADD CONSTRAINT "entities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_desks" ADD CONSTRAINT "service_desks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "request_types" ADD CONSTRAINT "request_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escalation_rules" ADD CONSTRAINT "escalation_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;