-- ============================================================================
-- Migration: Clear All Ticket Requests
-- Description: Removes all ticket requests and related data from the database
-- Date: 2025-01-24
-- ============================================================================

-- IMPORTANT: Run this in your local development database only
-- This will permanently delete ALL ticket requests

BEGIN;

-- ============================================================================
-- Step 1: Delete nested child records
-- ============================================================================

-- Offboarding tasks (depends on offboarding_requests)
DELETE FROM offboarding_tasks;

-- Onboarding tasks (depends on onboarding_requests)
DELETE FROM onboarding_tasks;

-- Expense line items (depends on finance_expense_reimbursements & request_attachments)
DELETE FROM expense_line_items;

-- Interview schedules (depends on candidate_resumes)
DELETE FROM interview_schedules;

-- ============================================================================
-- Step 2: Delete request-related records with FK to requests
-- ============================================================================

-- Interview feedbacks
DELETE FROM interview_feedbacks;

-- HR screenings
DELETE FROM hr_screenings;

-- Letters of acceptance
DELETE FROM letters_of_acceptance;

-- Candidate resumes
DELETE FROM candidate_resumes;

-- Request approvals
DELETE FROM request_approvals;

-- Request activities (has attachments cascade)
DELETE FROM request_activities;

-- Request attachments
DELETE FROM request_attachments;

-- ============================================================================
-- Step 3: Delete request subtype tables (all have FK to requests)
-- ============================================================================

-- IT Hardware requests
DELETE FROM it_hardware_requests;

-- HR Leave requests
DELETE FROM hr_leave_requests;

-- Finance Expense Reimbursements
DELETE FROM finance_expense_reimbursements;

-- Onboarding requests
DELETE FROM onboarding_requests;

-- Offboarding requests
DELETE FROM offboarding_requests;

-- ============================================================================
-- Step 4: Delete notifications related to requests
-- ============================================================================

DELETE FROM notifications WHERE related_request_id IS NOT NULL;

-- ============================================================================
-- Step 5: Finally, delete all requests
-- ============================================================================

DELETE FROM requests;

-- ============================================================================
-- Verification - should all return 0
-- ============================================================================

SELECT 'requests' AS table_name, COUNT(*) AS count FROM requests
UNION ALL
SELECT 'request_activities', COUNT(*) FROM request_activities
UNION ALL
SELECT 'request_attachments', COUNT(*) FROM request_attachments
UNION ALL
SELECT 'request_approvals', COUNT(*) FROM request_approvals
UNION ALL
SELECT 'it_hardware_requests', COUNT(*) FROM it_hardware_requests
UNION ALL
SELECT 'hr_leave_requests', COUNT(*) FROM hr_leave_requests
UNION ALL
SELECT 'finance_expense_reimbursements', COUNT(*) FROM finance_expense_reimbursements
UNION ALL
SELECT 'onboarding_requests', COUNT(*) FROM onboarding_requests
UNION ALL
SELECT 'offboarding_requests', COUNT(*) FROM offboarding_requests;

COMMIT;

-- ============================================================================
-- Optional: Reset sequences if you want IDs to start from 1 again
-- Uncomment the following block if needed
-- ============================================================================

/*
-- Reset sequences for request-related tables
SELECT setval('requests_id_seq', 1, false);
SELECT setval('request_activities_id_seq', 1, false);
SELECT setval('request_attachments_id_seq', 1, false);
SELECT setval('request_approvals_id_seq', 1, false);
SELECT setval('it_hardware_requests_id_seq', 1, false);
SELECT setval('hr_leave_requests_id_seq', 1, false);
SELECT setval('finance_expense_reimbursements_id_seq', 1, false);
SELECT setval('onboarding_requests_id_seq', 1, false);
SELECT setval('offboarding_requests_id_seq', 1, false);
*/