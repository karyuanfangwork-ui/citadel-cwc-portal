-- Credit borrower operational identity foundation.
-- Expand phase: columns remain nullable so existing borrowers can be backfilled
-- transactionally by prisma/backfill-borrower-operational-fields.ts before the
-- contract phase makes the operational fields mandatory.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BorrowerSegment') THEN
    CREATE TYPE "BorrowerSegment" AS ENUM ('INDIVIDUAL', 'SME', 'CORPORATE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BorrowerLifecycleStatus') THEN
    CREATE TYPE "BorrowerLifecycleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS borrower_number_seq START WITH 1 INCREMENT BY 1;

ALTER TABLE borrower_profiles
  ADD COLUMN IF NOT EXISTS borrower_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS segment "BorrowerSegment",
  ADD COLUMN IF NOT EXISTS lifecycle_status "BorrowerLifecycleStatus" DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS relationship_owner_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "borrower_profiles_borrower_number_key"
  ON borrower_profiles (borrower_number);
CREATE INDEX IF NOT EXISTS "borrower_profiles_segment_idx"
  ON borrower_profiles (segment);
CREATE INDEX IF NOT EXISTS "borrower_profiles_lifecycle_status_idx"
  ON borrower_profiles (lifecycle_status);
CREATE INDEX IF NOT EXISTS "borrower_profiles_relationship_owner_id_idx"
  ON borrower_profiles (relationship_owner_id);
CREATE INDEX IF NOT EXISTS "borrower_profiles_segment_lifecycle_status_idx"
  ON borrower_profiles (segment, lifecycle_status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'borrower_profiles_relationship_owner_id_fkey'
  ) THEN
    ALTER TABLE borrower_profiles
      ADD CONSTRAINT borrower_profiles_relationship_owner_id_fkey
      FOREIGN KEY (relationship_owner_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
