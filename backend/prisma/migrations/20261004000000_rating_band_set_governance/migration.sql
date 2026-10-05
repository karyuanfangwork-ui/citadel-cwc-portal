CREATE TABLE "rating_band_sets" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "reason" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID NOT NULL,
    "submitted_by_id" UUID,
    "approved_by_id" UUID,
    "activated_by_id" UUID,
    "policy_approval_reference" VARCHAR(200),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(6),
    "approved_at" TIMESTAMP(6),
    "activated_at" TIMESTAMP(6),
    "effective_from" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(6),

    CONSTRAINT "rating_band_sets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rating_band_sets_name_version_key"
    ON "rating_band_sets"("name", "version");
CREATE INDEX "rating_band_sets_status_effective_from_effective_to_idx"
    ON "rating_band_sets"("status", "effective_from", "effective_to");

ALTER TABLE "rating_band_configs"
    ADD COLUMN "band_set_id" UUID;
CREATE INDEX "rating_band_configs_band_set_id_idx"
    ON "rating_band_configs"("band_set_id");
ALTER TABLE "rating_band_configs"
    ADD CONSTRAINT "rating_band_configs_band_set_id_fkey"
    FOREIGN KEY ("band_set_id") REFERENCES "rating_band_sets"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
