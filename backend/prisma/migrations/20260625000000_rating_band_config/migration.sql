-- CreateTable: rating_band_configs
CREATE TABLE "rating_band_configs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "score_min" INTEGER NOT NULL,
  "score_max" INTEGER NOT NULL,
  "rating" "RiskRating" NOT NULL,
  "risk_category" VARCHAR(50) NOT NULL,
  "effective_from" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effective_to" TIMESTAMP(6),
  "version" INTEGER NOT NULL DEFAULT 1,
  "approved_by_id" UUID,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rating_band_configs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rating_band_configs_effective_from_effective_to_idx" ON "rating_band_configs"("effective_from", "effective_to");
CREATE INDEX "rating_band_configs_rating_idx" ON "rating_band_configs"("rating");

ALTER TABLE "rating_band_configs" ADD CONSTRAINT "rating_band_configs_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;