-- Migration: Fix EWS relation names for covenant/condition back-references
-- No schema changes needed, just Prisma schema relation naming consistency
-- (The DB structure is unchanged, these are implicit relations via FK already present)

-- This is a no-op migration to sync the Prisma schema with the existing DB state
-- The FK columns (covenant_id, condition_id) already exist on early_warning_signals