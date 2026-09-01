-- Migration: WorkflowStep.status — recognize existing RequestStatus enum in Prisma schema
-- The database column is already RequestStatus enum (applied by prior migration 20260605000000_rename_group_ceo_to_group_dceo).
-- This migration is a no-op at the DB level; it exists solely to bring Prisma's migration history in sync
-- with the schema change: WorkflowStep.status from String @db.VarChar(100) → RequestStatus.

-- No SQL changes needed — the column is already RequestStatus type.
-- Prisma requires this placeholder to acknowledge the schema diff.