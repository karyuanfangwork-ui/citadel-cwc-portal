-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RequestStatus" ADD VALUE 'PENDING_MANAGER_APPROVAL_IT';
ALTER TYPE "RequestStatus" ADD VALUE 'MANAGER_APPROVED_IT';
ALTER TYPE "RequestStatus" ADD VALUE 'MANAGER_REJECTED_IT';
ALTER TYPE "RequestStatus" ADD VALUE 'PROCUREMENT_IN_PROGRESS';
ALTER TYPE "RequestStatus" ADD VALUE 'HARDWARE_ORDERED';
ALTER TYPE "RequestStatus" ADD VALUE 'HARDWARE_RECEIVED';
ALTER TYPE "RequestStatus" ADD VALUE 'SOFTWARE_PROVISIONED';
ALTER TYPE "RequestStatus" ADD VALUE 'PENDING_MANAGER_APPROVAL_FIN';
ALTER TYPE "RequestStatus" ADD VALUE 'MANAGER_APPROVED_FIN';
ALTER TYPE "RequestStatus" ADD VALUE 'MANAGER_REJECTED_FIN';
ALTER TYPE "RequestStatus" ADD VALUE 'PENDING_FINANCE_HEAD_APPROVAL';
ALTER TYPE "RequestStatus" ADD VALUE 'FINANCE_HEAD_APPROVED';
ALTER TYPE "RequestStatus" ADD VALUE 'FINANCE_HEAD_REJECTED';
ALTER TYPE "RequestStatus" ADD VALUE 'PAYMENT_PROCESSING';
ALTER TYPE "RequestStatus" ADD VALUE 'PAYMENT_COMPLETED';
ALTER TYPE "RequestStatus" ADD VALUE 'REIMBURSEMENT_CLOSED';

-- AlterTable
ALTER TABLE "request_status_definitions" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "onboarding_task_templates" (
    "id" UUID NOT NULL,
    "task_name" VARCHAR(200) NOT NULL,
    "task_description" TEXT,
    "task_category" VARCHAR(50) NOT NULL,
    "priority" VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    "due_day_offset" INTEGER NOT NULL DEFAULT 0,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "onboarding_task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "onboarding_task_templates_task_category_idx" ON "onboarding_task_templates"("task_category");

-- CreateIndex
CREATE INDEX "onboarding_task_templates_is_active_idx" ON "onboarding_task_templates"("is_active");
