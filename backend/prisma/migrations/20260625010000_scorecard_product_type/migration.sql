-- AlterTable: add productType to credit_scorecards
ALTER TABLE "credit_scorecards" ADD COLUMN "product_type" "CreditProductType";

CREATE INDEX "credit_scorecards_product_type_idx" ON "credit_scorecards"("product_type");