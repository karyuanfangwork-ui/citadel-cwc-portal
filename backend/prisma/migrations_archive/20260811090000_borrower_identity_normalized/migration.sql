-- LOS-017 — Canonical identity columns for duplicate matching.
--
-- checkDuplicateEnhanced reached registration numbers and NRICs only through
-- CRM links, so a borrower created without CRM linkage was matched on name
-- alone. These columns hold the canonical form (uppercase, alphanumeric only)
-- of the profile's OWN identity fields.
--
-- Deliberately NOT unique: existing data may already contain duplicates, and a
-- unique constraint would fail the migration and block writes. Enforcement is
-- at the service layer, which can offer a governed override; these indexes make
-- that check cheap.

ALTER TABLE borrower_profiles
  ADD COLUMN IF NOT EXISTS registration_number_normalized VARCHAR(64),
  ADD COLUMN IF NOT EXISTS nric_passport_normalized VARCHAR(64);

-- Backfill using the same rule as normalizeIdentity(): strip non-alphanumerics,
-- uppercase, and null out anything shorter than 6 characters.
UPDATE borrower_profiles
SET registration_number_normalized = NULLIF(
      CASE WHEN length(regexp_replace(upper(registration_number), '[^A-Z0-9]', '', 'g')) >= 6
           THEN regexp_replace(upper(registration_number), '[^A-Z0-9]', '', 'g')
           ELSE '' END, '')
WHERE registration_number IS NOT NULL;

UPDATE borrower_profiles
SET nric_passport_normalized = NULLIF(
      CASE WHEN length(regexp_replace(upper(nric_passport), '[^A-Z0-9]', '', 'g')) >= 6
           THEN regexp_replace(upper(nric_passport), '[^A-Z0-9]', '', 'g')
           ELSE '' END, '')
WHERE nric_passport IS NOT NULL;

CREATE INDEX IF NOT EXISTS "borrower_profiles_registration_number_normalized_idx"
  ON borrower_profiles (registration_number_normalized);
CREATE INDEX IF NOT EXISTS "borrower_profiles_nric_passport_normalized_idx"
  ON borrower_profiles (nric_passport_normalized);