-- Migration: Add CreditFxRate model for FX-aware exposure aggregation (§F23)
-- CreateTable
CREATE TABLE "credit_fx_rates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "currency" TEXT NOT NULL,
    "rate_to_base" DECIMAL(18,8) NOT NULL,
    "effective_date" TIMESTAMP(6) NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT NOW(),

    CONSTRAINT "credit_fx_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_fx_rates_currency_effective_date_key" ON "credit_fx_rates"("currency", "effective_date");

-- CreateIndex
CREATE INDEX "credit_fx_rates_currency_effective_date_idx" ON "credit_fx_rates"("currency", "effective_date" DESC);

-- AddForeignKey
ALTER TABLE "credit_fx_rates" ADD CONSTRAINT "credit_fx_rates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;