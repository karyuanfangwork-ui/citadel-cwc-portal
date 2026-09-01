-- CreateTable: risk_factor_matrices
CREATE TABLE "risk_factor_matrices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "factor" VARCHAR(50) NOT NULL,
  "weight" DECIMAL(5,2) NOT NULL,
  "threshold" VARCHAR(100),
  "reason_codes" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "effective_from" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effective_to" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "risk_factor_matrices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "risk_factor_matrices_factor_is_active_idx" ON "risk_factor_matrices"("factor", "is_active");

-- AlterTable: add weighted risk engine fields to risk_assessments
ALTER TABLE "risk_assessments" ADD COLUMN "factor_scores" JSONB,
ADD COLUMN "weighted_score" DECIMAL(10,2),
ADD COLUMN "risk_level" VARCHAR(20),
ADD COLUMN "reason_codes" JSONB;