-- ======================================================================
-- Migration: Add credit:create permission for SOD-compliant application origination
-- Date: 2026-06-01
-- Reference: §2.6 — Only CREDIT_RM and ADMIN roles should originate credit applications
--
-- This migration is IDEMPOTENT — safe to re-run on any environment.
-- It will:
--   1. Create the credit:create permission (upsert)
--   2. Assign it to ADMIN, CREDIT_ADMIN, and CREDIT_RM roles
--   3. Revoke it from any role that should NOT have it (SOD enforcement)
--
-- Run with: npx prisma db execute --file prisma/migrations/20260601000000_add_credit_create_permission.sql
-- ======================================================================

-- 1. Upsert the credit:create permission
INSERT INTO permissions (id, name, resource, action, description)
VALUES (
  gen_random_uuid(),
  'credit:create',
  'credit',
  'create',
  'Create new credit applications — restricted to RM and ADMIN (maker role only)'
) ON CONFLICT (name) DO NOTHING;

-- 2. Assign credit:create to ADMIN role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'ADMIN' AND p.name = 'credit:create'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3. Assign credit:create to CREDIT_ADMIN role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'CREDIT_ADMIN' AND p.name = 'credit:create'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Assign credit:create to CREDIT_RM role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'CREDIT_RM' AND p.name = 'credit:create'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 5. Revoke credit:create from roles that should NOT have it (SOD enforcement)
-- Only ADMIN, CREDIT_ADMIN, and CREDIT_RM are allowed to originate applications.
DELETE FROM role_permissions
WHERE permission_id = (SELECT id FROM permissions WHERE name = 'credit:create')
  AND role_id NOT IN (
    SELECT id FROM roles WHERE name IN ('ADMIN', 'CREDIT_ADMIN', 'CREDIT_RM')
  );