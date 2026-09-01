-- CreateEnum
CREATE TYPE "RuleConfigKind" AS ENUM ('REQUIRED_DOCUMENT', 'REQUIRED_FIELD');

-- CreateTable
CREATE TABLE "credit_rule_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kind" "RuleConfigKind" NOT NULL,
    "product_type" "CreditProductType",
    "lane" "ProcessingLane",
    "borrower_type" "BorrowerType",
    "document_class" "DocumentClass",
    "document_label" VARCHAR(255),
    "field_path" VARCHAR(255),
    "field_label" VARCHAR(255),
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "credit_rule_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_rule_configs_kind_is_active_idx" ON "credit_rule_configs"("kind", "is_active");
CREATE INDEX "credit_rule_configs_product_type_lane_borrower_type_idx" ON "credit_rule_configs"("product_type", "lane", "borrower_type");
