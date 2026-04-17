-- AddColumn: parent_request_id on requests (self-referential link for spawned tickets)
ALTER TABLE "requests" ADD COLUMN "parent_request_id" UUID;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_parent_request_id_fkey" FOREIGN KEY ("parent_request_id") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
