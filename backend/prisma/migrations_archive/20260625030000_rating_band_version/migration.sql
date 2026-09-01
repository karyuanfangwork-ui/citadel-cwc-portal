-- AlterTable: add ratingBandVersion to credit_score_runs and borrower_risk_runs
ALTER TABLE "credit_score_runs" ADD COLUMN "rating_band_version" INTEGER;
ALTER TABLE "borrower_risk_runs" ADD COLUMN "rating_band_version" INTEGER;