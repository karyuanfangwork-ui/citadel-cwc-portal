-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RequestStatus" ADD VALUE 'ONBOARDING_SUBMITTED';
ALTER TYPE "RequestStatus" ADD VALUE 'ONBOARDING_PENDING_HR_APPROVAL';
ALTER TYPE "RequestStatus" ADD VALUE 'ONBOARDING_PRE_ARRIVAL_SETUP';
ALTER TYPE "RequestStatus" ADD VALUE 'ONBOARDING_READY_FOR_DAY_1';
ALTER TYPE "RequestStatus" ADD VALUE 'ONBOARDING_DAY_1_ORIENTATION';
ALTER TYPE "RequestStatus" ADD VALUE 'ONBOARDING_WEEK_1_INTEGRATION';
ALTER TYPE "RequestStatus" ADD VALUE 'ONBOARDING_MONTH_1_MILESTONE';
ALTER TYPE "RequestStatus" ADD VALUE 'ONBOARDING_MONTH_2_MILESTONE';
ALTER TYPE "RequestStatus" ADD VALUE 'ONBOARDING_MONTH_3_MILESTONE';
ALTER TYPE "RequestStatus" ADD VALUE 'ONBOARDING_COMPLETED';

-- CreateTable
CREATE TABLE "onboarding_requests" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "new_hire_id" UUID,
    "new_hire_first_name" VARCHAR(100) NOT NULL,
    "new_hire_last_name" VARCHAR(100) NOT NULL,
    "new_hire_email" VARCHAR(255) NOT NULL,
    "new_hire_phone" VARCHAR(20),
    "job_title" VARCHAR(200) NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "hiring_manager_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "employment_type" VARCHAR(50) NOT NULL,
    "overall_status" VARCHAR(50) NOT NULL,
    "current_phase" VARCHAR(50) NOT NULL,
    "it_account_created" BOOLEAN NOT NULL DEFAULT false,
    "email_setup" BOOLEAN NOT NULL DEFAULT false,
    "hardware_assigned" BOOLEAN NOT NULL DEFAULT false,
    "access_badge_ready" BOOLEAN NOT NULL DEFAULT false,
    "i9_completed" BOOLEAN NOT NULL DEFAULT false,
    "w4_completed" BOOLEAN NOT NULL DEFAULT false,
    "benefits_enrolled" BOOLEAN NOT NULL DEFAULT false,
    "policies_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "orientation_completed" BOOLEAN NOT NULL DEFAULT false,
    "training_scheduled" BOOLEAN NOT NULL DEFAULT false,
    "buddy_assigned" UUID,
    "day1_completed" TIMESTAMP(6),
    "week1_completed" TIMESTAMP(6),
    "day30_completed" TIMESTAMP(6),
    "day60_completed" TIMESTAMP(6),
    "day90_completed" TIMESTAMP(6),
    "completed_by" UUID,
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "onboarding_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_tasks" (
    "id" UUID NOT NULL,
    "onboarding_id" UUID NOT NULL,
    "task_name" VARCHAR(200) NOT NULL,
    "task_description" TEXT,
    "task_category" VARCHAR(50) NOT NULL,
    "assigned_to" UUID,
    "due_date" DATE,
    "priority" VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "completed_by" UUID,
    "completed_at" TIMESTAMP(6),
    "notes" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "onboarding_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_requests_request_id_key" ON "onboarding_requests"("request_id");

-- CreateIndex
CREATE INDEX "onboarding_requests_request_id_idx" ON "onboarding_requests"("request_id");

-- CreateIndex
CREATE INDEX "onboarding_requests_new_hire_id_idx" ON "onboarding_requests"("new_hire_id");

-- CreateIndex
CREATE INDEX "onboarding_requests_start_date_idx" ON "onboarding_requests"("start_date");

-- CreateIndex
CREATE INDEX "onboarding_tasks_onboarding_id_idx" ON "onboarding_tasks"("onboarding_id");

-- CreateIndex
CREATE INDEX "onboarding_tasks_assigned_to_idx" ON "onboarding_tasks"("assigned_to");

-- CreateIndex
CREATE INDEX "onboarding_tasks_status_idx" ON "onboarding_tasks"("status");

-- AddForeignKey
ALTER TABLE "onboarding_requests" ADD CONSTRAINT "onboarding_requests_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_requests" ADD CONSTRAINT "onboarding_requests_hiring_manager_id_fkey" FOREIGN KEY ("hiring_manager_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_requests" ADD CONSTRAINT "onboarding_requests_new_hire_id_fkey" FOREIGN KEY ("new_hire_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_requests" ADD CONSTRAINT "onboarding_requests_buddy_assigned_fkey" FOREIGN KEY ("buddy_assigned") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_requests" ADD CONSTRAINT "onboarding_requests_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_onboarding_id_fkey" FOREIGN KEY ("onboarding_id") REFERENCES "onboarding_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
