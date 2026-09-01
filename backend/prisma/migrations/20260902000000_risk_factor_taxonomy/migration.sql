-- CA-P3-004 / GAP-P1-08 — enforce the canonical scored-risk taxonomy.
-- Existing conforming rows are unaffected; no column is dropped, renamed, or
-- made NOT NULL.
DO $$
DECLARE
  bad_count INTEGER;
  bad_values TEXT;
BEGIN
  SELECT COUNT(*), string_agg(DISTINCT factor, ', ')
    INTO bad_count, bad_values
    FROM "risk_factor_matrices"
   WHERE factor NOT IN ('APPLICANT', 'INDUSTRY', 'PRODUCT', 'DOCUMENTATION', 'BEHAVIOUR', 'FRAUD');

  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'CA-P3-004: % risk_factor_matrices row(s) carry a non-canonical factor (%). Correct or deactivate them, then re-run this migration.',
      bad_count, bad_values;
  END IF;
END $$;

ALTER TABLE "risk_factor_matrices"
  ADD CONSTRAINT "risk_factor_matrices_factor_check"
  CHECK (factor IN ('APPLICANT', 'INDUSTRY', 'PRODUCT', 'DOCUMENTATION', 'BEHAVIOUR', 'FRAUD'));
