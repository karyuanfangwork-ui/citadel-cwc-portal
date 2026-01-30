-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RequestStatus" ADD VALUE 'INTERVIEW_SCHEDULED';
ALTER TYPE "RequestStatus" ADD VALUE 'INTERVIEW_FEEDBACK_PENDING';
ALTER TYPE "RequestStatus" ADD VALUE 'CANDIDATE_REJECTED_INTERVIEW';
ALTER TYPE "RequestStatus" ADD VALUE 'HR_SCREENING';
ALTER TYPE "RequestStatus" ADD VALUE 'LOA_PENDING_APPROVAL';
ALTER TYPE "RequestStatus" ADD VALUE 'LOA_APPROVED';
ALTER TYPE "RequestStatus" ADD VALUE 'LOA_ISSUED';
ALTER TYPE "RequestStatus" ADD VALUE 'LOA_ACCEPTED';

-- CreateTable
CREATE TABLE "interview_schedules" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "interview_date" DATE NOT NULL,
    "interview_time" VARCHAR(50) NOT NULL,
    "location" VARCHAR(100),
    "meeting_link" TEXT,
    "interviewers" TEXT NOT NULL,
    "notes" TEXT,
    "scheduled_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "interview_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_feedbacks" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "decision" VARCHAR(20) NOT NULL,
    "overall_rating" INTEGER,
    "technical_skills" INTEGER,
    "cultural_fit" INTEGER,
    "communication" INTEGER,
    "feedback" TEXT NOT NULL,
    "concerns" TEXT,
    "submitted_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "interview_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_screenings" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "background_check_status" VARCHAR(50) NOT NULL,
    "background_check_notes" TEXT,
    "references_check_status" VARCHAR(50) NOT NULL,
    "references_check_notes" TEXT,
    "references_contacted" TEXT,
    "overall_status" VARCHAR(50) NOT NULL,
    "completed_by" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "hr_screenings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "letters_of_acceptance" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "loa_file_url" TEXT NOT NULL,
    "loa_file_name" VARCHAR(255) NOT NULL,
    "loa_file_size" INTEGER NOT NULL,
    "signed_loa_file_url" TEXT,
    "signed_loa_file_name" VARCHAR(255),
    "signed_loa_file_size" INTEGER,
    "uploaded_by" UUID NOT NULL,
    "approved_by" UUID,
    "approval_date" TIMESTAMP(6),
    "approval_comments" TEXT,
    "issued_date" TIMESTAMP(6),
    "accepted_date" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "letters_of_acceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "interview_schedules_request_id_key" ON "interview_schedules"("request_id");

-- CreateIndex
CREATE INDEX "interview_schedules_request_id_idx" ON "interview_schedules"("request_id");

-- CreateIndex
CREATE INDEX "interview_schedules_candidate_id_idx" ON "interview_schedules"("candidate_id");

-- CreateIndex
CREATE UNIQUE INDEX "interview_feedbacks_request_id_key" ON "interview_feedbacks"("request_id");

-- CreateIndex
CREATE INDEX "interview_feedbacks_request_id_idx" ON "interview_feedbacks"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_screenings_request_id_key" ON "hr_screenings"("request_id");

-- CreateIndex
CREATE INDEX "hr_screenings_request_id_idx" ON "hr_screenings"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "letters_of_acceptance_request_id_key" ON "letters_of_acceptance"("request_id");

-- CreateIndex
CREATE INDEX "letters_of_acceptance_request_id_idx" ON "letters_of_acceptance"("request_id");

-- AddForeignKey
ALTER TABLE "interview_schedules" ADD CONSTRAINT "interview_schedules_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_schedules" ADD CONSTRAINT "interview_schedules_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidate_resumes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_schedules" ADD CONSTRAINT "interview_schedules_scheduled_by_fkey" FOREIGN KEY ("scheduled_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_feedbacks" ADD CONSTRAINT "interview_feedbacks_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_feedbacks" ADD CONSTRAINT "interview_feedbacks_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_screenings" ADD CONSTRAINT "hr_screenings_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_screenings" ADD CONSTRAINT "hr_screenings_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letters_of_acceptance" ADD CONSTRAINT "letters_of_acceptance_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letters_of_acceptance" ADD CONSTRAINT "letters_of_acceptance_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letters_of_acceptance" ADD CONSTRAINT "letters_of_acceptance_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
