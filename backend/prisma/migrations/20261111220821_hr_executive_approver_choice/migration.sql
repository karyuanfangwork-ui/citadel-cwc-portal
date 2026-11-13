-- Additive HR recruitment requester choice. Existing requests remain unselected.
CREATE TYPE "HrExecutiveApproverRole" AS ENUM ('CEO', 'GROUP_DCEO');

ALTER TABLE "requests"
  ADD COLUMN "executive_approver_id" UUID,
  ADD COLUMN "executive_approver_role" "HrExecutiveApproverRole";

CREATE INDEX "requests_executive_approver_id_idx" ON "requests"("executive_approver_id");

ALTER TABLE "requests"
  ADD CONSTRAINT "requests_executive_approver_id_fkey"
  FOREIGN KEY ("executive_approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "requests"
  ADD CONSTRAINT "requests_executive_approver_choice_pair_check"
  CHECK (("executive_approver_id" IS NULL) = ("executive_approver_role" IS NULL));
