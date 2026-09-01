-- AlterTable: Add borrower profile identity fields
ALTER TABLE "borrower_profiles"
  ADD COLUMN "registration_number" VARCHAR(100),
  ADD COLUMN "industry" VARCHAR(100),
  ADD COLUMN "nric_passport" VARCHAR(50),
  ADD COLUMN "address" VARCHAR(500),
  ADD COLUMN "phone" VARCHAR(50),
  ADD COLUMN "email" VARCHAR(255);
