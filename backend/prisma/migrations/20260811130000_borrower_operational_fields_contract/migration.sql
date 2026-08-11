-- Credit borrower operational identity contract phase.
-- This migration intentionally fails closed when the expand/backfill
-- reconciliation has not produced a complete, unique dataset.

DO $$
DECLARE
  missing_count INTEGER;
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM borrower_profiles
  WHERE borrower_number IS NULL
     OR segment IS NULL
     OR lifecycle_status IS NULL;

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Borrower operational backfill incomplete: % rows still have null contract fields', missing_count;
  END IF;

  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT borrower_number
    FROM borrower_profiles
    GROUP BY borrower_number
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Borrower operational backfill incomplete: % duplicate borrower numbers detected', duplicate_count;
  END IF;
END $$;

ALTER TABLE borrower_profiles
  ALTER COLUMN borrower_number SET NOT NULL,
  ALTER COLUMN segment SET NOT NULL,
  ALTER COLUMN lifecycle_status SET NOT NULL;

ALTER SEQUENCE borrower_number_seq OWNED BY NONE;
