-- CA Memo Phase 1 — Header & narrative fields on credit_applications
-- All additive: new nullable columns + new enums. Safe to run on populated tables.

-- CreateEnum
CREATE TYPE "ApplicationType" AS ENUM ('NEW', 'ADDITIONAL', 'RENEWAL', 'VARIATION');

-- CreateEnum
CREATE TYPE "AccountClassification" AS ENUM ('PERFORMING', 'EARLY_CARE', 'WATCHLIST', 'NON_CCRIS_RR', 'CCRIS_RR', 'IMPAIRED');

-- CreateEnum
CREATE TYPE "AccountStrategy" AS ENUM ('GROW', 'MAINTAIN', 'EXIT');

-- AlterTable
ALTER TABLE "credit_applications"
  ADD COLUMN "customer_group_name"          VARCHAR(255),
  ADD COLUMN "cif_no"                       VARCHAR(50),
  ADD COLUMN "application_type"             "ApplicationType",
  ADD COLUMN "originating_department"       VARCHAR(150),
  ADD COLUMN "team_lead_name"               VARCHAR(150),
  ADD COLUMN "referred_by"                  VARCHAR(255),
  ADD COLUMN "account_classification"       "AccountClassification",
  ADD COLUMN "connected_party_flag"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "connected_party_staff_name"   VARCHAR(255),
  ADD COLUMN "complete_docs_date"           DATE,
  ADD COLUMN "last_review_date"             DATE,
  ADD COLUMN "next_review_date"             DATE,
  ADD COLUMN "relationship_since"           DATE,
  ADD COLUMN "last_site_visit_date"         DATE,
  ADD COLUMN "preamble_text"                TEXT,
  ADD COLUMN "matters_to_highlight"         TEXT,
  ADD COLUMN "transaction_details_text"     TEXT,
  ADD COLUMN "account_strategy"             "AccountStrategy",
  ADD COLUMN "cross_selling_initiatives"    TEXT;
