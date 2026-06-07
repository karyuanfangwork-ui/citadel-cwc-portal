-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "region" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateTable
CREATE TABLE "credit_sla_policy_branch_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "policy_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "sla_hours" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "credit_sla_policy_branch_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_sla_policy_branch_overrides_policy_id_branch_id_key" ON "credit_sla_policy_branch_overrides"("policy_id", "branch_id");

-- AddForeignKey
ALTER TABLE "credit_sla_policy_branch_overrides" ADD CONSTRAINT "credit_sla_policy_branch_overrides_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "credit_sla_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_sla_policy_branch_overrides" ADD CONSTRAINT "credit_sla_policy_branch_overrides_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: credit_applications
ALTER TABLE "credit_applications" ADD COLUMN "branch_id" UUID;
CREATE INDEX "credit_applications_branch_id_idx" ON "credit_applications"("branch_id");
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: borrower_profiles
ALTER TABLE "borrower_profiles" ADD COLUMN "branch_id" UUID;
CREATE INDEX "borrower_profiles_branch_id_idx" ON "borrower_profiles"("branch_id");
ALTER TABLE "borrower_profiles" ADD CONSTRAINT "borrower_profiles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: credit_approval_matrices
ALTER TABLE "credit_approval_matrices" ADD COLUMN "branch_id" UUID;
CREATE INDEX "credit_approval_matrices_branch_id_idx" ON "credit_approval_matrices"("branch_id");
ALTER TABLE "credit_approval_matrices" ADD CONSTRAINT "credit_approval_matrices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: users
ALTER TABLE "users" ADD COLUMN "branch_id" UUID;
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
