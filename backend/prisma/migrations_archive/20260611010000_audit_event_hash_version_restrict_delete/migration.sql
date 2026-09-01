-- DropForeignKey
ALTER TABLE "credit_audit_events" DROP CONSTRAINT "credit_audit_events_application_id_fkey";

-- AlterTable
ALTER TABLE "credit_audit_events" ADD COLUMN "hash_version" INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE "credit_audit_events" ADD CONSTRAINT "credit_audit_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;