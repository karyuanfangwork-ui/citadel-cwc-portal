-- Prevent concurrent requests from creating multiple active exceptions for
-- the same draft and canonical identity. REJECTED/EXPIRED/CONSUMED history
-- remains allowed.
CREATE UNIQUE INDEX IF NOT EXISTS borrower_duplicate_exceptions_active_identity_uidx
  ON borrower_duplicate_exceptions (draft_id, identity_fingerprint)
  WHERE status IN ('PENDING', 'APPROVED');
