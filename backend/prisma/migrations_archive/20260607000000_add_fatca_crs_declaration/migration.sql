-- CreateEnum
CREATE TYPE "FatcaEntityClassification" AS ENUM ('INDIVIDUAL', 'ACTIVE_NFE', 'PASSIVE_NFE', 'FINANCIAL_INSTITUTION');

-- CreateTable
CREATE TABLE "fatca_crs_declarations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "borrower_profile_id" UUID NOT NULL,
    "declaration_date" DATE NOT NULL,
    "is_us_person" BOOLEAN NOT NULL,
    "us_tin_encrypted" VARCHAR(255),
    "entity_classification" "FatcaEntityClassification" NOT NULL,
    "crs_residencies" JSONB NOT NULL,
    "self_certified_by_id" UUID NOT NULL,
    "verified_by_id" UUID,
    "verified_at" TIMESTAMP(6),
    "expiry_date" DATE,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "fatca_crs_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fatca_crs_declarations_borrower_profile_id_idx" ON "fatca_crs_declarations"("borrower_profile_id");

-- AddForeignKey
ALTER TABLE "fatca_crs_declarations" ADD CONSTRAINT "fatca_crs_declarations_borrower_profile_id_fkey" FOREIGN KEY ("borrower_profile_id") REFERENCES "borrower_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fatca_crs_declarations" ADD CONSTRAINT "fatca_crs_declarations_self_certified_by_id_fkey" FOREIGN KEY ("self_certified_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fatca_crs_declarations" ADD CONSTRAINT "fatca_crs_declarations_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
