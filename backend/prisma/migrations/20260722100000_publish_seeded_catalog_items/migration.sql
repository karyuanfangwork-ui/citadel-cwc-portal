-- P03 Task 13 compatibility backfill.
-- These five active catalog items are seed-owned defaults that predate catalog
-- lifecycle governance and were unintentionally left in DRAFT state.
UPDATE "request_types"
SET "lifecycle_status" = 'PUBLISHED'
WHERE "is_active" = TRUE
  AND "lifecycle_status" = 'DRAFT'
  AND "code" IN (
      'GET_IT_HELP',
      'EMAIL_MANAGEMENT',
      'REPORT_SYSTEM_PROBLEM',
      'SOFTWARE_INSTALLATION',
      'NEW_HARDWARE'
  );
