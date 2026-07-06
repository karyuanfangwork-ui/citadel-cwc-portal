-- P2-07: Tenant Nullability and Constraint Alignment
--
-- Strategy: Keep tenantId nullable in Prisma schema (system operations need null context)
-- but add DB-level enforcement:
--   1. CHECK constraints on models that are ALWAYS tenant-scoped (no legitimate null use case)
--   2. Partial unique indexes for tenant-local uniqueness
--   3. Composite tenant-first indexes for high-frequency query patterns
--
-- Models with legitimate null tenantId (KEEP NULLABLE):
--   SystemSetting, FeatureFlag, AuditLog, Announcement, NotificationTemplate
--   — These can have global rows where tenantId IS NULL (applies to all tenants)
--
-- Models that are ALWAYS tenant-scoped (ADD CHECK CONSTRAINT):
--   All other 22 models with tenantId

-- =====================================================
-- 1. CHECK constraints: tenantId must NOT be null for always-tenant-scoped models
-- =====================================================

ALTER TABLE users ADD CONSTRAINT chk_users_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE requests ADD CONSTRAINT chk_requests_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE assets ADD CONSTRAINT chk_assets_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE crm_leads ADD CONSTRAINT chk_crm_leads_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE crm_accounts ADD CONSTRAINT chk_crm_accounts_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE crm_opportunities ADD CONSTRAINT chk_crm_opportunities_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE crm_contacts ADD CONSTRAINT chk_crm_contacts_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE crm_pipelines ADD CONSTRAINT chk_crm_pipelines_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE credit_applications ADD CONSTRAINT chk_credit_applications_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE kb_articles ADD CONSTRAINT chk_knowledge_base_articles_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE notifications ADD CONSTRAINT chk_notifications_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE announcement_reads ADD CONSTRAINT chk_announcement_reads_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE onboarding_requests ADD CONSTRAINT chk_onboarding_requests_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE offboarding_requests ADD CONSTRAINT chk_offboarding_requests_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE candidates ADD CONSTRAINT chk_candidates_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE branches ADD CONSTRAINT chk_branches_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE entities ADD CONSTRAINT chk_entities_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE service_desks ADD CONSTRAINT chk_service_desks_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE service_categories ADD CONSTRAINT chk_service_categories_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE request_types ADD CONSTRAINT chk_request_types_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE escalation_rules ADD CONSTRAINT chk_escalation_rules_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE webhook_subscriptions ADD CONSTRAINT chk_webhook_subscriptions_tenant_id_required CHECK (tenant_id IS NOT NULL);
ALTER TABLE request_counters ADD CONSTRAINT chk_request_counters_tenant_id_required CHECK (tenant_id IS NOT NULL);

-- =====================================================
-- 2. BEFORE applying CHECK constraints: set null tenantId rows to a default tenant
--    (Adjust the default tenant UUID to your actual seed tenant)
-- =====================================================

-- IMPORTANT: Run these UPDATE statements ONLY if there are existing null rows.
-- Replace '00000000-0000-0000-0000-000000000001' with your real default tenant ID.

-- SET statements commented out by default — uncomment and adjust after verifying
-- which rows have null tenant_id:
-- UPDATE users SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
-- UPDATE requests SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
-- UPDATE assets SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
-- (etc. for each model above)

-- =====================================================
-- 3. Composite tenant-first indexes for high-frequency queries
-- =====================================================

-- Requests: tenant + status (agent dashboard, list filters)
CREATE INDEX IF NOT EXISTS idx_requests_tenant_status ON requests (tenant_id, status);
-- Requests: tenant + created_at (pagination, recent tickets)
CREATE INDEX IF NOT EXISTS idx_requests_tenant_created ON requests (tenant_id, created_at DESC);
-- Requests: tenant + assigned_to (my tickets view)
CREATE INDEX IF NOT EXISTS idx_requests_tenant_assigned ON requests (tenant_id, assigned_to_id);
-- Requests: tenant + service_desk (service desk filtering)
CREATE INDEX IF NOT EXISTS idx_requests_tenant_desk ON requests (tenant_id, service_desk_id);

-- Users: tenant + role (role-based queries)
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users (tenant_id, agent_team);

-- Notifications: tenant + read status (inbox queries)
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_read ON notifications (tenant_id, read_at);

-- Credit applications: tenant + status
CREATE INDEX IF NOT EXISTS idx_credit_applications_tenant_status ON credit_applications (tenant_id, status);

-- CRM leads: tenant + status
CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant_status ON crm_leads (tenant_id, status);
-- CRM opportunities: tenant + stage
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_tenant_stage ON crm_opportunities (tenant_id, stage);

-- Audit log: tenant + created (chronological queries)
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs (tenant_id, created_at DESC);

-- Knowledge base: tenant + published
CREATE INDEX IF NOT EXISTS idx_knowledge_base_articles_tenant_published ON kb_articles (tenant_id, is_published);

-- =====================================================
-- 4. P2-09: Tenant-local unique constraints
-- =====================================================

-- Drop global unique constraints that conflict with multi-tenancy
ALTER TABLE service_desks DROP CONSTRAINT IF EXISTS service_desks_name_key;
ALTER TABLE service_desks DROP CONSTRAINT IF EXISTS service_desks_code_key;
ALTER TABLE request_types DROP CONSTRAINT IF EXISTS request_types_code_key;
ALTER TABLE feature_flags DROP CONSTRAINT IF EXISTS feature_flags_key_key;
ALTER TABLE request_counters DROP CONSTRAINT IF EXISTS request_counters_prefix_key;

-- Add tenant_id column to request_counters (new column for P2-06)
ALTER TABLE request_counters ADD COLUMN IF NOT EXISTS tenant_id UUID;
CREATE INDEX IF NOT EXISTS idx_request_counters_tenant_id ON request_counters (tenant_id);

-- Add tenant-local composite unique constraints
ALTER TABLE service_desks ADD CONSTRAINT service_desks_tenant_name_unique UNIQUE (tenant_id, name);
ALTER TABLE service_desks ADD CONSTRAINT service_desks_tenant_code_unique UNIQUE (tenant_id, code);
ALTER TABLE request_types ADD CONSTRAINT request_types_tenant_code_unique UNIQUE (tenant_id, code);
ALTER TABLE request_counters ADD CONSTRAINT request_counters_tenant_prefix_unique UNIQUE (tenant_id, prefix);

-- FeatureFlag: partial unique indexes (can't express in Prisma)
-- Global flags: exactly one per key where tenant_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_flags_global_key
  ON feature_flags (key) WHERE tenant_id IS NULL;

-- Tenant-local flags: one per key per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_flags_tenant_key
  ON feature_flags (tenant_id, key) WHERE tenant_id IS NOT NULL;