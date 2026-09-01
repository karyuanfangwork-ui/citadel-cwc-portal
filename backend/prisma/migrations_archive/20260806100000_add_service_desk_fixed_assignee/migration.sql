-- AlterTable: add optional fixed assignee to ServiceDesk
-- When the assigned user is deleted, set the field to NULL (safe degradation).
ALTER TABLE "service_desks" ADD COLUMN "auto_assign_user_id" UUID;

-- CreateIndex: speed lookups by fixed assignee
CREATE INDEX "service_desks_auto_assign_user_id_idx" ON "service_desks"("auto_assign_user_id");

-- ForeignKey: reference users with SET NULL on delete
ALTER TABLE "service_desks" ADD CONSTRAINT "service_desks_auto_assign_user_id_fkey"
  FOREIGN KEY ("auto_assign_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;