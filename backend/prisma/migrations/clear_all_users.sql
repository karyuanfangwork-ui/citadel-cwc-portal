-- ============================================================================
-- Migration: Clear All Users
-- Description: Removes all users and related data from the database
-- Date: 2025-01-24
-- ============================================================================

-- This will clear all users so seed can regenerate fresh accounts

BEGIN;

-- ============================================================================
-- Step 1: Clear junction tables and dependent records
-- ============================================================================

-- User roles junction table
DELETE FROM user_roles;

-- Sessions
DELETE FROM sessions;

-- Password reset tokens
DELETE FROM password_reset_tokens;

-- Notifications
DELETE FROM notifications;

-- Audit logs (user_id is nullable, so these can stay, but let's clear user references)
DELETE FROM audit_logs WHERE user_id IS NOT NULL;

-- Knowledge base articles (author_id is nullable)
UPDATE kb_articles SET author_id = NULL WHERE author_id IS NOT NULL;

-- Request approvals (approver_id is nullable)
UPDATE request_approvals SET approver_id = NULL WHERE approver_id IS NOT NULL;

-- ============================================================================
-- Step 2: Clear remaining user-dependent records from cleared requests
-- ============================================================================

-- These should already be empty from clear_all_requests.sql, but ensure they're clear
DELETE FROM request_activities WHERE author_id IS NOT NULL;
DELETE FROM request_attachments WHERE uploaded_by_id IS NOT NULL;
DELETE FROM candidate_resumes WHERE uploaded_by_id IS NOT NULL;
DELETE FROM interview_schedules WHERE scheduled_by IS NOT NULL;
DELETE FROM interview_feedbacks WHERE submitted_by IS NOT NULL;
DELETE FROM hr_screenings WHERE completed_by IS NOT NULL;
DELETE FROM letters_of_acceptance WHERE uploaded_by IS NOT NULL OR approved_by IS NOT NULL;
DELETE FROM it_hardware_requests WHERE manager_approved_by_id IS NOT NULL;
DELETE FROM onboarding_requests WHERE hiring_manager_id IS NOT NULL OR new_hire_id IS NOT NULL OR completed_by IS NOT NULL;
DELETE FROM onboarding_tasks WHERE assigned_to IS NOT NULL OR completed_by IS NOT NULL;
DELETE FROM offboarding_requests WHERE manager_id IS NOT NULL OR employee_id IS NOT NULL OR completed_by IS NOT NULL;
DELETE FROM offboarding_tasks WHERE assigned_to IS NOT NULL OR completed_by IS NOT NULL;

-- ============================================================================
-- Step 3: Finally, delete all users
-- ============================================================================

DELETE FROM users;

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 'users' AS table_name, COUNT(*) AS count FROM users
UNION ALL
SELECT 'user_roles', COUNT(*) FROM user_roles
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications;

COMMIT;