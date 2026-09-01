-- Borrower 360 core tables: credit profile, income, bureau reports, and activity log

CREATE TABLE "borrower_credit_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "borrower_id" UUID NOT NULL,
    "credit_score" INTEGER,
    "score_band" VARCHAR(20),
    "score_source" VARCHAR(20),
    "score_as_of" TIMESTAMP(6),
    "risk_grade" VARCHAR(10),
    "dsr_percent" DECIMAL(5,2),
    "net_dsr_percent" DECIMAL(5,2),
    "dsr_basis" VARCHAR(10) NOT NULL DEFAULT 'GROSS',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "borrower_credit_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "borrower_credit_profiles_borrower_id_key" UNIQUE ("borrower_id")
);

CREATE TABLE "borrower_incomes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "borrower_id" UUID NOT NULL,
    "employment_type" VARCHAR(30),
    "employer_name" VARCHAR(255),
    "monthly_gross_income" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "epf_monthly_amount" DECIMAL(15,2),
    "monthly_tax_deduction" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "monthly_socso_deduction" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "hire_purchase_commitment" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "credit_card_commitment" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "existing_loan_commitment" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "other_commitments" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "monthly_net_income" DECIMAL(15,2),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "borrower_incomes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "borrower_incomes_borrower_id_key" UNIQUE ("borrower_id")
);

CREATE TABLE "borrower_bureau_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "borrower_id" UUID NOT NULL,
    "source" VARCHAR(30) NOT NULL,
    "report_date" DATE,
    "uploaded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by_id" UUID,
    "file_name" VARCHAR(255),
    "file_path" VARCHAR(500),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "borrower_bureau_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "borrower_bureau_facilities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_id" UUID NOT NULL,
    "facility_type" VARCHAR(50) NOT NULL,
    "lender" VARCHAR(100),
    "balance" DECIMAL(15,2),
    "installment" DECIMAL(15,2),
    "conduct_status" VARCHAR(20),

    CONSTRAINT "borrower_bureau_facilities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "borrower_activities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "borrower_id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "detail" VARCHAR(500),
    "actor_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "borrower_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "borrower_bureau_reports_borrower_id_idx" ON "borrower_bureau_reports"("borrower_id");
CREATE INDEX "borrower_bureau_facilities_report_id_idx" ON "borrower_bureau_facilities"("report_id");
CREATE INDEX "borrower_activities_borrower_id_created_at_idx" ON "borrower_activities"("borrower_id", "created_at");

ALTER TABLE "borrower_credit_profiles"
    ADD CONSTRAINT "borrower_credit_profiles_borrower_id_fkey"
    FOREIGN KEY ("borrower_id") REFERENCES "borrower_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "borrower_incomes"
    ADD CONSTRAINT "borrower_incomes_borrower_id_fkey"
    FOREIGN KEY ("borrower_id") REFERENCES "borrower_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "borrower_bureau_reports"
    ADD CONSTRAINT "borrower_bureau_reports_borrower_id_fkey"
    FOREIGN KEY ("borrower_id") REFERENCES "borrower_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "borrower_bureau_reports"
    ADD CONSTRAINT "borrower_bureau_reports_uploaded_by_id_fkey"
    FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "borrower_bureau_facilities"
    ADD CONSTRAINT "borrower_bureau_facilities_report_id_fkey"
    FOREIGN KEY ("report_id") REFERENCES "borrower_bureau_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "borrower_activities"
    ADD CONSTRAINT "borrower_activities_borrower_id_fkey"
    FOREIGN KEY ("borrower_id") REFERENCES "borrower_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
