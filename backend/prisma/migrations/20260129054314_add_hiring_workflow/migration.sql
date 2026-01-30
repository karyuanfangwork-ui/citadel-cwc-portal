-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RequestStatus" ADD VALUE 'PENDING_CEO_APPROVAL';
ALTER TYPE "RequestStatus" ADD VALUE 'CEO_APPROVED';
ALTER TYPE "RequestStatus" ADD VALUE 'CEO_REJECTED';
ALTER TYPE "RequestStatus" ADD VALUE 'JOB_POSTED';
ALTER TYPE "RequestStatus" ADD VALUE 'PENDING_MANAGER_REVIEW';
ALTER TYPE "RequestStatus" ADD VALUE 'MANAGER_APPROVED';

-- CreateTable
CREATE TABLE "request_approvals" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "approver_type" VARCHAR(50) NOT NULL,
    "approver_id" UUID,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "request_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_resumes" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL,
    "mime_type" VARCHAR(100),
    "uploaded_by_id" UUID NOT NULL,
    "candidate_name" VARCHAR(200),
    "notes" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_resumes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_approvals_request_id_idx" ON "request_approvals"("request_id");

-- CreateIndex
CREATE INDEX "request_approvals_approver_id_idx" ON "request_approvals"("approver_id");

-- CreateIndex
CREATE INDEX "candidate_resumes_request_id_idx" ON "candidate_resumes"("request_id");

-- AddForeignKey
ALTER TABLE "request_approvals" ADD CONSTRAINT "request_approvals_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_approvals" ADD CONSTRAINT "request_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_resumes" ADD CONSTRAINT "candidate_resumes_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_resumes" ADD CONSTRAINT "candidate_resumes_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
