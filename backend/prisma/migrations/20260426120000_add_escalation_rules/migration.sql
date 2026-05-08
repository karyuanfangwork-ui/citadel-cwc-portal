-- CreateTable
CREATE TABLE "escalation_rules" (
    "id" UUID NOT NULL,
    "request_type_id" UUID NOT NULL,
    "trigger_hours_after_breach" INTEGER NOT NULL,
    "notify_roles" TEXT[],
    "label" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "escalation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "escalation_rules_request_type_id_idx" ON "escalation_rules"("request_type_id");

-- AddForeignKey
ALTER TABLE "escalation_rules" ADD CONSTRAINT "escalation_rules_request_type_id_fkey" FOREIGN KEY ("request_type_id") REFERENCES "request_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
