-- AddBorrowerProfileFields
-- Adds type-specific fields to borrower_profiles for the borrower creation wizard.
-- All columns are nullable — no data backfill needed.

ALTER TABLE "borrower_profiles"
  ADD COLUMN "date_of_birth" DATE,
  ADD COLUMN "date_of_incorporation" DATE,
  ADD COLUMN "business_nature" VARCHAR(500),
  ADD COLUMN "business_type" VARCHAR(50),
  ADD COLUMN "authorized_representative" VARCHAR(255),
  ADD COLUMN "preferred_name" VARCHAR(100),
  ADD COLUMN "marital_status" VARCHAR(30),
  ADD COLUMN "education_level" VARCHAR(50),
  ADD COLUMN "tax_number" VARCHAR(50),
  ADD COLUMN "office_phone" VARCHAR(50),
  ADD COLUMN "preferred_contact_method" VARCHAR(20),
  ADD COLUMN "mailing_address" VARCHAR(500);