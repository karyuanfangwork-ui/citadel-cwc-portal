CREATE TABLE "credit_rule_config_sets" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "version" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT NOT NULL,
    "policy_approval_reference" VARCHAR(200),
    "created_by_id" UUID NOT NULL,
    "submitted_by_id" UUID,
    "approved_by_id" UUID,
    "activated_by_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(6),
    "approved_at" TIMESTAMP(6),
    "activated_at" TIMESTAMP(6),
    "effective_from" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(6),

    CONSTRAINT "credit_rule_config_sets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "credit_rule_config_sets_name_version_key"
    ON "credit_rule_config_sets"("name", "version");
CREATE INDEX "credit_rule_config_sets_status_effective_from_effective_to_idx"
    ON "credit_rule_config_sets"("status", "effective_from", "effective_to");

ALTER TABLE "credit_rule_configs"
    ADD COLUMN "config_set_id" UUID;
CREATE INDEX "credit_rule_configs_config_set_id_idx"
    ON "credit_rule_configs"("config_set_id");
ALTER TABLE "credit_rule_configs"
    ADD CONSTRAINT "credit_rule_configs_config_set_id_fkey"
    FOREIGN KEY ("config_set_id") REFERENCES "credit_rule_config_sets"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
