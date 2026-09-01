-- CreateEnum
CREATE TYPE "TenantPlan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "ExecutiveRole" AS ENUM ('CEO', 'CTO', 'CFO', 'COO', 'CHRO', 'CMO', 'GROUP_DCEO');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('IN_STOCK', 'ASSIGNED', 'RESERVED', 'PENDING_RETURN', 'IN_REPAIR', 'RETIRED', 'LOST', 'STOLEN', 'DISPOSED');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('LAPTOP', 'DESKTOP', 'MONITOR', 'PERIPHERAL', 'PHONE', 'NETWORK', 'PRINTER', 'SOFTWARE_LICENSE', 'OTHER');

-- CreateEnum
CREATE TYPE "SlaClockKind" AS ENUM ('RESPONSE', 'RESOLUTION', 'OLA');

-- CreateEnum
CREATE TYPE "SlaClockStatus" AS ENUM ('ACTIVE', 'PAUSED', 'BREACHED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SlaTimerJobKind" AS ENUM ('SLA_RESPONSE_DUE', 'SLA_RESOLUTION_DUE', 'SLA_ESCALATION_DUE');

-- CreateEnum
CREATE TYPE "SlaTimerJobStatus" AS ENUM ('SCHEDULED', 'CLAIMED', 'COMPLETED', 'FAILED', 'DEAD_LETTER', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PolicyApproverType" AS ENUM ('ROLE', 'DEPARTMENT', 'ENTITY', 'USER', 'TEAM', 'AUTO');

-- CreateEnum
CREATE TYPE "PolicyConditionOperator" AS ENUM ('AND', 'OR');

-- CreateEnum
CREATE TYPE "ApprovalDefinitionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ApprovalStepStatus" AS ENUM ('WAITING', 'ACTIVE', 'APPROVED', 'REJECTED', 'CANCELLED', 'TIMED_OUT');

-- CreateEnum
CREATE TYPE "ApprovalTimeoutAction" AS ENUM ('REMINDER', 'ESCALATE', 'REJECT');

-- CreateEnum
CREATE TYPE "WorkflowVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkflowNodeType" AS ENUM ('STATUS');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'CLAIMED', 'PUBLISHED', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'ACTION_REQUIRED', 'APPROVED', 'REJECTED', 'CANCELLED', 'RESOLVED', 'IN_PROGRESS', 'WAITING', 'PENDING_CEO_APPROVAL', 'CEO_APPROVED', 'CEO_REJECTED', 'JOB_POSTED', 'PENDING_MANAGER_REVIEW', 'MANAGER_APPROVED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_FEEDBACK_PENDING', 'CANDIDATE_REJECTED_INTERVIEW', 'HR_SCREENING', 'LOA_PENDING_APPROVAL', 'LOA_APPROVED', 'LOA_ISSUED', 'LOA_ACCEPTED', 'LOA_REJECTED', 'COMPLETED', 'OFFBOARDING_SUBMITTED', 'OFFBOARDING_NOTICE_PERIOD', 'OFFBOARDING_KNOWLEDGE_TRANSFER', 'OFFBOARDING_FINAL_WEEK', 'OFFBOARDING_EXIT_PROCEDURES', 'OFFBOARDING_COMPLETED', 'ONBOARDING_SUBMITTED', 'ONBOARDING_PENDING_HR_APPROVAL', 'ONBOARDING_PRE_ARRIVAL_SETUP', 'ONBOARDING_READY_FOR_DAY_1', 'ONBOARDING_DAY_1_ORIENTATION', 'ONBOARDING_WEEK_1_INTEGRATION', 'ONBOARDING_MONTH_1_MILESTONE', 'ONBOARDING_MONTH_2_MILESTONE', 'ONBOARDING_MONTH_3_MILESTONE', 'ONBOARDING_COMPLETED', 'PENDING_MANAGER_APPROVAL_IT', 'MANAGER_APPROVED_IT', 'MANAGER_REJECTED_IT', 'PENDING_VP_APPROVAL_IT', 'VP_APPROVED_IT', 'VP_REJECTED_IT', 'PROCUREMENT_IN_PROGRESS', 'HARDWARE_ORDERED', 'HARDWARE_RECEIVED', 'SOFTWARE_PROVISIONED', 'ACKNOWLEDGED_IT', 'PENDING_CEO_APPROVAL_IT', 'CEO_APPROVED_IT', 'CEO_REJECTED_IT', 'PENDING_CTO_APPROVAL_IT', 'CTO_APPROVED_IT', 'CTO_REJECTED_IT', 'PENDING_INVOICE_IT', 'PENDING_CFO_APPROVAL_IT', 'CFO_APPROVED_IT', 'CFO_REJECTED_IT', 'PAYMENT_PROCESSING_IT', 'PAYMENT_DONE_IT', 'PENDING_DELIVERY_IT', 'PENDING_MANAGER_APPROVAL_FIN', 'MANAGER_APPROVED_FIN', 'MANAGER_REJECTED_FIN', 'PENDING_FINANCE_HEAD_APPROVAL', 'FINANCE_HEAD_APPROVED', 'FINANCE_HEAD_REJECTED', 'PAYMENT_PROCESSING', 'PAYMENT_COMPLETED', 'REIMBURSEMENT_CLOSED', 'FINANCE_PENDING_ACK', 'FINANCE_ACKNOWLEDGED', 'FINANCE_IN_PROGRESS', 'PENDING_CFO_APPROVAL_FIN', 'CFO_APPROVED_FIN', 'CFO_REJECTED_FIN', 'PENDING_GROUP_DCEO_APPROVAL', 'GROUP_DCEO_APPROVED', 'GROUP_DCEO_REJECTED', 'PAYMENT_PROCESSING_FIN', 'AWAITING_PAYMENT_CONFIRMATION', 'PAYMENT_CONFIRMED_FIN', 'TICKET_CLOSED_FIN', 'PENDING_FROM_ENTITY_APPROVAL', 'FROM_ENTITY_APPROVED', 'FROM_ENTITY_REJECTED', 'PENDING_TO_ENTITY_APPROVAL', 'TO_ENTITY_APPROVED', 'TO_ENTITY_REJECTED', 'CHARGEBACK_FINANCE_REVIEW', 'AWAITING_CHARGEBACK_CONFIRMATION', 'CHARGEBACK_COMPLETED', 'PENDING_CEO_APPROVAL_FIN', 'CEO_APPROVED_FIN', 'CEO_REJECTED_FIN');

-- CreateEnum
CREATE TYPE "RequestPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('COMMENT', 'STATUS_CHANGE', 'ASSIGNMENT', 'ATTACHMENT', 'SYSTEM', 'APPROVAL', 'REJECTION');

-- CreateEnum
CREATE TYPE "AttachmentScanStatus" AS ENUM ('PENDING_SCAN', 'CLEAN', 'INFECTED', 'SCAN_FAILED');

-- CreateEnum
CREATE TYPE "AttachmentClassification" AS ENUM ('INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "AttachmentRetentionStatus" AS ENUM ('ACTIVE', 'LEGAL_HOLD', 'PENDING_DELETION', 'DELETED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'RETRYING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'RETRYING', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'HR_CONFIDENTIAL', 'FINANCE_CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "RequestStatusLifecycleType" AS ENUM ('OPEN', 'RESOLVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EntityRoutingMode" AS ENUM ('REQUESTER_ENTITY', 'CUSTOM_FIELD');

-- CreateEnum
CREATE TYPE "CatalogEntitlementTarget" AS ENUM ('ROLE', 'DEPARTMENT', 'ENTITY', 'ALL');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEBSITE', 'REFERRAL', 'COLD_CALL', 'TRADE_SHOW', 'LINKEDIN', 'ADVERTISEMENT', 'PARTNER', 'WHATSAPP', 'OTHER');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('PROSPECTING', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST');

-- CreateEnum
CREATE TYPE "CrmActivityType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FOLLOW_UP', 'WHATSAPP', 'SITE_VISIT');

-- CreateEnum
CREATE TYPE "AnnouncementCategory" AS ENUM ('HR', 'MARKETING', 'IT', 'GENERAL', 'FINANCE', 'POLICY');

-- CreateEnum
CREATE TYPE "AnnouncementPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ApplicationState" AS ENUM ('DRAFT', 'SUBMITTED', 'KYC_REVIEW', 'COMPLIANCE_HOLD', 'KYC_APPROVED', 'KYC_REJECTED', 'UNDERWRITING', 'CREDIT_ASSESSMENT', 'COMMITTEE_REVIEW', 'APPROVED', 'REJECTED', 'CONDITION_FULFILMENT', 'OFFER', 'ACCEPTED', 'DISBURSED', 'ACTIVE', 'CLOSED', 'WITHDRAWN', 'REFERRED_BACK');

-- CreateEnum
CREATE TYPE "BorrowerType" AS ENUM ('INDIVIDUAL', 'CORPORATE', 'JOINT', 'SOLE_PROPRIETOR');

-- CreateEnum
CREATE TYPE "BorrowerSegment" AS ENUM ('INDIVIDUAL', 'SME', 'CORPORATE');

-- CreateEnum
CREATE TYPE "BorrowerLifecycleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProcessingLane" AS ENUM ('PERSONAL_FAST', 'SME', 'CORPORATE');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('SALARIED', 'SELF_EMPLOYED', 'COMMISSION_BASED', 'PENSIONER');

-- CreateEnum
CREATE TYPE "RiskRating" AS ENUM ('AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D', 'NR');

-- CreateEnum
CREATE TYPE "AmlRiskTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'PROHIBITED');

-- CreateEnum
CREATE TYPE "ApplicationType" AS ENUM ('NEW', 'ADDITIONAL', 'RENEWAL', 'VARIATION');

-- CreateEnum
CREATE TYPE "AccountClassification" AS ENUM ('PERFORMING', 'EARLY_CARE', 'WATCHLIST', 'NON_CCRIS_RR', 'CCRIS_RR', 'IMPAIRED');

-- CreateEnum
CREATE TYPE "AccountStrategy" AS ENUM ('GROW', 'MAINTAIN', 'EXIT');

-- CreateEnum
CREATE TYPE "CreditProductType" AS ENUM ('TERM_LOAN', 'REVOLVING_FACILITY', 'TRADE_FINANCE', 'OVERDRAFT', 'PROJECT_FINANCE', 'SYNDICATED', 'BRIDGING', 'HIRE_PURCHASE');

-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('TERM_LOAN', 'REVOLVING', 'OVERDRAFT', 'LC', 'BG', 'TRUST_RECEIPT', 'BRIDGING', 'CASHLINE', 'RWC_I', 'LC_I', 'BG_I', 'ICMTD_I');

-- CreateEnum
CREATE TYPE "SecurityCategory" AS ENUM ('TANGIBLE', 'SUPPORTING', 'PROPERTY', 'VEHICLE', 'FD', 'SECURITIES', 'OTHER');

-- CreateEnum
CREATE TYPE "CounterpartyRole" AS ENUM ('SUPPLIER', 'BUYER', 'COMPETITOR');

-- CreateEnum
CREATE TYPE "MfrsStage" AS ENUM ('STAGE_1', 'STAGE_2', 'STAGE_3');

-- CreateEnum
CREATE TYPE "RatingAgency" AS ENUM ('RAM', 'MARC', 'SP', 'MOODYS', 'FITCH');

-- CreateEnum
CREATE TYPE "ProjectionScenario" AS ENUM ('BASE', 'SCENARIO_1', 'SCENARIO_2', 'SCENARIO_3');

-- CreateEnum
CREATE TYPE "CaRequestType" AS ENUM ('FACILITY_RENEWAL', 'VARIATION', 'POLICY_BREACH_RATIFICATION', 'SICR_IMPAIRMENT');

-- CreateEnum
CREATE TYPE "DocumentClass" AS ENUM ('NRIC_PASSPORT', 'MEMORANDUM_ARTICLES', 'AUDITED_FINANCIALS', 'MANAGEMENT_ACCOUNTS', 'BANK_STATEMENT', 'TAX_RETURN', 'BUSINESS_PLAN', 'CREDIT_BUREAU_REPORT', 'VALUATION_REPORT', 'INSURANCE_CERT', 'BOARD_RESOLUTION', 'AUTHORIZED_SIGNATORY', 'GUARANTEE_LETTER', 'PLEDGE_AGREEMENT', 'SECURITY_DOCUMENT', 'PAYSLIP', 'SSM_CERT', 'MOA_AOA', 'JV_AGREEMENT', 'LETTER_OF_OFFER', 'DISBURSEMENT_INSTRUCTION', 'OTHER');

-- CreateEnum
CREATE TYPE "RuleConfigKind" AS ENUM ('REQUIRED_DOCUMENT', 'REQUIRED_FIELD');

-- CreateEnum
CREATE TYPE "CovenantType" AS ENUM ('FINANCIAL_RATIO', 'NEGATIVE_PLEDGE', 'MINIMUM_TURNOVER', 'DEBT_SERVICE_COVERAGE', 'LOAN_TO_VALUE', 'INSURANCE', 'REPORTING', 'OTHER');

-- CreateEnum
CREATE TYPE "ConditionType" AS ENUM ('PRECEDENT', 'SUBSEQUENT');

-- CreateEnum
CREATE TYPE "ConditionCategory" AS ENUM ('PRE_DISBURSEMENT', 'POST_DISBURSEMENT', 'FINANCIAL_COVENANT', 'REPORTING', 'OTHER');

-- CreateEnum
CREATE TYPE "ConditionStatus" AS ENUM ('PENDING', 'COMPLETED', 'WAIVED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApprovalDecisionType" AS ENUM ('APPROVE', 'REJECT', 'RETURN', 'ESCALATE', 'DEFER', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "RejectionReasonCode" AS ENUM ('INSUFFICIENT_INCOME', 'HIGH_EXISTING_OBLIGATIONS', 'POOR_CREDIT_HISTORY', 'INADEQUATE_COLLATERAL', 'WEAK_BUSINESS_PERFORMANCE', 'INCOMPLETE_DOCUMENTATION', 'AML_COMPLIANCE_ISSUE', 'POLICY_BREACH', 'CONCENTRATION_LIMIT', 'OTHER');

-- CreateEnum
CREATE TYPE "DeviationSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DeviationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('PROCESSING', 'BUREAU_PULL', 'THIRD_PARTY_SHARING', 'MARKETING');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AmlRescreenOutcome" AS ENUM ('CLEAR', 'POTENTIAL_HIT', 'CONFIRMED_HIT', 'FALSE_POSITIVE');

-- CreateEnum
CREATE TYPE "AmlRescreenAction" AS ENUM ('NO_ACTION', 'ESCALATED_TO_COMPLIANCE', 'RELATIONSHIP_EXITED', 'FILED_STR');

-- CreateEnum
CREATE TYPE "StrStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'FILED', 'ACKNOWLEDGED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PolicyLimitType" AS ENUM ('SINGLE_BORROWER', 'SECTOR', 'PRODUCT', 'LANE_THRESHOLD');

-- CreateEnum
CREATE TYPE "CommitteeVoteDecision" AS ENUM ('APPROVE', 'REJECT', 'ABSTAIN');

-- CreateEnum
CREATE TYPE "EarlyWarningSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('HEALTHY', 'WATCH', 'AT_RISK', 'DEFAULT');

-- CreateEnum
CREATE TYPE "DisbursementStatus" AS ENUM ('PENDING', 'APPROVED', 'DISBURSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('ON_TIME', 'LATE_30', 'LATE_60', 'LATE_90', 'MISSED');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('COVENANT_BREACH', 'PAYMENT_OVERDUE', 'REVIEW_OVERDUE', 'FINANCIAL_DETERIORATION', 'COLLATERAL_VALUATION_STALE', 'INSURANCE_EXPIRY', 'CONDITION_OVERDUE', 'AUDIT_CHAIN_BROKEN', 'OTHER');

-- CreateEnum
CREATE TYPE "CovenantFrequency" AS ENUM ('QUARTERLY', 'SEMI_ANNUALLY', 'ANNUALLY');

-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('MYR', 'USD', 'SGD', 'GBP', 'EUR', 'JPY', 'CNY', 'THB', 'IDR', 'AUD', 'HKD');

-- CreateEnum
CREATE TYPE "FinancialStatementType" AS ENUM ('BS', 'PL', 'CF');

-- CreateEnum
CREATE TYPE "FinancialPeriod" AS ENUM ('ANNUAL', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "FinancialStatus" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED');

-- CreateEnum
CREATE TYPE "RatioCategory" AS ENUM ('PROFITABILITY', 'LEVERAGE', 'LIQUIDITY', 'COVERAGE', 'ACTIVITY');

-- CreateEnum
CREATE TYPE "SmeFinancialStatementType" AS ENUM ('AUDITED', 'MANAGEMENT', 'COMPILED');

-- CreateEnum
CREATE TYPE "FatcaEntityClassification" AS ENUM ('INDIVIDUAL', 'ACTIVE_NFE', 'PASSIVE_NFE', 'FINANCIAL_INSTITUTION');

-- CreateEnum
CREATE TYPE "BaseRateType" AS ENUM ('BLR', 'OPR', 'FIXED', 'SORA', 'KLIBOR');

-- CreateEnum
CREATE TYPE "CommitteeMeetingStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommitteeMeetingType" AS ENUM ('REGULAR', 'ADHOC');

-- CreateEnum
CREATE TYPE "CommitteeMemberRole" AS ENUM ('CHAIR', 'MEMBER', 'SECRETARY');

-- CreateEnum
CREATE TYPE "CommitteeAttendance" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED');

-- CreateEnum
CREATE TYPE "CommitteeVoteChoice" AS ENUM ('APPROVE', 'REJECT', 'ABSTAIN');

-- CreateEnum
CREATE TYPE "AgendaItemDecisionType" AS ENUM ('APPROVE', 'REJECT', 'DEFER');

-- CreateEnum
CREATE TYPE "ScoreOverrideStatus" AS ENUM ('PENDING_SECOND_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BureauProvider" AS ENUM ('CCRIS', 'CCRIS_BORROWER_UPLOAD', 'CTOS', 'EXPERIAN', 'CBM', 'SSM_EINFO', 'BANK_STATEMENT_ANALYSIS', 'PEP_WATCHLIST', 'IF_ACTIVA', 'PUBLIC_DOMAIN', 'AML_RESCREEN');

-- CreateEnum
CREATE TYPE "RiskCategory" AS ENUM ('PROJECT', 'PERFORMANCE', 'PACKAGING', 'PAYMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "EsgGuidingPrinciple" AS ENUM ('GP1', 'GP2', 'GP3', 'GP4', 'GP5');

-- CreateEnum
CREATE TYPE "EsgCategory" AS ENUM ('C1', 'C2', 'C3', 'C4', 'C5', 'C6');

-- CreateEnum
CREATE TYPE "SicrTriggerType" AS ENUM ('OBLIGATORY_WATCHLIST', 'OBLIGATORY_IMPAIRED', 'OBJECTIVE_JUDGMENTAL', 'SUBJECTIVE_JUDGMENTAL');

-- CreateEnum
CREATE TYPE "SignoffRole" AS ENUM ('PREPARED_BY', 'REVIEWED_BY', 'CONCURRED_BY');

-- CreateEnum
CREATE TYPE "RepaymentType" AS ENUM ('EMI', 'BULLET', 'INTEREST_ONLY', 'LUMP_SUM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RepaymentFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'LUMP_SUM');

-- CreateEnum
CREATE TYPE "CatalogLifecycleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED', 'RETIRED');

-- CreateEnum
CREATE TYPE "RequestClassification" AS ENUM ('INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "DuplicateExceptionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CONSUMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "plan" "TenantPlan" NOT NULL DEFAULT 'FREE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "tenant_id" UUID,
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20),
    "avatar_url" TEXT,
    "department" VARCHAR(100),
    "job_title" VARCHAR(100),
    "manager_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "agent_team" VARCHAR(50),
    "executive_role" "ExecutiveRole",
    "entity_id" UUID,
    "branch_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "last_login_at" TIMESTAMP(6),
    "password_changed_at" TIMESTAMP(6),
    "must_reset_password" BOOLEAN NOT NULL DEFAULT false,
    "out_of_office" BOOLEAN NOT NULL DEFAULT false,
    "out_of_office_until" TIMESTAMP(6),
    "out_of_office_message" TEXT,
    "delegation_enabled" BOOLEAN NOT NULL DEFAULT false,
    "delegated_to_id" UUID,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" VARCHAR(255),
    "mfa_backup_codes" TEXT[],
    "mfa_verified_at" TIMESTAMP(6),
    "must_enroll_mfa" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(50) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "valid_from" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "department_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "ip_address" INET,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "used_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_desks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "department_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auto_assign_team" VARCHAR(50) NOT NULL DEFAULT 'NONE',
    "assignment_strategy" VARCHAR(20) NOT NULL DEFAULT 'ROUND_ROBIN',
    "last_assigned_index" INTEGER NOT NULL DEFAULT 0,
    "auto_assign_user_id" UUID,

    CONSTRAINT "service_desks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "service_desk_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(50),
    "color_class" VARCHAR(50),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "service_category_id" UUID NOT NULL,
    "code" VARCHAR(100),
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(50),
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "sla_hours" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "form_config" JSONB,
    "form_config_version" INTEGER DEFAULT 1,
    "required_role" VARCHAR(50),
    "workflow_type_id" UUID,
    "owner_id" UUID,
    "lifecycle_status" "CatalogLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "classification" "RequestClassification" NOT NULL DEFAULT 'INTERNAL',
    "review_date" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "request_type_id" UUID NOT NULL,
    "trigger_hours_after_breach" INTEGER NOT NULL,
    "notify_roles" TEXT[],
    "label" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "escalation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policy_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "request_type_id" UUID,
    "version" INTEGER NOT NULL,
    "timezone" VARCHAR(80) NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
    "calendar" JSONB NOT NULL,
    "priority" "RequestPriority" NOT NULL DEFAULT 'MEDIUM',
    "response_target_minutes" INTEGER,
    "resolution_target_minutes" INTEGER,
    "ola_target_minutes" INTEGER,
    "effective_from" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_clocks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID,
    "request_id" UUID NOT NULL,
    "policy_version_id" UUID,
    "kind" "SlaClockKind" NOT NULL,
    "status" "SlaClockStatus" NOT NULL DEFAULT 'ACTIVE',
    "due_at" TIMESTAMP(6) NOT NULL,
    "paused_at" TIMESTAMP(6),
    "pause_duration_ms" BIGINT NOT NULL DEFAULT 0,
    "escalation_level" INTEGER NOT NULL DEFAULT 0,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "sla_clocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_pause_ledger" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "clock_id" UUID NOT NULL,
    "paused_at" TIMESTAMP(6) NOT NULL,
    "resumed_at" TIMESTAMP(6),
    "duration_ms" BIGINT NOT NULL DEFAULT 0,
    "reason" VARCHAR(200),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_pause_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_timer_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID,
    "request_id" UUID NOT NULL,
    "clock_id" UUID NOT NULL,
    "kind" "SlaTimerJobKind" NOT NULL,
    "status" "SlaTimerJobStatus" NOT NULL DEFAULT 'SCHEDULED',
    "run_at" TIMESTAMP(6) NOT NULL,
    "idempotency_key" VARCHAR(180) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_attempt_at" TIMESTAMP(6),
    "claimed_at" TIMESTAMP(6),
    "claimed_by" VARCHAR(100),
    "last_error" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "sla_timer_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_escalation_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID,
    "request_id" UUID NOT NULL,
    "clock_id" UUID,
    "escalation_level" INTEGER NOT NULL,
    "rule_id" UUID,
    "idempotency_key" VARCHAR(180) NOT NULL,
    "notify_roles" TEXT[],
    "notification_intent" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_escalation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_policies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "request_type_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "approval_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_policy_steps" (
    "id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "approver_type" "PolicyApproverType" NOT NULL,
    "approver_id" UUID,
    "role_id" TEXT,
    "department_id" UUID,
    "entity_id" UUID,
    "team_id" VARCHAR(100),
    "label" VARCHAR(200),
    "auto_approve_if" TEXT,
    "timeout_hours" INTEGER,
    "parallel_group" VARCHAR(50),
    "timeout_action" "ApprovalTimeoutAction" NOT NULL DEFAULT 'REMINDER',
    "condition" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "approval_policy_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_policy_versions" (
    "id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "ApprovalDefinitionStatus" NOT NULL DEFAULT 'DRAFT',
    "definition" JSONB NOT NULL,
    "published_at" TIMESTAMP(6),
    "published_by" UUID,
    "retired_at" TIMESTAMP(6),
    "retired_by" UUID,
    "effective_from" TIMESTAMP(6),
    "effective_to" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "approval_policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_instances" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "tenant_id" UUID,
    "department_id" UUID,
    "policy_version_id" UUID NOT NULL,
    "status" "ApprovalStepStatus" NOT NULL DEFAULT 'ACTIVE',
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "approval_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_instance_steps" (
    "id" UUID NOT NULL,
    "instance_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "parallel_group" VARCHAR(50),
    "approver_type" "PolicyApproverType" NOT NULL,
    "assigned_approver_id" UUID,
    "status" "ApprovalStepStatus" NOT NULL DEFAULT 'WAITING',
    "decision" VARCHAR(20),
    "decision_comment" TEXT,
    "decided_at" TIMESTAMP(6),
    "decided_by" UUID,
    "delegated_by" UUID,
    "delegated_to" UUID,
    "delegated_at" TIMESTAMP(6),
    "due_at" TIMESTAMP(6),
    "timeout_action" "ApprovalTimeoutAction" NOT NULL DEFAULT 'REMINDER',
    "condition" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "approval_instance_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_types" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "workflow_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_steps" (
    "id" UUID NOT NULL,
    "workflow_type_id" UUID NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "status" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(50) NOT NULL DEFAULT 'radio_button_checked',
    "display_order" INTEGER NOT NULL,
    "is_initial" BOOLEAN NOT NULL DEFAULT false,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "sla_pause" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_type_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "WorkflowVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "published_at" TIMESTAMP(6),
    "published_by_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_nodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_version_id" UUID NOT NULL,
    "type" "WorkflowNodeType" NOT NULL DEFAULT 'STATUS',
    "status_code" VARCHAR(100),
    "label" VARCHAR(200),
    "display_order" INTEGER,
    "position_x" DOUBLE PRECISION,
    "position_y" DOUBLE PRECISION,
    "is_initial" BOOLEAN NOT NULL DEFAULT false,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "sla_pause" BOOLEAN NOT NULL DEFAULT false,
    "icon" VARCHAR(50) NOT NULL DEFAULT 'radio_button_checked',
    "config" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "workflow_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_edges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_version_id" UUID NOT NULL,
    "from_node_id" UUID NOT NULL,
    "to_node_id" UUID NOT NULL,
    "transition_label" VARCHAR(50),
    "requires_comment" BOOLEAN NOT NULL DEFAULT false,
    "auto_assign_role" VARCHAR(50),
    "auto_assign_user_id" UUID,
    "allowed_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowed_executive_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "config" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "workflow_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID,
    "request_id" UUID NOT NULL,
    "from_status" VARCHAR(100) NOT NULL,
    "to_status" VARCHAR(100) NOT NULL,
    "actor_id" UUID,
    "actor_name" VARCHAR(200),
    "source" VARCHAR(100) NOT NULL DEFAULT 'unknown',
    "comment" TEXT,
    "metadata" JSONB,
    "request_version" INTEGER NOT NULL,
    "idempotency_key" VARCHAR(200),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_command_results" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "command_hash" CHAR(64) NOT NULL,
    "request_id" UUID NOT NULL,
    "from_status" VARCHAR(100) NOT NULL,
    "to_status" VARCHAR(100) NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_command_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID,
    "event_type" VARCHAR(100) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "aggregate_version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(6),
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_attempt_at" TIMESTAMP(6),
    "last_error" TEXT,
    "claimed_at" TIMESTAMP(6),
    "claimed_by" VARCHAR(100),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "department_id" UUID,
    "reference_number" VARCHAR(50) NOT NULL,
    "request_type_id" UUID,
    "service_desk_id" UUID,
    "requester_id" UUID NOT NULL,
    "requester_email" VARCHAR(255) NOT NULL,
    "requester_phone" VARCHAR(20),
    "summary" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "priority" "RequestPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" VARCHAR(100) NOT NULL DEFAULT 'SUBMITTED',
    "assigned_to_id" UUID,
    "assigned_team" VARCHAR(100),
    "parent_request_id" UUID,
    "is_confidential" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "custom_fields" JSONB,
    "form_config_snapshot" JSONB,
    "form_config_version" INTEGER,
    "sla_due_at" TIMESTAMP(6),
    "sla_paused_at" TIMESTAMP(6),
    "sla_pause_duration_ms" BIGINT NOT NULL DEFAULT 0,
    "first_response_at" TIMESTAMP(6),
    "resolved_at" TIMESTAMP(6),
    "closed_at" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_activities" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "author_id" UUID,
    "author_name" VARCHAR(200) NOT NULL,
    "author_role" VARCHAR(100),
    "author_avatar_url" TEXT,
    "activity_type" "ActivityType" NOT NULL,
    "message" TEXT NOT NULL,
    "is_system_generated" BOOLEAN NOT NULL DEFAULT false,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_attachments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "activity_id" UUID,
    "uploaded_by_id" UUID,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "file_type" VARCHAR(100),
    "mime_type" VARCHAR(100),
    "storage_path" TEXT NOT NULL,
    "storage_url" TEXT NOT NULL,
    "content_hash" VARCHAR(64),
    "classification" "AttachmentClassification" NOT NULL DEFAULT 'INTERNAL',
    "is_scanned" BOOLEAN NOT NULL DEFAULT false,
    "scan_result" VARCHAR(50),
    "scan_status" "AttachmentScanStatus" NOT NULL DEFAULT 'PENDING_SCAN',
    "scan_job_id" UUID,
    "scan_callback_nonce_hash" VARCHAR(64),
    "scan_callback_expires_at" TIMESTAMP(6),
    "scan_callback_consumed_at" TIMESTAMP(6),
    "scan_completed_at" TIMESTAMP(6),
    "quarantine_path" TEXT,
    "quarantined_at" TIMESTAMP(6),
    "source_deleted_at" TIMESTAMP(6),
    "retention_status" "AttachmentRetentionStatus" NOT NULL DEFAULT 'ACTIVE',
    "retention_until" TIMESTAMP(6),
    "legal_hold_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "request_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_hardware_requests" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "hardware_name" VARCHAR(255) NOT NULL,
    "hardware_model" VARCHAR(255),
    "estimated_price" DECIMAL(10,2),
    "preferred_vendor" VARCHAR(200),
    "product_url" TEXT,
    "business_justification" TEXT NOT NULL,
    "manager_approval_required" BOOLEAN NOT NULL DEFAULT true,
    "manager_approved_at" TIMESTAMP(6),
    "manager_approved_by_id" UUID,
    "procurement_status" VARCHAR(50),
    "order_number" VARCHAR(100),
    "tracking_number" VARCHAR(100),
    "serial_number" VARCHAR(100),
    "asset_tag" VARCHAR(100),
    "asset_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "it_hardware_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_leave_requests" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "leave_type" VARCHAR(50) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "total_days" DECIMAL(4,2) NOT NULL,
    "reason" TEXT,
    "emergency_contact" VARCHAR(200),
    "emergency_phone" VARCHAR(20),
    "manager_approval_status" VARCHAR(50),
    "hr_approval_status" VARCHAR(50),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "hr_leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_expense_reimbursements" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "expense_date" DATE NOT NULL,
    "expense_category" VARCHAR(100) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "merchant_name" VARCHAR(200),
    "payment_method" VARCHAR(50),
    "business_purpose" TEXT NOT NULL,
    "project_code" VARCHAR(50),
    "cost_center" VARCHAR(50),
    "approval_status" VARCHAR(50),
    "approved_amount" DECIMAL(10,2),
    "payment_status" VARCHAR(50),
    "payment_date" DATE,
    "payment_reference" VARCHAR(100),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "finance_expense_reimbursements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_line_items" (
    "id" UUID NOT NULL,
    "expense_id" UUID NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "receipt_attachment_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_approvals" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "approver_type" VARCHAR(50) NOT NULL,
    "approver_id" UUID,
    "entity_id" UUID,
    "policy_id" UUID,
    "step_order" INTEGER,
    "delegated_by" UUID,
    "delegated_to" UUID,
    "delegated_at" TIMESTAMP(6),
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "last_reminder_at" TIMESTAMP(6),
    "due_at" TIMESTAMP(6),
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "request_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_delegations" (
    "id" UUID NOT NULL,
    "approval_id" UUID NOT NULL,
    "from_user_id" UUID NOT NULL,
    "to_user_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_reminders" (
    "id" UUID NOT NULL,
    "approval_id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "sent_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "request_id" UUID NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_resumes" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL,
    "mime_type" VARCHAR(100),
    "uploaded_by_id" UUID NOT NULL,
    "candidate_name" VARCHAR(200),
    "document_type" VARCHAR(50) NOT NULL DEFAULT 'RESUME',
    "notes" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "email_subject" TEXT,
    "email_body" TEXT,
    "sms_body" TEXT,
    "push_title" VARCHAR(200),
    "push_body" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_domain_events" (
    "id" UUID NOT NULL,
    "event_key" VARCHAR(200) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID,
    "event_type" VARCHAR(100) NOT NULL,
    "classification" "NotificationClassification" NOT NULL DEFAULT 'INTERNAL',
    "resource_type" VARCHAR(100) NOT NULL,
    "resource_id" UUID,
    "payload_version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_domain_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID,
    "recipient_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(6),
    "provider_message_id" VARCHAR(255),
    "error_message" TEXT,
    "delivered_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID NOT NULL,
    "delivery_id" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "subject" VARCHAR(500),
    "body" TEXT NOT NULL,
    "related_request_id" UUID,
    "sent_at" TIMESTAMP(6),
    "read_at" TIMESTAMP(6),
    "error_message" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_articles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "service_desk_id" UUID,
    "title" VARCHAR(500) NOT NULL,
    "slug" VARCHAR(500) NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "author_id" UUID,
    "category" VARCHAR(100),
    "tags" TEXT[],
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "not_helpful_count" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "kb_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID,
    "user_email" VARCHAR(255),
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(100) NOT NULL,
    "resource_id" UUID,
    "ip_address" INET,
    "user_agent" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_audit_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID,
    "actor_id" UUID,
    "actor_email" VARCHAR(255),
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(100) NOT NULL,
    "resource_id" UUID,
    "correlation_id" VARCHAR(100),
    "old_value_hash" VARCHAR(64),
    "new_value_hash" VARCHAR(64),
    "metadata" JSONB,
    "hash" VARCHAR(64) NOT NULL,
    "hash_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_events_pkey" PRIMARY KEY ("id")
);

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
    "candidate_id" UUID,
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

-- CreateTable
CREATE TABLE "onboarding_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
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

-- CreateTable
CREATE TABLE "offboarding_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "request_id" UUID NOT NULL,
    "employee_first_name" VARCHAR(100) NOT NULL,
    "employee_last_name" VARCHAR(100) NOT NULL,
    "employee_email" VARCHAR(255) NOT NULL,
    "employee_id" UUID,
    "department" VARCHAR(100),
    "manager_id" UUID NOT NULL,
    "last_working_day" DATE NOT NULL,
    "reason_for_departure" TEXT,
    "overall_status" VARCHAR(50) NOT NULL,
    "current_phase" VARCHAR(50) NOT NULL,
    "accounts_disabled" BOOLEAN NOT NULL DEFAULT false,
    "email_revoked" BOOLEAN NOT NULL DEFAULT false,
    "hardware_returned" BOOLEAN NOT NULL DEFAULT false,
    "access_badge_revoked" BOOLEAN NOT NULL DEFAULT false,
    "resignation_letter_attached" BOOLEAN NOT NULL DEFAULT false,
    "resignation_letter_url" VARCHAR(500),
    "resignation_letter_file_name" VARCHAR(255),
    "exit_interview_scheduled_date" DATE,
    "exit_interview_done" BOOLEAN NOT NULL DEFAULT false,
    "final_payroll_done" BOOLEAN NOT NULL DEFAULT false,
    "benefits_terminated" BOOLEAN NOT NULL DEFAULT false,
    "knowledge_transfer_done" BOOLEAN NOT NULL DEFAULT false,
    "completed_by" UUID,
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "offboarding_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offboarding_tasks" (
    "id" UUID NOT NULL,
    "offboarding_id" UUID NOT NULL,
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

    CONSTRAINT "offboarding_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offboarding_task_templates" (
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

    CONSTRAINT "offboarding_task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banner_configs" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "colorScheme" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banner_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_status_definitions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "lifecycle_type" "RequestStatusLifecycleType" NOT NULL DEFAULT 'OPEN',
    "retired_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "request_status_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_transitions" (
    "id" UUID NOT NULL,
    "from_status" VARCHAR(100) NOT NULL,
    "to_status" VARCHAR(100) NOT NULL,
    "transition_label" VARCHAR(50),
    "requires_comment" BOOLEAN NOT NULL DEFAULT false,
    "auto_assign_role" VARCHAR(50),
    "auto_assign_user_id" UUID,
    "tenant_id" UUID,
    "workflow_type_id" UUID,
    "allowed_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowed_executive_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "workflow_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "approver_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_type_entity_routings" (
    "id" UUID NOT NULL,
    "request_type_id" UUID NOT NULL,
    "routing_mode" "EntityRoutingMode" NOT NULL,
    "custom_field_key" VARCHAR(100),
    "label" VARCHAR(200),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_type_entity_routings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_entitlements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "request_type_id" UUID NOT NULL,
    "target_type" "CatalogEntitlementTarget" NOT NULL,
    "target_id" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "catalog_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "asset_tag" VARCHAR(100) NOT NULL,
    "serial_number" VARCHAR(100),
    "name" VARCHAR(255) NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "brand" VARCHAR(100),
    "model" VARCHAR(100),
    "purchase_date" DATE,
    "purchase_price" DECIMAL(10,2),
    "vendor" VARCHAR(200),
    "warranty_expiry" DATE,
    "status" "AssetStatus" NOT NULL DEFAULT 'IN_STOCK',
    "notes" TEXT,
    "os" VARCHAR(100),
    "encrypted" VARCHAR(50),
    "sku_family" VARCHAR(100),
    "join_type" VARCHAR(100),
    "ethernet_mac" VARCHAR(50),
    "wifi_mac" VARCHAR(50),
    "arch" VARCHAR(50),
    "previous_user" VARCHAR(200),
    "entity" VARCHAR(200),
    "source_request_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_assignments" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_by_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returned_at" TIMESTAMP(6),
    "reason" VARCHAR(200),
    "linked_request_id" UUID,
    "notes" TEXT,

    CONSTRAINT "asset_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(100) NOT NULL,
    "tenant_id" UUID,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "crm_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "industry" VARCHAR(100),
    "company_size" VARCHAR(50),
    "website" VARCHAR(500),
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "address" TEXT,
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "country" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "description" TEXT,
    "annual_revenue" DECIMAL(15,2),
    "registration_number" VARCHAR(50),
    "tax_number" VARCHAR(50),
    "bank_account" VARCHAR(100),
    "purchase_cash_trust" BOOLEAN NOT NULL DEFAULT false,
    "account_type" VARCHAR(20) NOT NULL DEFAULT 'CORPORATE',
    "owner_id" UUID NOT NULL,
    "parent_account_id" UUID,
    "deleted_at" TIMESTAMP(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "custom_fields" JSONB,

    CONSTRAINT "crm_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_contacts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "account_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "mobile" VARCHAR(50),
    "job_title" VARCHAR(150),
    "department" VARCHAR(100),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "follow_up_date" TIMESTAMP(6),
    "follow_up_note" TEXT,
    "nric_passport" VARCHAR(50),
    "date_of_birth" DATE,
    "preferred_language" VARCHAR(5),
    "pdpa_consent" BOOLEAN NOT NULL DEFAULT false,
    "pdpa_consent_date" TIMESTAMP(6),
    "marketing_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(6),
    "risk_profile" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "custom_fields" JSONB,

    CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_contact_account_roles" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_contact_account_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_leads" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "source" "LeadSource" NOT NULL DEFAULT 'OTHER',
    "account_id" UUID,
    "contact_id" UUID,
    "owner_id" UUID NOT NULL,
    "territory_id" UUID,
    "contact_name" VARCHAR(200),
    "contact_email" VARCHAR(255),
    "contact_phone" VARCHAR(50),
    "company_name" VARCHAR(255),
    "industry" VARCHAR(255),
    "address" TEXT,
    "estimated_value" DECIMAL(15,2),
    "description" TEXT,
    "remark" TEXT,
    "email_delivery_date" DATE,
    "lost_reason" TEXT,
    "converted_at" TIMESTAMP(6),
    "converted_to_opp_id" UUID,
    "follow_up_date" TIMESTAMP(6),
    "follow_up_note" TEXT,
    "deleted_at" TIMESTAMP(6),
    "ai_score" INTEGER,
    "ai_score_reason" TEXT,
    "ai_scored_at" TIMESTAMP(6),
    "rule_score" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "custom_fields" JSONB,

    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lead_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "lead_id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "scan_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "scan_completed_at" TIMESTAMP(6),
    "deleted_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "crm_lead_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lead_scoring_rules" (
    "id" UUID NOT NULL,
    "field" VARCHAR(100) NOT NULL,
    "operator" VARCHAR(20) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "points" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "crm_lead_scoring_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_assignment_rules" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "territory_id" UUID,
    "source_match" VARCHAR(100),
    "round_robin" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "crm_assignment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_tags" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(7) NOT NULL DEFAULT '#6B7280',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "crm_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_tag_assignments" (
    "id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "entityType" VARCHAR(20) NOT NULL,
    "entity_id" UUID NOT NULL,
    "assigned_by" UUID NOT NULL,
    "assigned_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_tag_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_field_changes" (
    "id" UUID NOT NULL,
    "entityType" VARCHAR(20) NOT NULL,
    "entity_id" UUID NOT NULL,
    "field" VARCHAR(100) NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by" UUID NOT NULL,
    "changed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_field_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_pipelines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "crm_pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_pipeline_stages" (
    "id" UUID NOT NULL,
    "pipeline_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "display_order" INTEGER NOT NULL,
    "probability" INTEGER NOT NULL DEFAULT 0,
    "color" VARCHAR(20) NOT NULL DEFAULT '#0052cc',
    "is_won_stage" BOOLEAN NOT NULL DEFAULT false,
    "is_lost_stage" BOOLEAN NOT NULL DEFAULT false,
    "required_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enforce_forward_only" BOOLEAN NOT NULL DEFAULT false,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "approval_threshold" DECIMAL(15,2),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "crm_pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_opportunities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "account_id" UUID NOT NULL,
    "contact_id" UUID,
    "pipeline_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'MYR',
    "fx_rate_to_base" DECIMAL(10,6),
    "probability" INTEGER NOT NULL DEFAULT 0,
    "expected_close_date" DATE,
    "description" TEXT,
    "lost_reason" TEXT,
    "won_at" TIMESTAMP(6),
    "lost_at" TIMESTAMP(6),
    "forecast_category" VARCHAR(20) NOT NULL DEFAULT 'PIPELINE',
    "deleted_at" TIMESTAMP(6),
    "ai_win_probability" DOUBLE PRECISION,
    "ai_win_reason" TEXT,
    "ai_scored_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "custom_fields" JSONB,

    CONSTRAINT "crm_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_opportunity_stage_history" (
    "id" TEXT NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "from_stage_name" VARCHAR(100),
    "to_stage_name" VARCHAR(100) NOT NULL,
    "moved_by_user_id" UUID NOT NULL,
    "moved_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_opportunity_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_activities" (
    "id" UUID NOT NULL,
    "activity_type" "CrmActivityType" NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "user_id" UUID NOT NULL,
    "account_id" UUID,
    "contact_id" UUID,
    "lead_id" UUID,
    "opportunity_id" UUID,
    "scheduled_at" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),
    "duration_minutes" INTEGER,
    "call_category" VARCHAR(30),
    "call_outcome" VARCHAR(30),
    "email_outcome" VARCHAR(30),
    "meeting_outcome" VARCHAR(30),
    "engagement_outcome" VARCHAR(30),
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "custom_fields" JSONB,

    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_notes" (
    "id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "account_id" UUID,
    "contact_id" UUID,
    "lead_id" UUID,
    "opportunity_id" UUID,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "crm_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_account_requests" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_account_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_beneficiaries" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "relationship" VARCHAR(20) NOT NULL,
    "allocation_pct" DECIMAL(5,2) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "nric_passport" VARCHAR(50),
    "date_of_birth" DATE,
    "is_minor" BOOLEAN NOT NULL DEFAULT false,
    "guardian_name" VARCHAR(200),
    "notes" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "crm_beneficiaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_trust_products" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "contact_id" UUID,
    "opportunity_id" UUID,
    "trust_type" VARCHAR(30) NOT NULL,
    "deed_ref_number" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "asset_value" DECIMAL(15,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'MYR',
    "asset_description" TEXT,
    "trustee_name" VARCHAR(200),
    "trustee_contact" VARCHAR(100),
    "settlement_date" DATE,
    "maturity_date" DATE,
    "next_review_date" DATE,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "owner_id" UUID NOT NULL,

    CONSTRAINT "crm_trust_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_kyc_records" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "riskLevel" VARCHAR(10),
    "is_pep" BOOLEAN NOT NULL DEFAULT false,
    "nric_verified" BOOLEAN NOT NULL DEFAULT false,
    "address_verified" BOOLEAN NOT NULL DEFAULT false,
    "income_verified" BOOLEAN NOT NULL DEFAULT false,
    "source_of_funds_verified" BOOLEAN NOT NULL DEFAULT false,
    "risk_profile_done" BOOLEAN NOT NULL DEFAULT false,
    "approved_at" TIMESTAMP(6),
    "approved_by" UUID,
    "expires_at" TIMESTAMP(6),
    "rejection_reason" TEXT,
    "aml_risk_tier" VARCHAR(10),
    "screening_status" VARCHAR(20),
    "screening_hits" JSONB,
    "last_screening_at" TIMESTAMP(6),
    "next_screening_due_at" TIMESTAMP(6),
    "notes" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "crm_kyc_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_import_jobs" (
    "id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(10) NOT NULL,
    "entity" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "imported_rows" INTEGER NOT NULL DEFAULT 0,
    "failed_rows" INTEGER NOT NULL DEFAULT 0,
    "error_report" JSONB,
    "duplicate_report" JSONB,
    "column_mapping" JSONB,
    "raw_data" JSONB,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "completed_at" TIMESTAMP(6),

    CONSTRAINT "crm_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_export_jobs" (
    "id" UUID NOT NULL,
    "entity" VARCHAR(20) NOT NULL,
    "filters" JSONB,
    "format" VARCHAR(10) NOT NULL DEFAULT 'CSV',
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "file_url" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "crm_export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_territories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "regions" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "crm_territories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_territory_members" (
    "id" UUID NOT NULL,
    "territory_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
    "assigned_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_territory_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_quotas" (
    "id" UUID NOT NULL,
    "territory_id" UUID,
    "user_id" UUID,
    "period" VARCHAR(20) NOT NULL,
    "periodType" VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
    "targetAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'MYR',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "crm_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_dashboard_layouts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "layout" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_dashboard_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_workflows" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "trigger" JSONB NOT NULL DEFAULT '{}',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "execution_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_workflow_executions" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "triggerEntity" VARCHAR(50) NOT NULL,
    "trigger_entity_id" UUID NOT NULL,
    "trigger_event" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "action_results" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "crm_workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_anomaly_configs" (
    "id" UUID NOT NULL,
    "entityType" VARCHAR(20) NOT NULL,
    "anomalyType" VARCHAR(30) NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL DEFAULT 14,
    "severity" VARCHAR(10) NOT NULL DEFAULT 'MODERATE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_anomaly_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_custom_field_definitions" (
    "id" UUID NOT NULL,
    "entity" VARCHAR(20) NOT NULL,
    "field_key" VARCHAR(100) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "field_type" VARCHAR(20) NOT NULL,
    "group" VARCHAR(100),
    "options" JSONB,
    "validation" JSONB,
    "default_value" VARCHAR(500),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_searchable" BOOLEAN NOT NULL DEFAULT false,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "title" VARCHAR(500) NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "category" "AnnouncementCategory" NOT NULL DEFAULT 'GENERAL',
    "priority" "AnnouncementPriority" NOT NULL DEFAULT 'MEDIUM',
    "targetAudience" VARCHAR(50) NOT NULL DEFAULT 'ALL',
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(6),
    "expires_at" TIMESTAMP(6),
    "author_id" UUID NOT NULL,
    "attachment_url" VARCHAR(1000),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_reads" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "announcement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_participants" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "added_by_id" UUID,
    "participant_role" VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "key" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rollout_pct" INTEGER NOT NULL DEFAULT 0,
    "category" VARCHAR(50) NOT NULL DEFAULT 'general',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_app_counters" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "prefix" VARCHAR(10) NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "credit_app_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aml_rescreen_events" (
    "id" UUID NOT NULL,
    "borrower_profile_id" UUID NOT NULL,
    "application_id" UUID,
    "triggered_by_id" UUID NOT NULL,
    "triggered_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "screening_source" VARCHAR(100) NOT NULL,
    "outcome" "AmlRescreenOutcome" NOT NULL,
    "hit_details" TEXT,
    "actionTaken" "AmlRescreenAction" NOT NULL,
    "action_notes" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aml_rescreen_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suspicious_transactions" (
    "id" UUID NOT NULL,
    "application_id" UUID,
    "subject_name" VARCHAR(255) NOT NULL,
    "subject_id_type" VARCHAR(20),
    "subject_id_number" VARCHAR(50),
    "grounds" TEXT NOT NULL,
    "filing_reference" VARCHAR(100),
    "filing_date" TIMESTAMP(6),
    "status" "StrStatus" NOT NULL DEFAULT 'DRAFT',
    "severity" VARCHAR(10),
    "assigned_to_id" UUID,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(6),
    "notes" TEXT,
    "aml_rescreen_event_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "suspicious_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "str_attachments" (
    "id" UUID NOT NULL,
    "str_id" UUID NOT NULL,
    "document_id" UUID,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "uploaded_by_id" UUID,
    "uploaded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "str_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_policy_limits" (
    "id" UUID NOT NULL,
    "type" "PolicyLimitType" NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "max_value" DECIMAL(15,2) NOT NULL,
    "threshold_pct" DECIMAL(5,2) NOT NULL DEFAULT 80,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'MYR',
    "sector" VARCHAR(100),
    "product_type" VARCHAR(50),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "credit_policy_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deviation_approvals" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "policy_rule" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "actual_value" DECIMAL(15,2),
    "threshold_value" DECIMAL(15,2),
    "severity" "DeviationSeverity" NOT NULL DEFAULT 'MEDIUM',
    "justification" TEXT NOT NULL,
    "status" "DeviationStatus" NOT NULL DEFAULT 'PENDING',
    "is_non_waivable" BOOLEAN NOT NULL DEFAULT false,
    "required_authority_level" VARCHAR(50),
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(6),
    "approval_comments" TEXT,
    "rejected_by_id" UUID,
    "rejected_at" TIMESTAMP(6),
    "rejection_reason" TEXT,
    "created_by_id" UUID,
    "review_date" TIMESTAMP(6),
    "sunset_date" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "deviation_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "subject_type" VARCHAR(20) NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'ACTIVE',
    "consent_text" TEXT,
    "consent_text_version" VARCHAR(20),
    "evidence" VARCHAR(50),
    "channel" VARCHAR(50),
    "granted_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by_id" UUID,
    "withdrawn_at" TIMESTAMP(6),
    "withdrawn_by_id" UUID,
    "withdrawal_reason" TEXT,
    "expires_at" TIMESTAMP(6),
    "application_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_profiles" (
    "id" UUID NOT NULL,
    "borrower_type" "BorrowerType" NOT NULL DEFAULT 'CORPORATE',
    "borrower_number" VARCHAR(20) NOT NULL,
    "segment" "BorrowerSegment" NOT NULL,
    "lifecycle_status" "BorrowerLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "relationship_owner_id" UUID,
    "name" VARCHAR(255),
    "account_id" UUID,
    "contact_id" UUID,
    "credit_risk_rating" "RiskRating",
    "risk_rating_calculated_at" TIMESTAMP(6),
    "risk_rating_version" INTEGER,
    "aml_risk_tier" "AmlRiskTier",
    "exposure_limit" DECIMAL(15,2),
    "total_exposure" DECIMAL(15,2) DEFAULT 0,
    "is_sanctioned_entity" BOOLEAN NOT NULL DEFAULT false,
    "source_of_wealth" VARCHAR(255),
    "purpose_of_account" VARCHAR(255),
    "occupation" VARCHAR(100),
    "employer" VARCHAR(255),
    "annual_income" DECIMAL(15,2),
    "net_worth" DECIMAL(15,2),
    "annual_turnover" DECIMAL(15,2),
    "years_trading" INTEGER,
    "sme_financial_statement_type" "SmeFinancialStatementType",
    "sic_code" VARCHAR(10),
    "registration_number" VARCHAR(100),
    "industry" VARCHAR(100),
    "nric_passport" VARCHAR(50),
    "registration_number_normalized" VARCHAR(64),
    "nric_passport_normalized" VARCHAR(64),
    "address" VARCHAR(500),
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "gender" VARCHAR(20),
    "nationality" VARCHAR(100),
    "date_of_birth" DATE,
    "date_of_incorporation" DATE,
    "business_nature" VARCHAR(500),
    "business_type" VARCHAR(50),
    "authorized_representative" VARCHAR(255),
    "preferred_name" VARCHAR(100),
    "marital_status" VARCHAR(30),
    "education_level" VARCHAR(50),
    "tax_number" VARCHAR(50),
    "office_phone" VARCHAR(50),
    "preferred_contact_method" VARCHAR(20),
    "mailing_address" VARCHAR(500),
    "annual_income_encrypted" VARCHAR(255),
    "net_worth_encrypted" VARCHAR(255),
    "source_of_wealth_encrypted" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "branch_id" UUID,
    "kyc_verified_at" TIMESTAMP(6),

    CONSTRAINT "borrower_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_credit_profiles" (
    "id" UUID NOT NULL,
    "borrower_id" UUID NOT NULL,
    "credit_score" INTEGER,
    "score_band" VARCHAR(20),
    "score_source" VARCHAR(20),
    "score_as_of" TIMESTAMP(6),
    "risk_grade" VARCHAR(10),
    "dsr_percent" DECIMAL(5,2),
    "net_dsr_percent" DECIMAL(5,2),
    "dsr_basis" VARCHAR(10) DEFAULT 'GROSS',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "borrower_credit_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_incomes" (
    "id" UUID NOT NULL,
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

    CONSTRAINT "borrower_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_bureau_reports" (
    "id" UUID NOT NULL,
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

-- CreateTable
CREATE TABLE "borrower_bureau_facilities" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "facility_type" VARCHAR(50) NOT NULL,
    "lender" VARCHAR(100),
    "balance" DECIMAL(15,2),
    "installment" DECIMAL(15,2),
    "conduct_status" VARCHAR(20),

    CONSTRAINT "borrower_bureau_facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_activities" (
    "id" UUID NOT NULL,
    "borrower_id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "detail" VARCHAR(500),
    "actor_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "borrower_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_risk_runs" (
    "id" UUID NOT NULL,
    "borrower_profile_id" UUID NOT NULL,
    "scorecard_version_id" UUID,
    "scorecard_version" INTEGER,
    "factor_scores" JSONB NOT NULL,
    "total_score" DECIMAL(10,2) NOT NULL,
    "base_risk_rating" "RiskRating" NOT NULL,
    "effective_risk_rating" "RiskRating" NOT NULL,
    "bureau_caps_applied" JSONB,
    "reason_codes" JSONB,
    "missing_inputs" JSONB,
    "rating_band_version" INTEGER,
    "calculation_source" VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
    "calculated_by_id" UUID,
    "run_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "borrower_risk_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fatca_crs_declarations" (
    "id" UUID NOT NULL,
    "borrower_profile_id" UUID NOT NULL,
    "declaration_date" DATE NOT NULL,
    "is_us_person" BOOLEAN NOT NULL,
    "us_tin_encrypted" VARCHAR(255),
    "entity_classification" "FatcaEntityClassification" NOT NULL,
    "crs_residencies" JSONB NOT NULL,
    "self_certified_by_id" UUID NOT NULL,
    "verified_by_id" UUID,
    "verified_at" TIMESTAMP(6),
    "expiry_date" DATE,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "fatca_crs_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "directors" (
    "id" UUID NOT NULL,
    "borrower_profile_id" UUID NOT NULL,
    "contact_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "nric_passport_encrypted" TEXT,
    "nric_passport_hmac" VARCHAR(64),
    "position" VARCHAR(100),
    "appointment_date" DATE,
    "resignation_date" DATE,
    "is_executive" BOOLEAN NOT NULL DEFAULT false,
    "date_of_birth" DATE,
    "nationality" VARCHAR(100),
    "experience_qualification" TEXT,
    "is_key_management" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "directors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shareholders" (
    "id" UUID NOT NULL,
    "borrower_profile_id" UUID NOT NULL,
    "contact_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "nric_passport_encrypted" TEXT,
    "nric_passport_hmac" VARCHAR(64),
    "shareholding_pct" DECIMAL(5,2),
    "share_class" VARCHAR(50),
    "number_of_shares" INTEGER,
    "dob_or_incorp_date" DATE,
    "nationality" VARCHAR(100),
    "business_reg_no" VARCHAR(100),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "shareholders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ultimate_beneficial_owners" (
    "id" UUID NOT NULL,
    "borrower_profile_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "nric_passport_encrypted" TEXT,
    "nric_passport_hmac" VARCHAR(64),
    "ownership_pct" DECIMAL(5,2) NOT NULL,
    "is_pep" BOOLEAN NOT NULL DEFAULT false,
    "source_of_wealth" VARCHAR(255),
    "country_of_residence" VARCHAR(100),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ultimate_beneficial_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "related_party_groups" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "relationship_type" VARCHAR(100),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "related_party_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "related_party_members" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "borrower_profile_id" UUID NOT NULL,
    "role" VARCHAR(100),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "related_party_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "region" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_sla_policy_branch_overrides" (
    "id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "sla_hours" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "credit_sla_policy_branch_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_applications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "application_no" VARCHAR(50) NOT NULL,
    "state" "ApplicationState" NOT NULL DEFAULT 'DRAFT',
    "borrower_profile_id" UUID NOT NULL,
    "branch_id" UUID,
    "product_type" "CreditProductType" NOT NULL,
    "purpose" TEXT,
    "requested_amount" DECIMAL(15,2) NOT NULL,
    "requested_tenor" INTEGER,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'MYR',
    "lane" "ProcessingLane" NOT NULL DEFAULT 'CORPORATE',
    "risk_rating" "RiskRating",
    "risk_rating_updated_at" TIMESTAMP(6),
    "assigned_rm_id" UUID,
    "assigned_analyst_id" UUID,
    "submitted_at" TIMESTAMP(6),
    "decisioned_at" TIMESTAMP(6),
    "closed_at" TIMESTAMP(6),
    "rejection_reason" TEXT,
    "rejection_reason_code" "RejectionReasonCode",
    "withdrawal_reason" TEXT,
    "parent_application_id" UUID,
    "customer_group_name" VARCHAR(255),
    "cif_no" VARCHAR(50),
    "application_type" "ApplicationType",
    "originating_department" VARCHAR(150),
    "team_lead_name" VARCHAR(150),
    "referred_by" VARCHAR(255),
    "account_classification" "AccountClassification",
    "connected_party_flag" BOOLEAN NOT NULL DEFAULT false,
    "connected_party_staff_name" VARCHAR(255),
    "complete_docs_date" DATE,
    "last_review_date" DATE,
    "next_review_date" DATE,
    "relationship_since" DATE,
    "last_site_visit_date" DATE,
    "preamble_text" TEXT,
    "matters_to_highlight" TEXT,
    "transaction_details_text" TEXT,
    "account_strategy" "AccountStrategy",
    "cross_selling_initiatives" TEXT,
    "first_way_out" TEXT,
    "second_way_out" TEXT,
    "other_way_out" TEXT,
    "prepared_at" TIMESTAMP(6),
    "reviewed_at" TIMESTAMP(6),
    "concurred_at" TIMESTAMP(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "loo_generated_at" TIMESTAMP(6),
    "loo_expiry_date" DATE,
    "loo_generated_by_id" UUID,
    "loo_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "credit_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_application_drafts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "credit_application_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_onboarding_runs" (
    "idempotency_key" VARCHAR(160) NOT NULL,
    "user_id" UUID NOT NULL,
    "borrower_id" UUID,
    "status" VARCHAR(32) NOT NULL DEFAULT 'PROCESSING',
    "stages" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "borrower_onboarding_runs_pkey" PRIMARY KEY ("idempotency_key")
);

-- CreateTable
CREATE TABLE "application_facilities" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "facility_type" "FacilityType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "tenor_months" INTEGER,
    "rate_pct" DECIMAL(5,4),
    "purpose" TEXT,
    "approved_amount" DECIMAL(15,2),
    "approved_tenor" INTEGER,
    "approved_rate" DECIMAL(5,4),
    "pricing_label" VARCHAR(100),
    "existing_limit" DECIMAL(15,2),
    "proposed_change" DECIMAL(15,2),
    "new_limit" DECIMAL(15,2),
    "outstanding_balance" DECIMAL(15,2),
    "undisbursed_limit" DECIMAL(15,2),
    "approving_level" VARCHAR(100),
    "request_item_id" UUID,
    "sme_lane_config" JSONB,
    "repayment_type" "RepaymentType",
    "repayment_frequency" "RepaymentFrequency",
    "source_of_repayment" TEXT,
    "security_requirement" TEXT,
    "recommended_amount" DECIMAL(15,2),
    "deleted_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "application_facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_worksheets" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "base_rate_type" "BaseRateType" NOT NULL DEFAULT 'FIXED',
    "base_rate_pct" DECIMAL(6,4) NOT NULL,
    "credit_spread_pct" DECIMAL(6,4) NOT NULL,
    "risk_premium_pct" DECIMAL(6,4) NOT NULL,
    "administration_fee_pct" DECIMAL(6,4),
    "processing_fee_flat" DECIMAL(15,2),
    "effective_rate_pct" DECIMAL(6,4) NOT NULL,
    "effective_yield_pct" DECIMAL(6,4),
    "pricing_justification" TEXT,
    "prepared_by_id" UUID NOT NULL,
    "prepared_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "pricing_worksheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_items" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "request_type" "CaRequestType" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 1,
    "approving_level" VARCHAR(100),
    "rationale" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exposure_summaries" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "this_app_secured" DECIMAL(15,2),
    "this_app_unsecured" DECIMAL(15,2),
    "other_app_secured" DECIMAL(15,2),
    "other_app_unsecured" DECIMAL(15,2),
    "customer_total_secured" DECIMAL(15,2),
    "customer_total_unsecured" DECIMAL(15,2),
    "related_counterparty_secured" DECIMAL(15,2),
    "related_counterparty_unsecured" DECIMAL(15,2),
    "group_total_secured" DECIMAL(15,2),
    "group_total_unsecured" DECIMAL(15,2),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "exposure_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_ratings" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "subject_type" VARCHAR(50) NOT NULL,
    "subject_name" VARCHAR(255),
    "agency" "RatingAgency" NOT NULL,
    "rating" VARCHAR(20) NOT NULL,
    "rating_date" DATE,
    "outlook" VARCHAR(50),
    "fiscal_year" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "external_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecl_snapshots" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "subject_type" VARCHAR(50) NOT NULL,
    "subject_name" VARCHAR(255),
    "snapshot_date" DATE NOT NULL,
    "mia_count" INTEGER,
    "mfrs_stage" "MfrsStage",
    "total_outstanding" DECIMAL(15,2),
    "pd_pct" DECIMAL(8,6),
    "lgd_pct" DECIMAL(8,6),
    "loss_rate_pct" DECIMAL(8,6),
    "ecl_amount" DECIMAL(15,2),
    "potential_ecl_writeback" DECIMAL(15,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ecl_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecl_forecasts" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "forecast_year" INTEGER NOT NULL,
    "mfrs_stage" "MfrsStage",
    "ecl_amount" DECIMAL(15,2),
    "pd_pct" DECIMAL(8,6),
    "lgd_pct" DECIMAL(8,6),
    "assumptions" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ecl_forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashflow_projections" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "assumptions" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "cashflow_projections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projection_line_items" (
    "id" UUID NOT NULL,
    "projection_id" UUID NOT NULL,
    "line_key" VARCHAR(100) NOT NULL,
    "line_label" VARCHAR(200) NOT NULL,
    "projection_year" INTEGER NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "projection_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensitivity_scenarios" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "scenario" "ProjectionScenario" NOT NULL,
    "label" VARCHAR(100),
    "assumptions" TEXT,
    "revenue_amount" DECIMAL(15,2),
    "op_cashflow" DECIMAL(15,2),
    "ebitda" DECIMAL(15,2),
    "financing_costs" DECIMAL(15,2),
    "gearing_ratio" DECIMAL(8,4),
    "dscr" DECIMAL(8,4),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "sensitivity_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_parties" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "borrower_profile_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "liability_pct" DECIMAL(5,2),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "application_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_documents" (
    "id" UUID NOT NULL,
    "application_id" UUID,
    "borrower_profile_id" UUID NOT NULL,
    "classification" "DocumentClass" NOT NULL,
    "file_name" VARCHAR(500) NOT NULL,
    "file_path" VARCHAR(1000) NOT NULL,
    "file_size" INTEGER,
    "mime_type" VARCHAR(100),
    "sha256_hash" VARCHAR(64),
    "is_av_clean" BOOLEAN,
    "uploaded_by_id" UUID NOT NULL,
    "description" TEXT,
    "verification_status" VARCHAR(30),
    "verified_by_id" UUID,
    "verified_at" TIMESTAMP(6),
    "rejection_reason" TEXT,
    "deleted_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "credit_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_document_versions" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "file_path" VARCHAR(1000) NOT NULL,
    "file_name" VARCHAR(500) NOT NULL,
    "file_size" INTEGER,
    "sha256_hash" VARCHAR(64),
    "change_summary" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_requirements" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "document_class" "DocumentClass" NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "is_collected" BOOLEAN NOT NULL DEFAULT false,
    "collected_doc_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "document_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_policy_parameters" (
    "id" UUID NOT NULL,
    "key" VARCHAR(150) NOT NULL,
    "value" JSONB NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "product_type" "CreditProductType",
    "lane" "ProcessingLane",
    "borrower_type" "BorrowerType",
    "effective_from" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "credit_policy_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_rule_configs" (
    "id" UUID NOT NULL,
    "kind" "RuleConfigKind" NOT NULL,
    "product_type" "CreditProductType",
    "lane" "ProcessingLane",
    "borrower_type" "BorrowerType",
    "document_class" "DocumentClass",
    "document_label" VARCHAR(255),
    "field_path" VARCHAR(255),
    "field_label" VARCHAR(255),
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "credit_rule_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_audit_events" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "old_state" VARCHAR(30),
    "new_state" VARCHAR(30),
    "metadata" JSONB,
    "hash" VARCHAR(64),
    "hash_version" INTEGER NOT NULL DEFAULT 1,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_sla_policies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "target_state" VARCHAR(30) NOT NULL,
    "sla_hours" INTEGER NOT NULL,
    "notify_roles" TEXT[],
    "escalate_after_hours" INTEGER,
    "escalate_to_state" VARCHAR(30),
    "product_type" VARCHAR(30),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "credit_sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_sla_breaches" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "breached_at" TIMESTAMP(6) NOT NULL,
    "acknowledged_at" TIMESTAMP(6),
    "resolved_at" TIMESTAMP(6),
    "escalation_notified_at" TIMESTAMP(6),
    "escalated_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_sla_breaches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaterals" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "collateral_type" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "title_reference" VARCHAR(255),
    "registered_to" VARCHAR(255),
    "market_value" DECIMAL(15,2),
    "forced_sale_value" DECIMAL(15,2),
    "valuation_date" DATE,
    "valuer" VARCHAR(255),
    "insurance_cover_required" BOOLEAN NOT NULL DEFAULT false,
    "security_category" "SecurityCategory",
    "security_sub_type" VARCHAR(100),
    "is_existing" BOOLEAN NOT NULL DEFAULT true,
    "is_new_to_be_obtained" BOOLEAN NOT NULL DEFAULT false,
    "pmmd_market_value" DECIMAL(15,2),
    "pmmd_forced_sale_value" DECIMAL(15,2),
    "panel_valuer_name" VARCHAR(255),
    "security_coverage_ratio" DECIMAL(8,4),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "soft_deleted_at" TIMESTAMP(6),
    "soft_deleted_by_id" UUID,
    "soft_delete_reason" VARCHAR(500),

    CONSTRAINT "collaterals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collateral_haircut_configs" (
    "id" UUID NOT NULL,
    "security_category" VARCHAR(50) NOT NULL,
    "haircut_percent" DECIMAL(5,4) NOT NULL,
    "min_valuation_age_months" INTEGER NOT NULL DEFAULT 12,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "collateral_haircut_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collateral_application_links" (
    "id" UUID NOT NULL,
    "collateral_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "linked_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linked_by_id" UUID NOT NULL,

    CONSTRAINT "collateral_application_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collateral_valuations" (
    "id" UUID NOT NULL,
    "collateral_id" UUID NOT NULL,
    "market_value" DECIMAL(15,2) NOT NULL,
    "forced_sale_value" DECIMAL(15,2) NOT NULL,
    "valuation_date" DATE NOT NULL,
    "valuer" VARCHAR(255) NOT NULL,
    "report_reference" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collateral_valuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collateral_liens" (
    "id" UUID NOT NULL,
    "collateral_id" UUID NOT NULL,
    "lien_holder" VARCHAR(255) NOT NULL,
    "lien_amount" DECIMAL(15,2),
    "priority" INTEGER NOT NULL DEFAULT 1,
    "registered_at" DATE,
    "discharge_date" DATE,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "collateral_liens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_covers" (
    "id" UUID NOT NULL,
    "collateral_id" UUID NOT NULL,
    "insurer" VARCHAR(255) NOT NULL,
    "policy_number" VARCHAR(100),
    "coverage_amount" DECIMAL(15,2) NOT NULL,
    "effective_date" DATE NOT NULL,
    "expiry_date" DATE NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "insurance_covers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guarantees" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "guarantor_profile_id" UUID NOT NULL,
    "guarantee_type" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "is_limited" BOOLEAN NOT NULL DEFAULT true,
    "contingent_liabilities" DECIMAL(15,2),
    "estimated_net_worth" DECIMAL(15,2),
    "guarantor_risk_rating_snapshot" VARCHAR(20),
    "remarks" TEXT,
    "is_related_party" BOOLEAN NOT NULL DEFAULT false,
    "related_party_role" VARCHAR(20),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "guarantees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_profitabilities" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "reporting_period" VARCHAR(50),
    "notes" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "account_profitabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profitability_lines" (
    "id" UUID NOT NULL,
    "profitability_id" UUID NOT NULL,
    "product_category" VARCHAR(100) NOT NULL,
    "net_profit_ytd" DECIMAL(15,2),
    "net_profit_projected" DECIMAL(15,2),
    "fee_income_ytd" DECIMAL(15,2),
    "fee_income_projected" DECIMAL(15,2),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "profitability_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_shares" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "facility_type" VARCHAR(100) NOT NULL,
    "our_limit_amount" DECIMAL(15,2),
    "total_market_amount" DECIMAL(15,2),
    "our_share_pct" DECIMAL(5,2),
    "yoy_change_pct" DECIMAL(5,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "wallet_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_counterparties" (
    "id" UUID NOT NULL,
    "borrower_profile_id" UUID NOT NULL,
    "role" "CounterpartyRole" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "telephone" VARCHAR(50),
    "years_of_relationship" INTEGER,
    "credit_terms_days" INTEGER,
    "sales_or_purchase_pct" DECIMAL(5,2),
    "mode_of_payment" VARCHAR(100),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "key_counterparties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_utilisation_snapshots" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "account_no" VARCHAR(50) NOT NULL,
    "facility_type" VARCHAR(100) NOT NULL,
    "snapshot_month" DATE NOT NULL,
    "withdrawal_amount" DECIMAL(15,2),
    "deposit_amount" DECIMAL(15,2),
    "month_end_balance" DECIMAL(15,2),
    "returned_cheques_count" INTEGER,
    "approved_limit" DECIMAL(15,2),
    "outstanding_amount" DECIMAL(15,2),
    "overdue_amount" DECIMAL(15,2),
    "instalments_in_arrears" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "account_utilisation_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_decisions" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "decision_type" "ApprovalDecisionType" NOT NULL,
    "decided_by_id" UUID NOT NULL,
    "decision_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authority_level" VARCHAR(50),
    "conditions" TEXT,
    "comments" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_recommendations" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "recommendation_type" VARCHAR(20) NOT NULL,
    "recommended_amount" DECIMAL(15,2),
    "recommended_tenor_months" INTEGER,
    "pricing_terms" JSONB,
    "conditions" TEXT,
    "rationale" TEXT,
    "submitted_at" TIMESTAMP(6),
    "superseded_at" TIMESTAMP(6),
    "superseded_by_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "credit_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditions" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" "ConditionCategory" NOT NULL DEFAULT 'PRE_DISBURSEMENT',
    "condition_type" "ConditionType" NOT NULL DEFAULT 'PRECEDENT',
    "status" "ConditionStatus" NOT NULL DEFAULT 'PENDING',
    "due_date" DATE,
    "is_fulfilled" BOOLEAN NOT NULL DEFAULT false,
    "fulfilled_at" TIMESTAMP(6),
    "fulfilled_by_id" UUID,
    "fulfilment_notes" TEXT,
    "waiver_reason" TEXT,
    "waived_at" TIMESTAMP(6),
    "waived_by_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "decision_id" UUID,

    CONSTRAINT "conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disbursement_orders" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "order_no" VARCHAR(30) NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "requested_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(6),
    "disbursed_by_id" UUID,
    "disbursed_at" TIMESTAMP(6),
    "status" "DisbursementStatus" NOT NULL DEFAULT 'PENDING',
    "total_amount" DECIMAL(15,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'MYR',
    "disbursement_method" VARCHAR(100),
    "beneficiary_bank" VARCHAR(255),
    "beneficiary_account" VARCHAR(50),
    "reference_note" TEXT,
    "cancelled_by_id" UUID,
    "cancelled_at" TIMESTAMP(6),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "disbursement_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_approval_matrices" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "min_exposure" DECIMAL(15,2) NOT NULL,
    "max_exposure" DECIMAL(15,2) NOT NULL,
    "min_rating" "RiskRating" NOT NULL,
    "max_rating" "RiskRating" NOT NULL,
    "authority_level" VARCHAR(50) NOT NULL,
    "required_approver_count" INTEGER NOT NULL DEFAULT 1,
    "branch_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(6) NOT NULL,
    "effective_to" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "credit_approval_matrices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_approval_matrix_versions" (
    "id" UUID NOT NULL,
    "matrix_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "approved_by_id" UUID NOT NULL,
    "approved_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_approval_matrix_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_statements" (
    "id" UUID NOT NULL,
    "borrower_profile_id" UUID NOT NULL,
    "period" "FinancialPeriod" NOT NULL,
    "fiscal_year_end" DATE NOT NULL,
    "statement_type" "FinancialStatementType" NOT NULL,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'MYR',
    "entered_by_id" UUID NOT NULL,
    "reviewed_by_id" UUID,
    "status" "FinancialStatus" NOT NULL DEFAULT 'DRAFT',
    "auditor_name" VARCHAR(255),
    "is_qualified" BOOLEAN,
    "qualification_notes" TEXT,
    "is_draft_accounts" BOOLEAN NOT NULL DEFAULT false,
    "commentary_sales_profitability" TEXT,
    "commentary_asset_mgmt" TEXT,
    "commentary_debt_mgmt" TEXT,
    "commentary_cashflow" TEXT,
    "commentary_conclusion" TEXT,
    "deleted_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "financial_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_line_items" (
    "id" UUID NOT NULL,
    "statement_id" UUID NOT NULL,
    "line_key" VARCHAR(100) NOT NULL,
    "line_label" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "parent_line_key" VARCHAR(100),
    "display_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "financial_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_ratios" (
    "id" UUID NOT NULL,
    "statement_id" UUID NOT NULL,
    "ratio_key" VARCHAR(100) NOT NULL,
    "ratio_label" VARCHAR(200) NOT NULL,
    "value" DECIMAL(10,4) NOT NULL,
    "category" "RatioCategory" NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "financial_ratios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_scorecards" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "product_type" "CreditProductType",
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "credit_scorecards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_factor_definitions" (
    "id" UUID NOT NULL,
    "factor_key" VARCHAR(50) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "input_source_type" VARCHAR(20) NOT NULL,
    "applicable_borrower_types" VARCHAR(200) NOT NULL DEFAULT 'INDIVIDUAL,SOLE_PROPRIETOR,CORPORATE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(6),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "predecessor_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "score_factor_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_memo_versions" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "html_content" TEXT NOT NULL,
    "pdf_url" VARCHAR(500),
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_at" TIMESTAMP(6),
    "locked_by_id" UUID,
    "generated_by_id" UUID,
    "data_snapshot" JSONB,
    "governance_warnings" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_memo_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_band_configs" (
    "id" UUID NOT NULL,
    "score_min" INTEGER NOT NULL,
    "score_max" INTEGER NOT NULL,
    "rating" "RiskRating" NOT NULL,
    "risk_category" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "name" VARCHAR(200),
    "description" TEXT,
    "effective_from" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "approved_by_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "rating_band_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_scorecard_versions" (
    "id" UUID NOT NULL,
    "scorecard_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "factorWeights" JSONB NOT NULL,
    "retail_factor_weights" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "effective_from" TIMESTAMP(6) NOT NULL,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "credit_scorecard_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_score_runs" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "scorecard_version_id" UUID NOT NULL,
    "factorScores" JSONB NOT NULL,
    "total_score" DECIMAL(10,2) NOT NULL,
    "risk_rating" "RiskRating" NOT NULL,
    "is_override" BOOLEAN NOT NULL DEFAULT false,
    "override_reason" TEXT,
    "override_approved_by_id" UUID,
    "override_approved_at" TIMESTAMP(6),
    "base_risk_rating" "RiskRating",
    "bureau_caps_applied" JSONB,
    "run_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculated_by_id" UUID,
    "calculation_source" VARCHAR(20),
    "input_snapshot" JSONB,
    "policy_version" VARCHAR(50),
    "missing_inputs" JSONB,
    "score_run_warnings" JSONB,
    "rating_band_version" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "credit_score_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_assessment_results" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "score_run_id" UUID,
    "final_risk_rating" VARCHAR(20),
    "risk_category" VARCHAR(50),
    "decision_recommendation" VARCHAR(20),
    "reason_codes" JSONB,
    "rule_trace" JSONB,
    "missing_inputs" JSONB,
    "model_version" VARCHAR(50),
    "policy_version" VARCHAR(50),
    "rating_band_version" INTEGER,
    "total_score" DECIMAL(10,2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'FROZEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID,
    "reviewed_by_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "application_assessment_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qualitative_assessments" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "management_score" INTEGER NOT NULL DEFAULT 3,
    "relationship_score" INTEGER NOT NULL DEFAULT 3,
    "industry_score" INTEGER NOT NULL DEFAULT 3,
    "collateral_score" INTEGER NOT NULL DEFAULT 3,
    "assessed_by_id" UUID NOT NULL,
    "assessed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "qualitative_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_incomes" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "employment_type" "EmploymentType" NOT NULL,
    "employer_name" VARCHAR(255),
    "monthly_gross_income" DECIMAL(15,2) NOT NULL,
    "epf_monthly_amount" DECIMAL(15,2),
    "hire_purchase_commitment" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "credit_card_commitment" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "existing_loan_commitment" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "other_commitments" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "proposed_instalment" DECIMAL(15,2),
    "dsr_percent" DECIMAL(5,2),
    "monthly_net_income" DECIMAL(15,2),
    "monthly_tax_deduction" DECIMAL(15,2) DEFAULT 0,
    "monthly_socso_deduction" DECIMAL(15,2) DEFAULT 0,
    "net_dsr_percent" DECIMAL(5,2),
    "dsr_basis" VARCHAR(10) DEFAULT 'GROSS',
    "financials_verified" BOOLEAN NOT NULL DEFAULT false,
    "financials_verified_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "retail_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_meetings" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "scheduled_at" TIMESTAMP(6) NOT NULL,
    "location" VARCHAR(200),
    "status" "CommitteeMeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "quorum_min" INTEGER NOT NULL DEFAULT 3,
    "meeting_type" "CommitteeMeetingType" NOT NULL DEFAULT 'REGULAR',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "committee_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_members" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "CommitteeMemberRole" NOT NULL,
    "attendance" "CommitteeAttendance" NOT NULL DEFAULT 'ABSENT',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "committee_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_agenda_items" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "display_order" INTEGER NOT NULL,
    "decision_type" "AgendaItemDecisionType" NOT NULL DEFAULT 'APPROVE',
    "presented_by_id" UUID,
    "decision_result" "AgendaItemDecisionType",
    "decided_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "committee_agenda_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_votes" (
    "id" UUID NOT NULL,
    "agenda_item_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "vote" "CommitteeVoteChoice" NOT NULL,
    "comments" TEXT,
    "voted_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "committee_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_health" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "health_status" "HealthStatus" NOT NULL DEFAULT 'HEALTHY',
    "last_review_date" DATE,
    "next_review_date" DATE,
    "review_frequency" "CovenantFrequency" NOT NULL DEFAULT 'QUARTERLY',
    "notes" TEXT,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "facility_health_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "covenant_definitions" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "covenant_type" "CovenantType" NOT NULL,
    "metric_key" VARCHAR(100),
    "threshold" DECIMAL(15,2),
    "frequency" "CovenantFrequency" NOT NULL DEFAULT 'QUARTERLY',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "covenant_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "covenant_tests" (
    "id" UUID NOT NULL,
    "covenant_id" UUID NOT NULL,
    "test_date" DATE NOT NULL,
    "reported_value" DECIMAL(15,2),
    "is_compliant" BOOLEAN NOT NULL,
    "tested_by_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "covenant_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "due_date" DATE NOT NULL,
    "paid_date" DATE,
    "amount" DECIMAL(15,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'ON_TIME',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "early_warning_signals" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "signal_type" "SignalType" NOT NULL,
    "severity" "EarlyWarningSeverity" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "opened_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(6),
    "resolved_by_id" UUID,
    "covenant_id" UUID,
    "condition_id" UUID,

    CONSTRAINT "early_warning_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pii_read_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "resource_type" VARCHAR(50) NOT NULL,
    "resource_id" UUID NOT NULL,
    "field" VARCHAR(100) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pii_read_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_export_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "report_type" VARCHAR(50) NOT NULL,
    "filters" TEXT,
    "row_count" INTEGER,
    "format" VARCHAR(10) NOT NULL,
    "ip" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_export_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_override_approvals" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "original_rating" VARCHAR(20) NOT NULL,
    "override_rating" VARCHAR(20) NOT NULL,
    "notch_delta" INTEGER NOT NULL,
    "justification" TEXT NOT NULL,
    "first_approver_id" UUID NOT NULL,
    "first_approved_at" TIMESTAMP(6) NOT NULL,
    "second_approver_id" UUID,
    "second_approved_at" TIMESTAMP(6),
    "status" "ScoreOverrideStatus" NOT NULL DEFAULT 'PENDING_SECOND_APPROVAL',
    "score_run_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "score_override_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_bureau_checks" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "provider" "BureauProvider" NOT NULL,
    "subject_name" VARCHAR(255),
    "run_date" DATE,
    "run_by_id" UUID,
    "has_hits" BOOLEAN,
    "findings" TEXT,
    "attached_doc_id" UUID,
    "ccris_outstanding_facilities" INTEGER,
    "ccris_total_outstanding_balance" DECIMAL(15,2),
    "ccris_saa_flag" BOOLEAN NOT NULL DEFAULT false,
    "ccris_saa_count" INTEGER,
    "ccris_missed_payments_12_months" INTEGER,
    "ccris_bankruptcy_flag" BOOLEAN NOT NULL DEFAULT false,
    "ccris_legal_action_flag" BOOLEAN NOT NULL DEFAULT false,
    "ccris_report_date" DATE,
    "ctos_score" INTEGER,
    "ctos_adverse_flag" BOOLEAN NOT NULL DEFAULT false,
    "ctos_adverse_details" TEXT,
    "ctos_bankruptcy_flag" BOOLEAN NOT NULL DEFAULT false,
    "ctos_directorships_count" INTEGER,
    "ctos_report_date" DATE,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "credit_bureau_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bureau_checklists" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "ccris_uploaded" BOOLEAN NOT NULL DEFAULT false,
    "ctos_uploaded" BOOLEAN NOT NULL DEFAULT false,
    "no_adverse_record" BOOLEAN NOT NULL DEFAULT false,
    "adverse_exception_reason" TEXT,
    "aml_screening_done" BOOLEAN NOT NULL DEFAULT false,
    "ticked_by_id" UUID,
    "ticked_at" TIMESTAMP(6),
    "verified_by_id" UUID,
    "verified_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "bureau_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industry_assessments" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "sector_name" VARCHAR(255),
    "subsector_name" VARCHAR(255),
    "sector_outlook" TEXT,
    "subsector_outlook" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "industry_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_factor_matrices" (
    "id" UUID NOT NULL,
    "factor" VARCHAR(50) NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "threshold" VARCHAR(100),
    "reasonCodes" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "risk_factor_matrices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_assessments" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "risk_category" "RiskCategory" NOT NULL,
    "description" TEXT,
    "mitigation" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "factor_scores" JSONB,
    "weighted_score" DECIMAL(10,2),
    "risk_level" VARCHAR(20),
    "reason_codes" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rmd_issues" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 1,
    "issue_description" TEXT NOT NULL,
    "business_unit_response" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "rmd_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esg_assessments" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "assigned_gp" "EsgGuidingPrinciple",
    "assigned_category" "EsgCategory",
    "justification" TEXT,
    "mitigating_factors" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "esg_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sicr_assessments" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "trigger_type" "SicrTriggerType" NOT NULL,
    "triggering_event" TEXT,
    "has_hit" BOOLEAN,
    "rationale" TEXT,
    "resulting_classification" "AccountClassification",
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "sicr_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_signoffs" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "role" "SignoffRole" NOT NULL,
    "signed_by_id" UUID NOT NULL,
    "designation_snapshot" VARCHAR(255) NOT NULL,
    "signed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_signoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduler_configs" (
    "id" TEXT NOT NULL,
    "job_key" VARCHAR(80) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "mode" VARCHAR(20) NOT NULL DEFAULT 'cron',
    "cron_expr" VARCHAR(60),
    "interval_ms" INTEGER,
    "last_run_at" TIMESTAMP(6),
    "last_status" VARCHAR(20),
    "last_error" TEXT,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "updated_by" VARCHAR(100),

    CONSTRAINT "scheduler_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_duplicate_matches" (
    "id" TEXT NOT NULL,
    "entity_type" VARCHAR(20) NOT NULL,
    "entity_a_id" TEXT NOT NULL,
    "entity_b_id" TEXT NOT NULL,
    "match_fields" TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_duplicate_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompt_versions" (
    "id" TEXT NOT NULL,
    "feature" VARCHAR(50) NOT NULL,
    "version" INTEGER NOT NULL,
    "prompt_hash" VARCHAR(64) NOT NULL,
    "template" TEXT NOT NULL,
    "model" VARCHAR(50) NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_interactions" (
    "id" TEXT NOT NULL,
    "prompt_version_id" TEXT NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(100) NOT NULL,
    "user_id" UUID NOT NULL,
    "input_hash" VARCHAR(64) NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "cost_usd" DOUBLE PRECISION NOT NULL,
    "output" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_overrides" (
    "id" TEXT NOT NULL,
    "interaction_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "override_reason" TEXT NOT NULL,
    "original_output" JSONB NOT NULL,
    "override_value" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_fx_rates" (
    "id" UUID NOT NULL,
    "currency" TEXT NOT NULL,
    "rateToBase" DECIMAL(18,8) NOT NULL,
    "effective_date" TIMESTAMP(6) NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_fx_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_comments" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "parent_id" UUID,
    "author_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "application_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "secret" VARCHAR(255),
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "retry_delay_sec" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "response_code" INTEGER,
    "response_body" TEXT,
    "error" TEXT,
    "delivered_at" TIMESTAMP(6),
    "next_retry_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_counters" (
    "id" SERIAL NOT NULL,
    "prefix" VARCHAR(10) NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,
    "tenant_id" UUID,

    CONSTRAINT "request_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_duplicate_exceptions" (
    "id" UUID NOT NULL,
    "draft_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "decided_by_id" UUID,
    "matched_borrower_id" UUID NOT NULL,
    "segment" "BorrowerSegment" NOT NULL,
    "identity_fingerprint" VARCHAR(64) NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "justification" TEXT NOT NULL,
    "supporting_reference" VARCHAR(255),
    "status" "DuplicateExceptionStatus" NOT NULL DEFAULT 'PENDING',
    "decision_comment" TEXT,
    "expires_at" TIMESTAMP(6),
    "decided_at" TIMESTAMP(6),
    "consumed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "borrower_duplicate_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "users_tenant_id_agent_team_idx" ON "users"("tenant_id", "agent_team");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_manager_id_idx" ON "users"("manager_id");

-- CreateIndex
CREATE INDEX "users_entity_id_idx" ON "users"("entity_id");

-- CreateIndex
CREATE INDEX "users_delegated_to_id_idx" ON "users"("delegated_to_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "departments_tenant_id_is_active_idx" ON "departments"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "departments_tenant_id_code_key" ON "departments"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_tenant_id_id_key" ON "departments"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "department_memberships_tenant_id_user_id_idx" ON "department_memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "department_memberships_tenant_id_department_id_idx" ON "department_memberships"("tenant_id", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_memberships_tenant_id_department_id_user_id_role_key" ON "department_memberships"("tenant_id", "department_id", "user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_hash_idx" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "service_desks_tenant_id_idx" ON "service_desks"("tenant_id");

-- CreateIndex
CREATE INDEX "service_desks_department_id_idx" ON "service_desks"("department_id");

-- CreateIndex
CREATE INDEX "service_desks_auto_assign_user_id_idx" ON "service_desks"("auto_assign_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_desks_tenant_id_name_key" ON "service_desks"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "service_desks_tenant_id_code_key" ON "service_desks"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "service_categories_service_desk_id_idx" ON "service_categories"("service_desk_id");

-- CreateIndex
CREATE INDEX "service_categories_tenant_id_idx" ON "service_categories"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_service_desk_id_name_key" ON "service_categories"("service_desk_id", "name");

-- CreateIndex
CREATE INDEX "request_types_service_category_id_idx" ON "request_types"("service_category_id");

-- CreateIndex
CREATE INDEX "request_types_workflow_type_id_idx" ON "request_types"("workflow_type_id");

-- CreateIndex
CREATE INDEX "request_types_tenant_id_idx" ON "request_types"("tenant_id");

-- CreateIndex
CREATE INDEX "request_types_owner_id_idx" ON "request_types"("owner_id");

-- CreateIndex
CREATE INDEX "request_types_lifecycle_status_idx" ON "request_types"("lifecycle_status");

-- CreateIndex
CREATE UNIQUE INDEX "request_types_tenant_id_code_key" ON "request_types"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "escalation_rules_request_type_id_idx" ON "escalation_rules"("request_type_id");

-- CreateIndex
CREATE INDEX "escalation_rules_tenant_id_idx" ON "escalation_rules"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "escalation_rules_request_type_id_trigger_hours_after_breach_key" ON "escalation_rules"("request_type_id", "trigger_hours_after_breach");

-- CreateIndex
CREATE INDEX "sla_policy_versions_tenant_id_request_type_id_effective_fro_idx" ON "sla_policy_versions"("tenant_id", "request_type_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "sla_policy_versions_tenant_id_request_type_id_version_key" ON "sla_policy_versions"("tenant_id", "request_type_id", "version");

-- CreateIndex
CREATE INDEX "sla_clocks_tenant_id_status_due_at_idx" ON "sla_clocks"("tenant_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "sla_clocks_request_id_kind_idx" ON "sla_clocks"("request_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "sla_clocks_tenant_id_idempotency_key_key" ON "sla_clocks"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "sla_pause_ledger_tenant_id_clock_id_paused_at_idx" ON "sla_pause_ledger"("tenant_id", "clock_id", "paused_at");

-- CreateIndex
CREATE INDEX "sla_timer_jobs_status_run_at_idx" ON "sla_timer_jobs"("status", "run_at");

-- CreateIndex
CREATE INDEX "sla_timer_jobs_tenant_id_request_id_idx" ON "sla_timer_jobs"("tenant_id", "request_id");

-- CreateIndex
CREATE UNIQUE INDEX "sla_timer_jobs_tenant_id_idempotency_key_key" ON "sla_timer_jobs"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "sla_escalation_events_tenant_id_request_id_escalation_level_idx" ON "sla_escalation_events"("tenant_id", "request_id", "escalation_level");

-- CreateIndex
CREATE UNIQUE INDEX "sla_escalation_events_tenant_id_idempotency_key_key" ON "sla_escalation_events"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "approval_policies_request_type_id_idx" ON "approval_policies"("request_type_id");

-- CreateIndex
CREATE INDEX "approval_policies_tenant_id_idx" ON "approval_policies"("tenant_id");

-- CreateIndex
CREATE INDEX "approval_policies_is_active_idx" ON "approval_policies"("is_active");

-- CreateIndex
CREATE INDEX "approval_policy_steps_policy_id_idx" ON "approval_policy_steps"("policy_id");

-- CreateIndex
CREATE INDEX "approval_policy_steps_policy_id_step_order_idx" ON "approval_policy_steps"("policy_id", "step_order");

-- CreateIndex
CREATE INDEX "approval_policy_versions_policy_id_idx" ON "approval_policy_versions"("policy_id");

-- CreateIndex
CREATE INDEX "approval_policy_versions_status_idx" ON "approval_policy_versions"("status");

-- CreateIndex
CREATE INDEX "approval_policy_versions_policy_id_status_idx" ON "approval_policy_versions"("policy_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "approval_policy_versions_policy_id_version_number_key" ON "approval_policy_versions"("policy_id", "version_number");

-- CreateIndex
CREATE INDEX "approval_instances_request_id_idx" ON "approval_instances"("request_id");

-- CreateIndex
CREATE INDEX "approval_instances_tenant_id_idx" ON "approval_instances"("tenant_id");

-- CreateIndex
CREATE INDEX "approval_instances_policy_version_id_idx" ON "approval_instances"("policy_version_id");

-- CreateIndex
CREATE INDEX "approval_instances_status_idx" ON "approval_instances"("status");

-- CreateIndex
CREATE INDEX "approval_instance_steps_instance_id_idx" ON "approval_instance_steps"("instance_id");

-- CreateIndex
CREATE INDEX "approval_instance_steps_instance_id_step_order_idx" ON "approval_instance_steps"("instance_id", "step_order");

-- CreateIndex
CREATE INDEX "approval_instance_steps_assigned_approver_id_idx" ON "approval_instance_steps"("assigned_approver_id");

-- CreateIndex
CREATE INDEX "approval_instance_steps_status_due_at_idx" ON "approval_instance_steps"("status", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_types_code_key" ON "workflow_types"("code");

-- CreateIndex
CREATE INDEX "workflow_steps_workflow_type_id_idx" ON "workflow_steps"("workflow_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_steps_workflow_type_id_status_key" ON "workflow_steps"("workflow_type_id", "status");

-- CreateIndex
CREATE INDEX "workflow_versions_workflow_type_id_status_idx" ON "workflow_versions"("workflow_type_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_versions_workflow_type_id_version_key" ON "workflow_versions"("workflow_type_id", "version");

-- CreateIndex
CREATE INDEX "workflow_nodes_workflow_version_id_idx" ON "workflow_nodes"("workflow_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_nodes_workflow_version_id_status_code_key" ON "workflow_nodes"("workflow_version_id", "status_code");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_nodes_id_workflow_version_id_key" ON "workflow_nodes"("id", "workflow_version_id");

-- CreateIndex
CREATE INDEX "workflow_edges_workflow_version_id_idx" ON "workflow_edges"("workflow_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_edges_workflow_version_id_from_node_id_to_node_id_key" ON "workflow_edges"("workflow_version_id", "from_node_id", "to_node_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_edges_id_workflow_version_id_key" ON "workflow_edges"("id", "workflow_version_id");

-- CreateIndex
CREATE INDEX "workflow_history_tenant_id_created_at_idx" ON "workflow_history"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "workflow_history_department_id_created_at_idx" ON "workflow_history"("department_id", "created_at");

-- CreateIndex
CREATE INDEX "workflow_history_request_id_idx" ON "workflow_history"("request_id");

-- CreateIndex
CREATE INDEX "workflow_history_request_id_created_at_idx" ON "workflow_history"("request_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_history_tenant_id_idempotency_key_key" ON "workflow_history"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "workflow_command_results_tenant_id_request_id_idx" ON "workflow_command_results"("tenant_id", "request_id");

-- CreateIndex
CREATE INDEX "workflow_command_results_department_id_created_at_idx" ON "workflow_command_results"("department_id", "created_at");

-- CreateIndex
CREATE INDEX "workflow_command_results_request_id_idx" ON "workflow_command_results"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_command_results_tenant_id_idempotency_key_key" ON "workflow_command_results"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "outbox_events_published_created_at_idx" ON "outbox_events"("published", "created_at");

-- CreateIndex
CREATE INDEX "outbox_events_tenant_id_published_created_at_idx" ON "outbox_events"("tenant_id", "published", "created_at");

-- CreateIndex
CREATE INDEX "outbox_events_department_id_created_at_idx" ON "outbox_events"("department_id", "created_at");

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_id_aggregate_version_idx" ON "outbox_events"("aggregate_id", "aggregate_version");

-- CreateIndex
CREATE INDEX "outbox_events_status_next_attempt_at_idx" ON "outbox_events"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "outbox_events_status_created_at_idx" ON "outbox_events"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_tenant_id_event_type_aggregate_id_aggregate_v_key" ON "outbox_events"("tenant_id", "event_type", "aggregate_id", "aggregate_version");

-- CreateIndex
CREATE UNIQUE INDEX "requests_reference_number_key" ON "requests"("reference_number");

-- CreateIndex
CREATE INDEX "requests_reference_number_idx" ON "requests"("reference_number");

-- CreateIndex
CREATE INDEX "requests_requester_id_idx" ON "requests"("requester_id");

-- CreateIndex
CREATE INDEX "requests_status_idx" ON "requests"("status");

-- CreateIndex
CREATE INDEX "requests_service_desk_id_idx" ON "requests"("service_desk_id");

-- CreateIndex
CREATE INDEX "requests_assigned_to_id_idx" ON "requests"("assigned_to_id");

-- CreateIndex
CREATE INDEX "requests_created_at_idx" ON "requests"("created_at" DESC);

-- CreateIndex
CREATE INDEX "requests_tenant_id_idx" ON "requests"("tenant_id");

-- CreateIndex
CREATE INDEX "requests_department_id_idx" ON "requests"("department_id");

-- CreateIndex
CREATE INDEX "requests_tenant_id_status_idx" ON "requests"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "requests_tenant_id_created_at_idx" ON "requests"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "requests_tenant_id_assigned_to_id_idx" ON "requests"("tenant_id", "assigned_to_id");

-- CreateIndex
CREATE INDEX "requests_tenant_id_service_desk_id_idx" ON "requests"("tenant_id", "service_desk_id");

-- CreateIndex
CREATE UNIQUE INDEX "requests_id_tenant_id_department_id_key" ON "requests"("id", "tenant_id", "department_id");

-- CreateIndex
CREATE INDEX "request_activities_request_id_created_at_idx" ON "request_activities"("request_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "request_attachments_scan_job_id_key" ON "request_attachments"("scan_job_id");

-- CreateIndex
CREATE INDEX "request_attachments_request_id_idx" ON "request_attachments"("request_id");

-- CreateIndex
CREATE INDEX "request_attachments_tenant_id_department_id_idx" ON "request_attachments"("tenant_id", "department_id");

-- CreateIndex
CREATE INDEX "request_attachments_scan_status_idx" ON "request_attachments"("scan_status");

-- CreateIndex
CREATE UNIQUE INDEX "it_hardware_requests_request_id_key" ON "it_hardware_requests"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_leave_requests_request_id_key" ON "hr_leave_requests"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "finance_expense_reimbursements_request_id_key" ON "finance_expense_reimbursements"("request_id");

-- CreateIndex
CREATE INDEX "expense_line_items_expense_id_idx" ON "expense_line_items"("expense_id");

-- CreateIndex
CREATE INDEX "request_approvals_request_id_idx" ON "request_approvals"("request_id");

-- CreateIndex
CREATE INDEX "request_approvals_approver_id_idx" ON "request_approvals"("approver_id");

-- CreateIndex
CREATE INDEX "request_approvals_entity_id_idx" ON "request_approvals"("entity_id");

-- CreateIndex
CREATE INDEX "request_approvals_policy_id_idx" ON "request_approvals"("policy_id");

-- CreateIndex
CREATE INDEX "request_approvals_delegated_by_idx" ON "request_approvals"("delegated_by");

-- CreateIndex
CREATE INDEX "request_approvals_delegated_to_idx" ON "request_approvals"("delegated_to");

-- CreateIndex
CREATE INDEX "request_approvals_status_due_at_idx" ON "request_approvals"("status", "due_at");

-- CreateIndex
CREATE INDEX "approval_delegations_approval_id_idx" ON "approval_delegations"("approval_id");

-- CreateIndex
CREATE INDEX "approval_delegations_from_user_id_idx" ON "approval_delegations"("from_user_id");

-- CreateIndex
CREATE INDEX "approval_delegations_to_user_id_idx" ON "approval_delegations"("to_user_id");

-- CreateIndex
CREATE INDEX "approval_reminders_approval_id_idx" ON "approval_reminders"("approval_id");

-- CreateIndex
CREATE INDEX "approval_reminders_recipient_user_id_idx" ON "approval_reminders"("recipient_user_id");

-- CreateIndex
CREATE INDEX "candidates_request_id_idx" ON "candidates"("request_id");

-- CreateIndex
CREATE INDEX "candidates_tenant_id_idx" ON "candidates"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_request_id_full_name_key" ON "candidates"("request_id", "full_name");

-- CreateIndex
CREATE INDEX "candidate_resumes_request_id_idx" ON "candidate_resumes"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_resumes_candidate_id_document_type_key" ON "candidate_resumes"("candidate_id", "document_type");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_name_key" ON "notification_templates"("name");

-- CreateIndex
CREATE INDEX "notification_templates_tenant_id_idx" ON "notification_templates"("tenant_id");

-- CreateIndex
CREATE INDEX "notification_domain_events_tenant_id_occurred_at_idx" ON "notification_domain_events"("tenant_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "notification_domain_events_tenant_id_event_type_occurred_at_idx" ON "notification_domain_events"("tenant_id", "event_type", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "notification_domain_events_department_id_occurred_at_idx" ON "notification_domain_events"("department_id", "occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_domain_events_tenant_id_event_key_key" ON "notification_domain_events"("tenant_id", "event_key");

-- CreateIndex
CREATE INDEX "notification_deliveries_tenant_id_status_next_attempt_at_idx" ON "notification_deliveries"("tenant_id", "status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_recipient_id_created_at_idx" ON "notification_deliveries"("recipient_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_deliveries_department_id_created_at_idx" ON "notification_deliveries"("department_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_event_id_recipient_id_channel_key" ON "notification_deliveries"("event_id", "recipient_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_delivery_id_key" ON "notifications"("delivery_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_idx" ON "notifications"("tenant_id");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_read_at_idx" ON "notifications"("tenant_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_id_idx" ON "notifications"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "kb_articles_slug_key" ON "kb_articles"("slug");

-- CreateIndex
CREATE INDEX "kb_articles_slug_idx" ON "kb_articles"("slug");

-- CreateIndex
CREATE INDEX "kb_articles_service_desk_id_idx" ON "kb_articles"("service_desk_id");

-- CreateIndex
CREATE INDEX "kb_articles_is_published_published_at_idx" ON "kb_articles"("is_published", "published_at" DESC);

-- CreateIndex
CREATE INDEX "kb_articles_tenant_id_idx" ON "kb_articles"("tenant_id");

-- CreateIndex
CREATE INDEX "kb_articles_tenant_id_is_published_idx" ON "kb_articles"("tenant_id", "is_published");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "platform_audit_events_tenant_id_created_at_idx" ON "platform_audit_events"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "platform_audit_events_tenant_id_resource_type_resource_id_c_idx" ON "platform_audit_events"("tenant_id", "resource_type", "resource_id", "created_at");

-- CreateIndex
CREATE INDEX "platform_audit_events_actor_id_created_at_idx" ON "platform_audit_events"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "platform_audit_events_correlation_id_idx" ON "platform_audit_events"("correlation_id");

-- CreateIndex
CREATE INDEX "interview_schedules_request_id_idx" ON "interview_schedules"("request_id");

-- CreateIndex
CREATE INDEX "interview_schedules_candidate_id_idx" ON "interview_schedules"("candidate_id");

-- CreateIndex
CREATE UNIQUE INDEX "interview_schedules_request_id_candidate_id_key" ON "interview_schedules"("request_id", "candidate_id");

-- CreateIndex
CREATE INDEX "interview_feedbacks_request_id_idx" ON "interview_feedbacks"("request_id");

-- CreateIndex
CREATE INDEX "interview_feedbacks_candidate_id_idx" ON "interview_feedbacks"("candidate_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_screenings_request_id_key" ON "hr_screenings"("request_id");

-- CreateIndex
CREATE INDEX "hr_screenings_request_id_idx" ON "hr_screenings"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "letters_of_acceptance_request_id_key" ON "letters_of_acceptance"("request_id");

-- CreateIndex
CREATE INDEX "letters_of_acceptance_request_id_idx" ON "letters_of_acceptance"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_requests_request_id_key" ON "onboarding_requests"("request_id");

-- CreateIndex
CREATE INDEX "onboarding_requests_request_id_idx" ON "onboarding_requests"("request_id");

-- CreateIndex
CREATE INDEX "onboarding_requests_new_hire_id_idx" ON "onboarding_requests"("new_hire_id");

-- CreateIndex
CREATE INDEX "onboarding_requests_start_date_idx" ON "onboarding_requests"("start_date");

-- CreateIndex
CREATE INDEX "onboarding_requests_tenant_id_idx" ON "onboarding_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "onboarding_tasks_onboarding_id_idx" ON "onboarding_tasks"("onboarding_id");

-- CreateIndex
CREATE INDEX "onboarding_tasks_assigned_to_idx" ON "onboarding_tasks"("assigned_to");

-- CreateIndex
CREATE INDEX "onboarding_tasks_status_idx" ON "onboarding_tasks"("status");

-- CreateIndex
CREATE INDEX "onboarding_task_templates_task_category_idx" ON "onboarding_task_templates"("task_category");

-- CreateIndex
CREATE INDEX "onboarding_task_templates_is_active_idx" ON "onboarding_task_templates"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "offboarding_requests_request_id_key" ON "offboarding_requests"("request_id");

-- CreateIndex
CREATE INDEX "offboarding_requests_request_id_idx" ON "offboarding_requests"("request_id");

-- CreateIndex
CREATE INDEX "offboarding_requests_employee_id_idx" ON "offboarding_requests"("employee_id");

-- CreateIndex
CREATE INDEX "offboarding_requests_last_working_day_idx" ON "offboarding_requests"("last_working_day");

-- CreateIndex
CREATE INDEX "offboarding_requests_tenant_id_idx" ON "offboarding_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "offboarding_tasks_offboarding_id_idx" ON "offboarding_tasks"("offboarding_id");

-- CreateIndex
CREATE INDEX "offboarding_tasks_assigned_to_idx" ON "offboarding_tasks"("assigned_to");

-- CreateIndex
CREATE INDEX "offboarding_tasks_status_idx" ON "offboarding_tasks"("status");

-- CreateIndex
CREATE INDEX "offboarding_task_templates_task_category_idx" ON "offboarding_task_templates"("task_category");

-- CreateIndex
CREATE INDEX "offboarding_task_templates_is_active_idx" ON "offboarding_task_templates"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "banner_configs_role_status_key" ON "banner_configs"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "request_status_definitions_code_key" ON "request_status_definitions"("code");

-- CreateIndex
CREATE INDEX "request_status_definitions_is_active_category_idx" ON "request_status_definitions"("is_active", "category");

-- CreateIndex
CREATE INDEX "request_status_definitions_category_idx" ON "request_status_definitions"("category");

-- CreateIndex
CREATE INDEX "request_status_definitions_retired_at_idx" ON "request_status_definitions"("retired_at");

-- CreateIndex
CREATE INDEX "request_status_definitions_is_active_idx" ON "request_status_definitions"("is_active");

-- CreateIndex
CREATE INDEX "workflow_transitions_tenant_id_workflow_type_id_from_status_idx" ON "workflow_transitions"("tenant_id", "workflow_type_id", "from_status");

-- CreateIndex
CREATE INDEX "workflow_transitions_from_status_idx" ON "workflow_transitions"("from_status");

-- CreateIndex
CREATE INDEX "workflow_transitions_to_status_idx" ON "workflow_transitions"("to_status");

-- CreateIndex
CREATE INDEX "workflow_transitions_is_active_idx" ON "workflow_transitions"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_transitions_tenant_id_workflow_type_id_from_status_key" ON "workflow_transitions"("tenant_id", "workflow_type_id", "from_status", "to_status");

-- CreateIndex
CREATE UNIQUE INDEX "entities_code_key" ON "entities"("code");

-- CreateIndex
CREATE INDEX "entities_approver_id_idx" ON "entities"("approver_id");

-- CreateIndex
CREATE INDEX "entities_tenant_id_idx" ON "entities"("tenant_id");

-- CreateIndex
CREATE INDEX "request_type_entity_routings_request_type_id_idx" ON "request_type_entity_routings"("request_type_id");

-- CreateIndex
CREATE INDEX "catalog_entitlements_request_type_id_idx" ON "catalog_entitlements"("request_type_id");

-- CreateIndex
CREATE INDEX "catalog_entitlements_tenant_id_idx" ON "catalog_entitlements"("tenant_id");

-- CreateIndex
CREATE INDEX "catalog_entitlements_target_type_target_id_idx" ON "catalog_entitlements"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "assets_asset_tag_key" ON "assets"("asset_tag");

-- CreateIndex
CREATE UNIQUE INDEX "assets_serial_number_key" ON "assets"("serial_number");

-- CreateIndex
CREATE INDEX "assets_status_idx" ON "assets"("status");

-- CreateIndex
CREATE INDEX "assets_category_idx" ON "assets"("category");

-- CreateIndex
CREATE INDEX "assets_created_by_id_idx" ON "assets"("created_by_id");

-- CreateIndex
CREATE INDEX "assets_tenant_id_idx" ON "assets"("tenant_id");

-- CreateIndex
CREATE INDEX "asset_assignments_asset_id_idx" ON "asset_assignments"("asset_id");

-- CreateIndex
CREATE INDEX "asset_assignments_user_id_idx" ON "asset_assignments"("user_id");

-- CreateIndex
CREATE INDEX "system_settings_tenant_id_idx" ON "system_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "crm_accounts_owner_id_idx" ON "crm_accounts"("owner_id");

-- CreateIndex
CREATE INDEX "crm_accounts_name_idx" ON "crm_accounts"("name");

-- CreateIndex
CREATE INDEX "crm_accounts_industry_idx" ON "crm_accounts"("industry");

-- CreateIndex
CREATE INDEX "crm_accounts_parent_account_id_idx" ON "crm_accounts"("parent_account_id");

-- CreateIndex
CREATE INDEX "crm_accounts_tenant_id_idx" ON "crm_accounts"("tenant_id");

-- CreateIndex
CREATE INDEX "crm_contacts_account_id_idx" ON "crm_contacts"("account_id");

-- CreateIndex
CREATE INDEX "crm_contacts_email_idx" ON "crm_contacts"("email");

-- CreateIndex
CREATE INDEX "crm_contacts_tenant_id_idx" ON "crm_contacts"("tenant_id");

-- CreateIndex
CREATE INDEX "crm_contact_account_roles_contact_id_idx" ON "crm_contact_account_roles"("contact_id");

-- CreateIndex
CREATE INDEX "crm_contact_account_roles_account_id_idx" ON "crm_contact_account_roles"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_contact_account_roles_contact_id_account_id_role_key" ON "crm_contact_account_roles"("contact_id", "account_id", "role");

-- CreateIndex
CREATE INDEX "crm_leads_owner_id_idx" ON "crm_leads"("owner_id");

-- CreateIndex
CREATE INDEX "crm_leads_status_idx" ON "crm_leads"("status");

-- CreateIndex
CREATE INDEX "crm_leads_account_id_idx" ON "crm_leads"("account_id");

-- CreateIndex
CREATE INDEX "crm_leads_contact_id_idx" ON "crm_leads"("contact_id");

-- CreateIndex
CREATE INDEX "crm_leads_territory_id_idx" ON "crm_leads"("territory_id");

-- CreateIndex
CREATE INDEX "crm_leads_tenant_id_idx" ON "crm_leads"("tenant_id");

-- CreateIndex
CREATE INDEX "crm_leads_tenant_id_status_idx" ON "crm_leads"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "crm_lead_documents_lead_id_deleted_at_idx" ON "crm_lead_documents"("lead_id", "deleted_at");

-- CreateIndex
CREATE INDEX "crm_lead_documents_tenant_id_idx" ON "crm_lead_documents"("tenant_id");

-- CreateIndex
CREATE INDEX "crm_lead_documents_uploaded_by_id_idx" ON "crm_lead_documents"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "crm_assignment_rules_territory_id_idx" ON "crm_assignment_rules"("territory_id");

-- CreateIndex
CREATE INDEX "crm_assignment_rules_is_active_priority_idx" ON "crm_assignment_rules"("is_active", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "crm_tags_name_key" ON "crm_tags"("name");

-- CreateIndex
CREATE INDEX "crm_tag_assignments_entityType_entity_id_idx" ON "crm_tag_assignments"("entityType", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_tag_assignments_tag_id_entityType_entity_id_key" ON "crm_tag_assignments"("tag_id", "entityType", "entity_id");

-- CreateIndex
CREATE INDEX "crm_field_changes_entityType_entity_id_idx" ON "crm_field_changes"("entityType", "entity_id");

-- CreateIndex
CREATE INDEX "crm_field_changes_field_idx" ON "crm_field_changes"("field");

-- CreateIndex
CREATE INDEX "crm_pipelines_tenant_id_idx" ON "crm_pipelines"("tenant_id");

-- CreateIndex
CREATE INDEX "crm_pipeline_stages_pipeline_id_idx" ON "crm_pipeline_stages"("pipeline_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_pipeline_stages_pipeline_id_display_order_key" ON "crm_pipeline_stages"("pipeline_id", "display_order");

-- CreateIndex
CREATE INDEX "crm_opportunities_account_id_idx" ON "crm_opportunities"("account_id");

-- CreateIndex
CREATE INDEX "crm_opportunities_pipeline_id_idx" ON "crm_opportunities"("pipeline_id");

-- CreateIndex
CREATE INDEX "crm_opportunities_stage_id_idx" ON "crm_opportunities"("stage_id");

-- CreateIndex
CREATE INDEX "crm_opportunities_owner_id_idx" ON "crm_opportunities"("owner_id");

-- CreateIndex
CREATE INDEX "crm_opportunities_expected_close_date_idx" ON "crm_opportunities"("expected_close_date");

-- CreateIndex
CREATE INDEX "crm_opportunities_tenant_id_idx" ON "crm_opportunities"("tenant_id");

-- CreateIndex
CREATE INDEX "crm_opportunities_tenant_id_stage_id_idx" ON "crm_opportunities"("tenant_id", "stage_id");

-- CreateIndex
CREATE INDEX "crm_opportunity_stage_history_opportunity_id_idx" ON "crm_opportunity_stage_history"("opportunity_id");

-- CreateIndex
CREATE INDEX "crm_activities_user_id_idx" ON "crm_activities"("user_id");

-- CreateIndex
CREATE INDEX "crm_activities_account_id_idx" ON "crm_activities"("account_id");

-- CreateIndex
CREATE INDEX "crm_activities_contact_id_idx" ON "crm_activities"("contact_id");

-- CreateIndex
CREATE INDEX "crm_activities_lead_id_idx" ON "crm_activities"("lead_id");

-- CreateIndex
CREATE INDEX "crm_activities_opportunity_id_idx" ON "crm_activities"("opportunity_id");

-- CreateIndex
CREATE INDEX "crm_activities_activity_type_idx" ON "crm_activities"("activity_type");

-- CreateIndex
CREATE INDEX "crm_activities_scheduled_at_idx" ON "crm_activities"("scheduled_at");

-- CreateIndex
CREATE INDEX "crm_activities_created_at_idx" ON "crm_activities"("created_at" DESC);

-- CreateIndex
CREATE INDEX "crm_notes_author_id_idx" ON "crm_notes"("author_id");

-- CreateIndex
CREATE INDEX "crm_notes_account_id_idx" ON "crm_notes"("account_id");

-- CreateIndex
CREATE INDEX "crm_notes_contact_id_idx" ON "crm_notes"("contact_id");

-- CreateIndex
CREATE INDEX "crm_notes_lead_id_idx" ON "crm_notes"("lead_id");

-- CreateIndex
CREATE INDEX "crm_notes_opportunity_id_idx" ON "crm_notes"("opportunity_id");

-- CreateIndex
CREATE INDEX "crm_notes_created_at_idx" ON "crm_notes"("created_at" DESC);

-- CreateIndex
CREATE INDEX "crm_account_requests_account_id_idx" ON "crm_account_requests"("account_id");

-- CreateIndex
CREATE INDEX "crm_account_requests_request_id_idx" ON "crm_account_requests"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_account_requests_account_id_request_id_key" ON "crm_account_requests"("account_id", "request_id");

-- CreateIndex
CREATE INDEX "crm_beneficiaries_contact_id_idx" ON "crm_beneficiaries"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_trust_products_opportunity_id_key" ON "crm_trust_products"("opportunity_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_trust_products_deed_ref_number_key" ON "crm_trust_products"("deed_ref_number");

-- CreateIndex
CREATE INDEX "crm_trust_products_account_id_idx" ON "crm_trust_products"("account_id");

-- CreateIndex
CREATE INDEX "crm_trust_products_contact_id_idx" ON "crm_trust_products"("contact_id");

-- CreateIndex
CREATE INDEX "crm_trust_products_next_review_date_idx" ON "crm_trust_products"("next_review_date");

-- CreateIndex
CREATE INDEX "crm_trust_products_status_idx" ON "crm_trust_products"("status");

-- CreateIndex
CREATE UNIQUE INDEX "crm_kyc_records_contact_id_key" ON "crm_kyc_records"("contact_id");

-- CreateIndex
CREATE INDEX "crm_kyc_records_status_idx" ON "crm_kyc_records"("status");

-- CreateIndex
CREATE INDEX "crm_kyc_records_expires_at_idx" ON "crm_kyc_records"("expires_at");

-- CreateIndex
CREATE INDEX "crm_import_jobs_created_by_idx" ON "crm_import_jobs"("created_by");

-- CreateIndex
CREATE INDEX "crm_import_jobs_entity_idx" ON "crm_import_jobs"("entity");

-- CreateIndex
CREATE INDEX "crm_import_jobs_status_idx" ON "crm_import_jobs"("status");

-- CreateIndex
CREATE INDEX "crm_export_jobs_created_by_idx" ON "crm_export_jobs"("created_by");

-- CreateIndex
CREATE INDEX "crm_export_jobs_entity_idx" ON "crm_export_jobs"("entity");

-- CreateIndex
CREATE INDEX "crm_export_jobs_status_idx" ON "crm_export_jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "crm_territories_name_key" ON "crm_territories"("name");

-- CreateIndex
CREATE INDEX "crm_territories_created_by_idx" ON "crm_territories"("created_by");

-- CreateIndex
CREATE INDEX "crm_territories_is_active_idx" ON "crm_territories"("is_active");

-- CreateIndex
CREATE INDEX "crm_territory_members_territory_id_idx" ON "crm_territory_members"("territory_id");

-- CreateIndex
CREATE INDEX "crm_territory_members_user_id_idx" ON "crm_territory_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_territory_members_territory_id_user_id_key" ON "crm_territory_members"("territory_id", "user_id");

-- CreateIndex
CREATE INDEX "crm_quotas_territory_id_idx" ON "crm_quotas"("territory_id");

-- CreateIndex
CREATE INDEX "crm_quotas_user_id_idx" ON "crm_quotas"("user_id");

-- CreateIndex
CREATE INDEX "crm_quotas_period_idx" ON "crm_quotas"("period");

-- CreateIndex
CREATE UNIQUE INDEX "crm_dashboard_layouts_user_id_key" ON "crm_dashboard_layouts"("user_id");

-- CreateIndex
CREATE INDEX "crm_workflows_is_active_idx" ON "crm_workflows"("is_active");

-- CreateIndex
CREATE INDEX "crm_workflows_created_by_idx" ON "crm_workflows"("created_by");

-- CreateIndex
CREATE INDEX "crm_workflow_executions_workflow_id_idx" ON "crm_workflow_executions"("workflow_id");

-- CreateIndex
CREATE INDEX "crm_workflow_executions_status_idx" ON "crm_workflow_executions"("status");

-- CreateIndex
CREATE INDEX "crm_workflow_executions_triggerEntity_trigger_entity_id_idx" ON "crm_workflow_executions"("triggerEntity", "trigger_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_anomaly_configs_entityType_anomalyType_key" ON "crm_anomaly_configs"("entityType", "anomalyType");

-- CreateIndex
CREATE UNIQUE INDEX "crm_custom_field_definitions_entity_field_key_key" ON "crm_custom_field_definitions"("entity", "field_key");

-- CreateIndex
CREATE INDEX "announcements_is_published_published_at_idx" ON "announcements"("is_published", "published_at" DESC);

-- CreateIndex
CREATE INDEX "announcements_category_idx" ON "announcements"("category");

-- CreateIndex
CREATE INDEX "announcements_is_pinned_idx" ON "announcements"("is_pinned");

-- CreateIndex
CREATE INDEX "announcements_expires_at_idx" ON "announcements"("expires_at");

-- CreateIndex
CREATE INDEX "announcements_tenant_id_idx" ON "announcements"("tenant_id");

-- CreateIndex
CREATE INDEX "announcement_reads_tenant_id_idx" ON "announcement_reads"("tenant_id");

-- CreateIndex
CREATE INDEX "announcement_reads_announcement_id_idx" ON "announcement_reads"("announcement_id");

-- CreateIndex
CREATE INDEX "announcement_reads_user_id_idx" ON "announcement_reads"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_reads_announcement_id_user_id_key" ON "announcement_reads"("announcement_id", "user_id");

-- CreateIndex
CREATE INDEX "request_participants_request_id_user_id_idx" ON "request_participants"("request_id", "user_id");

-- CreateIndex
CREATE INDEX "request_participants_user_id_idx" ON "request_participants"("user_id");

-- CreateIndex
CREATE INDEX "request_participants_added_by_id_idx" ON "request_participants"("added_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "request_participants_request_id_user_id_participant_role_key" ON "request_participants"("request_id", "user_id", "participant_role");

-- CreateIndex
CREATE INDEX "feature_flags_key_idx" ON "feature_flags"("key");

-- CreateIndex
CREATE INDEX "feature_flags_category_idx" ON "feature_flags"("category");

-- CreateIndex
CREATE INDEX "feature_flags_enabled_idx" ON "feature_flags"("enabled");

-- CreateIndex
CREATE INDEX "feature_flags_tenant_id_idx" ON "feature_flags"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_app_counters_prefix_key" ON "credit_app_counters"("prefix");

-- CreateIndex
CREATE INDEX "aml_rescreen_events_borrower_profile_id_idx" ON "aml_rescreen_events"("borrower_profile_id");

-- CreateIndex
CREATE INDEX "suspicious_transactions_status_severity_idx" ON "suspicious_transactions"("status", "severity");

-- CreateIndex
CREATE INDEX "suspicious_transactions_application_id_idx" ON "suspicious_transactions"("application_id");

-- CreateIndex
CREATE INDEX "str_attachments_str_id_idx" ON "str_attachments"("str_id");

-- CreateIndex
CREATE INDEX "credit_policy_limits_type_is_active_idx" ON "credit_policy_limits"("type", "is_active");

-- CreateIndex
CREATE INDEX "credit_policy_limits_sector_idx" ON "credit_policy_limits"("sector");

-- CreateIndex
CREATE INDEX "credit_policy_limits_product_type_idx" ON "credit_policy_limits"("product_type");

-- CreateIndex
CREATE INDEX "deviation_approvals_application_id_status_idx" ON "deviation_approvals"("application_id", "status");

-- CreateIndex
CREATE INDEX "deviation_approvals_status_review_date_idx" ON "deviation_approvals"("status", "review_date");

-- CreateIndex
CREATE INDEX "deviation_approvals_policy_rule_idx" ON "deviation_approvals"("policy_rule");

-- CreateIndex
CREATE INDEX "deviation_approvals_created_by_id_idx" ON "deviation_approvals"("created_by_id");

-- CreateIndex
CREATE INDEX "consent_records_subject_id_purpose_status_idx" ON "consent_records"("subject_id", "purpose", "status");

-- CreateIndex
CREATE INDEX "consent_records_application_id_idx" ON "consent_records"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "consent_records_subject_id_subject_type_purpose_status_key" ON "consent_records"("subject_id", "subject_type", "purpose", "status");

-- CreateIndex
CREATE UNIQUE INDEX "borrower_profiles_borrower_number_key" ON "borrower_profiles"("borrower_number");

-- CreateIndex
CREATE UNIQUE INDEX "borrower_profiles_account_id_key" ON "borrower_profiles"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "borrower_profiles_contact_id_key" ON "borrower_profiles"("contact_id");

-- CreateIndex
CREATE INDEX "borrower_profiles_account_id_idx" ON "borrower_profiles"("account_id");

-- CreateIndex
CREATE INDEX "borrower_profiles_contact_id_idx" ON "borrower_profiles"("contact_id");

-- CreateIndex
CREATE INDEX "borrower_profiles_borrower_type_idx" ON "borrower_profiles"("borrower_type");

-- CreateIndex
CREATE INDEX "borrower_profiles_credit_risk_rating_idx" ON "borrower_profiles"("credit_risk_rating");

-- CreateIndex
CREATE INDEX "borrower_profiles_aml_risk_tier_idx" ON "borrower_profiles"("aml_risk_tier");

-- CreateIndex
CREATE INDEX "borrower_profiles_branch_id_idx" ON "borrower_profiles"("branch_id");

-- CreateIndex
CREATE INDEX "borrower_profiles_segment_idx" ON "borrower_profiles"("segment");

-- CreateIndex
CREATE INDEX "borrower_profiles_lifecycle_status_idx" ON "borrower_profiles"("lifecycle_status");

-- CreateIndex
CREATE INDEX "borrower_profiles_relationship_owner_id_idx" ON "borrower_profiles"("relationship_owner_id");

-- CreateIndex
CREATE INDEX "borrower_profiles_segment_lifecycle_status_idx" ON "borrower_profiles"("segment", "lifecycle_status");

-- CreateIndex
CREATE INDEX "borrower_profiles_registration_number_normalized_idx" ON "borrower_profiles"("registration_number_normalized");

-- CreateIndex
CREATE INDEX "borrower_profiles_nric_passport_normalized_idx" ON "borrower_profiles"("nric_passport_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "borrower_credit_profiles_borrower_id_key" ON "borrower_credit_profiles"("borrower_id");

-- CreateIndex
CREATE UNIQUE INDEX "borrower_incomes_borrower_id_key" ON "borrower_incomes"("borrower_id");

-- CreateIndex
CREATE INDEX "borrower_bureau_reports_borrower_id_idx" ON "borrower_bureau_reports"("borrower_id");

-- CreateIndex
CREATE INDEX "borrower_bureau_facilities_report_id_idx" ON "borrower_bureau_facilities"("report_id");

-- CreateIndex
CREATE INDEX "borrower_activities_borrower_id_created_at_idx" ON "borrower_activities"("borrower_id", "created_at");

-- CreateIndex
CREATE INDEX "borrower_risk_runs_borrower_profile_id_idx" ON "borrower_risk_runs"("borrower_profile_id");

-- CreateIndex
CREATE INDEX "borrower_risk_runs_run_at_idx" ON "borrower_risk_runs"("run_at");

-- CreateIndex
CREATE INDEX "fatca_crs_declarations_borrower_profile_id_idx" ON "fatca_crs_declarations"("borrower_profile_id");

-- CreateIndex
CREATE INDEX "directors_borrower_profile_id_idx" ON "directors"("borrower_profile_id");

-- CreateIndex
CREATE INDEX "shareholders_borrower_profile_id_idx" ON "shareholders"("borrower_profile_id");

-- CreateIndex
CREATE INDEX "ultimate_beneficial_owners_borrower_profile_id_idx" ON "ultimate_beneficial_owners"("borrower_profile_id");

-- CreateIndex
CREATE INDEX "related_party_members_group_id_idx" ON "related_party_members"("group_id");

-- CreateIndex
CREATE INDEX "related_party_members_borrower_profile_id_idx" ON "related_party_members"("borrower_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "related_party_members_group_id_borrower_profile_id_key" ON "related_party_members"("group_id", "borrower_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE INDEX "branches_tenant_id_idx" ON "branches"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_sla_policy_branch_overrides_policy_id_branch_id_key" ON "credit_sla_policy_branch_overrides"("policy_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_applications_application_no_key" ON "credit_applications"("application_no");

-- CreateIndex
CREATE INDEX "credit_applications_borrower_profile_id_idx" ON "credit_applications"("borrower_profile_id");

-- CreateIndex
CREATE INDEX "credit_applications_state_idx" ON "credit_applications"("state");

-- CreateIndex
CREATE INDEX "credit_applications_assigned_rm_id_idx" ON "credit_applications"("assigned_rm_id");

-- CreateIndex
CREATE INDEX "credit_applications_product_type_idx" ON "credit_applications"("product_type");

-- CreateIndex
CREATE INDEX "credit_applications_submitted_at_idx" ON "credit_applications"("submitted_at");

-- CreateIndex
CREATE INDEX "credit_applications_branch_id_idx" ON "credit_applications"("branch_id");

-- CreateIndex
CREATE INDEX "credit_applications_risk_rating_idx" ON "credit_applications"("risk_rating");

-- CreateIndex
CREATE INDEX "credit_applications_tenant_id_idx" ON "credit_applications"("tenant_id");

-- CreateIndex
CREATE INDEX "credit_applications_tenant_id_state_idx" ON "credit_applications"("tenant_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "credit_application_drafts_user_id_key" ON "credit_application_drafts"("user_id");

-- CreateIndex
CREATE INDEX "borrower_onboarding_runs_user_id_status_idx" ON "borrower_onboarding_runs"("user_id", "status");

-- CreateIndex
CREATE INDEX "application_facilities_application_id_idx" ON "application_facilities"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_worksheets_facility_id_key" ON "pricing_worksheets"("facility_id");

-- CreateIndex
CREATE INDEX "pricing_worksheets_facility_id_idx" ON "pricing_worksheets"("facility_id");

-- CreateIndex
CREATE INDEX "request_items_application_id_idx" ON "request_items"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "exposure_summaries_application_id_key" ON "exposure_summaries"("application_id");

-- CreateIndex
CREATE INDEX "external_ratings_application_id_idx" ON "external_ratings"("application_id");

-- CreateIndex
CREATE INDEX "ecl_snapshots_application_id_idx" ON "ecl_snapshots"("application_id");

-- CreateIndex
CREATE INDEX "ecl_forecasts_application_id_idx" ON "ecl_forecasts"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "ecl_forecasts_application_id_forecast_year_key" ON "ecl_forecasts"("application_id", "forecast_year");

-- CreateIndex
CREATE UNIQUE INDEX "cashflow_projections_application_id_key" ON "cashflow_projections"("application_id");

-- CreateIndex
CREATE INDEX "projection_line_items_projection_id_idx" ON "projection_line_items"("projection_id");

-- CreateIndex
CREATE UNIQUE INDEX "projection_line_items_projection_id_line_key_projection_yea_key" ON "projection_line_items"("projection_id", "line_key", "projection_year");

-- CreateIndex
CREATE INDEX "sensitivity_scenarios_application_id_idx" ON "sensitivity_scenarios"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "sensitivity_scenarios_application_id_scenario_key" ON "sensitivity_scenarios"("application_id", "scenario");

-- CreateIndex
CREATE INDEX "application_parties_application_id_idx" ON "application_parties"("application_id");

-- CreateIndex
CREATE INDEX "application_parties_borrower_profile_id_idx" ON "application_parties"("borrower_profile_id");

-- CreateIndex
CREATE INDEX "credit_documents_application_id_idx" ON "credit_documents"("application_id");

-- CreateIndex
CREATE INDEX "credit_documents_borrower_profile_id_idx" ON "credit_documents"("borrower_profile_id");

-- CreateIndex
CREATE INDEX "credit_documents_classification_idx" ON "credit_documents"("classification");

-- CreateIndex
CREATE INDEX "credit_documents_sha256_hash_idx" ON "credit_documents"("sha256_hash");

-- CreateIndex
CREATE INDEX "credit_documents_deleted_at_idx" ON "credit_documents"("deleted_at");

-- CreateIndex
CREATE INDEX "credit_document_versions_document_id_idx" ON "credit_document_versions"("document_id");

-- CreateIndex
CREATE INDEX "document_requirements_application_id_idx" ON "document_requirements"("application_id");

-- CreateIndex
CREATE INDEX "credit_policy_parameters_key_is_active_idx" ON "credit_policy_parameters"("key", "is_active");

-- CreateIndex
CREATE INDEX "credit_policy_parameters_category_is_active_idx" ON "credit_policy_parameters"("category", "is_active");

-- CreateIndex
CREATE INDEX "credit_policy_parameters_product_type_lane_borrower_type_idx" ON "credit_policy_parameters"("product_type", "lane", "borrower_type");

-- CreateIndex
CREATE UNIQUE INDEX "credit_policy_parameters_key_product_type_lane_borrower_typ_key" ON "credit_policy_parameters"("key", "product_type", "lane", "borrower_type", "effective_from");

-- CreateIndex
CREATE INDEX "credit_rule_configs_kind_is_active_idx" ON "credit_rule_configs"("kind", "is_active");

-- CreateIndex
CREATE INDEX "credit_rule_configs_product_type_lane_borrower_type_idx" ON "credit_rule_configs"("product_type", "lane", "borrower_type");

-- CreateIndex
CREATE INDEX "credit_audit_events_application_id_idx" ON "credit_audit_events"("application_id");

-- CreateIndex
CREATE INDEX "credit_audit_events_event_type_idx" ON "credit_audit_events"("event_type");

-- CreateIndex
CREATE INDEX "credit_audit_events_created_at_idx" ON "credit_audit_events"("created_at");

-- CreateIndex
CREATE INDEX "credit_audit_events_application_id_event_type_created_at_idx" ON "credit_audit_events"("application_id", "event_type", "created_at");

-- CreateIndex
CREATE INDEX "credit_audit_events_application_id_created_at_idx" ON "credit_audit_events"("application_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "credit_audit_events_application_id_sequence_key" ON "credit_audit_events"("application_id", "sequence");

-- CreateIndex
CREATE INDEX "credit_sla_policies_target_state_idx" ON "credit_sla_policies"("target_state");

-- CreateIndex
CREATE INDEX "credit_sla_policies_is_active_idx" ON "credit_sla_policies"("is_active");

-- CreateIndex
CREATE INDEX "credit_sla_breaches_application_id_idx" ON "credit_sla_breaches"("application_id");

-- CreateIndex
CREATE INDEX "credit_sla_breaches_policy_id_idx" ON "credit_sla_breaches"("policy_id");

-- CreateIndex
CREATE INDEX "credit_sla_breaches_breached_at_idx" ON "credit_sla_breaches"("breached_at");

-- CreateIndex
CREATE UNIQUE INDEX "credit_sla_breaches_application_id_policy_id_key" ON "credit_sla_breaches"("application_id", "policy_id");

-- CreateIndex
CREATE INDEX "collaterals_facility_id_idx" ON "collaterals"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "collateral_haircut_configs_security_category_is_active_key" ON "collateral_haircut_configs"("security_category", "is_active");

-- CreateIndex
CREATE INDEX "collateral_application_links_collateral_id_idx" ON "collateral_application_links"("collateral_id");

-- CreateIndex
CREATE INDEX "collateral_application_links_application_id_idx" ON "collateral_application_links"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "collateral_application_links_collateral_id_application_id_key" ON "collateral_application_links"("collateral_id", "application_id");

-- CreateIndex
CREATE INDEX "collateral_valuations_collateral_id_idx" ON "collateral_valuations"("collateral_id");

-- CreateIndex
CREATE INDEX "collateral_liens_collateral_id_idx" ON "collateral_liens"("collateral_id");

-- CreateIndex
CREATE INDEX "insurance_covers_collateral_id_idx" ON "insurance_covers"("collateral_id");

-- CreateIndex
CREATE INDEX "guarantees_facility_id_idx" ON "guarantees"("facility_id");

-- CreateIndex
CREATE INDEX "guarantees_guarantor_profile_id_idx" ON "guarantees"("guarantor_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_profitabilities_application_id_key" ON "account_profitabilities"("application_id");

-- CreateIndex
CREATE INDEX "profitability_lines_profitability_id_idx" ON "profitability_lines"("profitability_id");

-- CreateIndex
CREATE UNIQUE INDEX "profitability_lines_profitability_id_product_category_key" ON "profitability_lines"("profitability_id", "product_category");

-- CreateIndex
CREATE INDEX "wallet_shares_application_id_idx" ON "wallet_shares"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_shares_application_id_facility_type_key" ON "wallet_shares"("application_id", "facility_type");

-- CreateIndex
CREATE INDEX "key_counterparties_borrower_profile_id_role_idx" ON "key_counterparties"("borrower_profile_id", "role");

-- CreateIndex
CREATE INDEX "account_utilisation_snapshots_application_id_idx" ON "account_utilisation_snapshots"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_utilisation_snapshots_application_id_account_no_sna_key" ON "account_utilisation_snapshots"("application_id", "account_no", "snapshot_month");

-- CreateIndex
CREATE INDEX "credit_decisions_application_id_idx" ON "credit_decisions"("application_id");

-- CreateIndex
CREATE INDEX "credit_recommendations_application_id_idx" ON "credit_recommendations"("application_id");

-- CreateIndex
CREATE INDEX "credit_recommendations_application_id_status_idx" ON "credit_recommendations"("application_id", "status");

-- CreateIndex
CREATE INDEX "credit_recommendations_author_id_idx" ON "credit_recommendations"("author_id");

-- CreateIndex
CREATE INDEX "conditions_application_id_idx" ON "conditions"("application_id");

-- CreateIndex
CREATE INDEX "conditions_condition_type_idx" ON "conditions"("condition_type");

-- CreateIndex
CREATE INDEX "conditions_status_idx" ON "conditions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "disbursement_orders_application_id_key" ON "disbursement_orders"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "disbursement_orders_order_no_key" ON "disbursement_orders"("order_no");

-- CreateIndex
CREATE INDEX "disbursement_orders_status_idx" ON "disbursement_orders"("status");

-- CreateIndex
CREATE INDEX "credit_approval_matrices_authority_level_idx" ON "credit_approval_matrices"("authority_level");

-- CreateIndex
CREATE INDEX "credit_approval_matrices_is_active_idx" ON "credit_approval_matrices"("is_active");

-- CreateIndex
CREATE INDEX "credit_approval_matrices_effective_from_idx" ON "credit_approval_matrices"("effective_from");

-- CreateIndex
CREATE INDEX "credit_approval_matrices_branch_id_idx" ON "credit_approval_matrices"("branch_id");

-- CreateIndex
CREATE INDEX "credit_approval_matrix_versions_matrix_id_idx" ON "credit_approval_matrix_versions"("matrix_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_approval_matrix_versions_matrix_id_version_key" ON "credit_approval_matrix_versions"("matrix_id", "version");

-- CreateIndex
CREATE INDEX "financial_statements_borrower_profile_id_idx" ON "financial_statements"("borrower_profile_id");

-- CreateIndex
CREATE INDEX "financial_statements_statement_type_idx" ON "financial_statements"("statement_type");

-- CreateIndex
CREATE INDEX "financial_statements_status_idx" ON "financial_statements"("status");

-- CreateIndex
CREATE INDEX "financial_line_items_statement_id_idx" ON "financial_line_items"("statement_id");

-- CreateIndex
CREATE INDEX "financial_line_items_line_key_idx" ON "financial_line_items"("line_key");

-- CreateIndex
CREATE UNIQUE INDEX "financial_line_items_statement_id_line_key_key" ON "financial_line_items"("statement_id", "line_key");

-- CreateIndex
CREATE INDEX "financial_ratios_statement_id_idx" ON "financial_ratios"("statement_id");

-- CreateIndex
CREATE INDEX "financial_ratios_ratio_key_idx" ON "financial_ratios"("ratio_key");

-- CreateIndex
CREATE INDEX "financial_ratios_category_idx" ON "financial_ratios"("category");

-- CreateIndex
CREATE UNIQUE INDEX "financial_ratios_statement_id_ratio_key_key" ON "financial_ratios"("statement_id", "ratio_key");

-- CreateIndex
CREATE UNIQUE INDEX "credit_scorecards_name_key" ON "credit_scorecards"("name");

-- CreateIndex
CREATE INDEX "credit_scorecards_product_type_idx" ON "credit_scorecards"("product_type");

-- CreateIndex
CREATE INDEX "score_factor_definitions_factor_key_idx" ON "score_factor_definitions"("factor_key");

-- CreateIndex
CREATE INDEX "score_factor_definitions_is_active_effective_from_effective_idx" ON "score_factor_definitions"("is_active", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "score_factor_definitions_factor_key_effective_from_key" ON "score_factor_definitions"("factor_key", "effective_from");

-- CreateIndex
CREATE INDEX "credit_memo_versions_application_id_idx" ON "credit_memo_versions"("application_id");

-- CreateIndex
CREATE INDEX "credit_memo_versions_is_locked_idx" ON "credit_memo_versions"("is_locked");

-- CreateIndex
CREATE UNIQUE INDEX "credit_memo_versions_application_id_version_number_key" ON "credit_memo_versions"("application_id", "version_number");

-- CreateIndex
CREATE INDEX "rating_band_configs_effective_from_effective_to_idx" ON "rating_band_configs"("effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "rating_band_configs_rating_idx" ON "rating_band_configs"("rating");

-- CreateIndex
CREATE INDEX "rating_band_configs_status_idx" ON "rating_band_configs"("status");

-- CreateIndex
CREATE INDEX "credit_scorecard_versions_scorecard_id_idx" ON "credit_scorecard_versions"("scorecard_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_scorecard_versions_scorecard_id_version_key" ON "credit_scorecard_versions"("scorecard_id", "version");

-- CreateIndex
CREATE INDEX "credit_score_runs_application_id_idx" ON "credit_score_runs"("application_id");

-- CreateIndex
CREATE INDEX "credit_score_runs_scorecard_version_id_idx" ON "credit_score_runs"("scorecard_version_id");

-- CreateIndex
CREATE INDEX "application_assessment_results_application_id_idx" ON "application_assessment_results"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "qualitative_assessments_application_id_key" ON "qualitative_assessments"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "retail_incomes_application_id_key" ON "retail_incomes"("application_id");

-- CreateIndex
CREATE INDEX "committee_members_meeting_id_idx" ON "committee_members"("meeting_id");

-- CreateIndex
CREATE UNIQUE INDEX "committee_members_meeting_id_user_id_key" ON "committee_members"("meeting_id", "user_id");

-- CreateIndex
CREATE INDEX "committee_agenda_items_meeting_id_idx" ON "committee_agenda_items"("meeting_id");

-- CreateIndex
CREATE INDEX "committee_agenda_items_application_id_idx" ON "committee_agenda_items"("application_id");

-- CreateIndex
CREATE INDEX "committee_votes_agenda_item_id_idx" ON "committee_votes"("agenda_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "committee_votes_agenda_item_id_member_id_key" ON "committee_votes"("agenda_item_id", "member_id");

-- CreateIndex
CREATE INDEX "facility_health_health_status_idx" ON "facility_health"("health_status");

-- CreateIndex
CREATE INDEX "facility_health_next_review_date_idx" ON "facility_health"("next_review_date");

-- CreateIndex
CREATE UNIQUE INDEX "facility_health_application_id_key" ON "facility_health"("application_id");

-- CreateIndex
CREATE INDEX "covenant_definitions_application_id_idx" ON "covenant_definitions"("application_id");

-- CreateIndex
CREATE INDEX "covenant_definitions_is_active_idx" ON "covenant_definitions"("is_active");

-- CreateIndex
CREATE INDEX "covenant_tests_covenant_id_idx" ON "covenant_tests"("covenant_id");

-- CreateIndex
CREATE INDEX "covenant_tests_is_compliant_idx" ON "covenant_tests"("is_compliant");

-- CreateIndex
CREATE INDEX "covenant_tests_test_date_idx" ON "covenant_tests"("test_date");

-- CreateIndex
CREATE INDEX "payment_events_application_id_idx" ON "payment_events"("application_id");

-- CreateIndex
CREATE INDEX "payment_events_status_idx" ON "payment_events"("status");

-- CreateIndex
CREATE INDEX "payment_events_due_date_idx" ON "payment_events"("due_date");

-- CreateIndex
CREATE INDEX "early_warning_signals_application_id_idx" ON "early_warning_signals"("application_id");

-- CreateIndex
CREATE INDEX "early_warning_signals_severity_idx" ON "early_warning_signals"("severity");

-- CreateIndex
CREATE INDEX "early_warning_signals_signal_type_idx" ON "early_warning_signals"("signal_type");

-- CreateIndex
CREATE INDEX "early_warning_signals_opened_at_idx" ON "early_warning_signals"("opened_at");

-- CreateIndex
CREATE INDEX "early_warning_signals_covenant_id_idx" ON "early_warning_signals"("covenant_id");

-- CreateIndex
CREATE INDEX "early_warning_signals_condition_id_idx" ON "early_warning_signals"("condition_id");

-- CreateIndex
CREATE INDEX "pii_read_logs_user_id_idx" ON "pii_read_logs"("user_id");

-- CreateIndex
CREATE INDEX "pii_read_logs_resource_type_resource_id_idx" ON "pii_read_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "pii_read_logs_created_at_idx" ON "pii_read_logs"("created_at");

-- CreateIndex
CREATE INDEX "credit_export_events_user_id_idx" ON "credit_export_events"("user_id");

-- CreateIndex
CREATE INDEX "credit_export_events_report_type_idx" ON "credit_export_events"("report_type");

-- CreateIndex
CREATE INDEX "credit_export_events_created_at_idx" ON "credit_export_events"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "score_override_approvals_score_run_id_key" ON "score_override_approvals"("score_run_id");

-- CreateIndex
CREATE INDEX "score_override_approvals_application_id_idx" ON "score_override_approvals"("application_id");

-- CreateIndex
CREATE INDEX "score_override_approvals_status_idx" ON "score_override_approvals"("status");

-- CreateIndex
CREATE INDEX "score_override_approvals_first_approver_id_idx" ON "score_override_approvals"("first_approver_id");

-- CreateIndex
CREATE INDEX "score_override_approvals_second_approver_id_idx" ON "score_override_approvals"("second_approver_id");

-- CreateIndex
CREATE INDEX "credit_bureau_checks_application_id_idx" ON "credit_bureau_checks"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "bureau_checklists_application_id_key" ON "bureau_checklists"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "industry_assessments_application_id_key" ON "industry_assessments"("application_id");

-- CreateIndex
CREATE INDEX "risk_factor_matrices_factor_is_active_idx" ON "risk_factor_matrices"("factor", "is_active");

-- CreateIndex
CREATE INDEX "risk_assessments_application_id_idx" ON "risk_assessments"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "risk_assessments_application_id_risk_category_key" ON "risk_assessments"("application_id", "risk_category");

-- CreateIndex
CREATE INDEX "rmd_issues_application_id_idx" ON "rmd_issues"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "esg_assessments_application_id_key" ON "esg_assessments"("application_id");

-- CreateIndex
CREATE INDEX "sicr_assessments_application_id_idx" ON "sicr_assessments"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "sicr_assessments_application_id_trigger_type_key" ON "sicr_assessments"("application_id", "trigger_type");

-- CreateIndex
CREATE INDEX "application_signoffs_application_id_idx" ON "application_signoffs"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_signoffs_application_id_role_key" ON "application_signoffs"("application_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "scheduler_configs_job_key_key" ON "scheduler_configs"("job_key");

-- CreateIndex
CREATE INDEX "crm_duplicate_matches_entity_type_status_idx" ON "crm_duplicate_matches"("entity_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "crm_duplicate_matches_entity_a_id_entity_b_id_key" ON "crm_duplicate_matches"("entity_a_id", "entity_b_id");

-- CreateIndex
CREATE INDEX "ai_prompt_versions_feature_active_idx" ON "ai_prompt_versions"("feature", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompt_versions_feature_version_key" ON "ai_prompt_versions"("feature", "version");

-- CreateIndex
CREATE INDEX "ai_interactions_entity_type_entity_id_idx" ON "ai_interactions"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "ai_interactions_user_id_idx" ON "ai_interactions"("user_id");

-- CreateIndex
CREATE INDEX "ai_interactions_created_at_idx" ON "ai_interactions"("created_at");

-- CreateIndex
CREATE INDEX "ai_overrides_interaction_id_idx" ON "ai_overrides"("interaction_id");

-- CreateIndex
CREATE INDEX "credit_fx_rates_currency_effective_date_idx" ON "credit_fx_rates"("currency", "effective_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "credit_fx_rates_currency_effective_date_key" ON "credit_fx_rates"("currency", "effective_date");

-- CreateIndex
CREATE INDEX "application_comments_application_id_created_at_idx" ON "application_comments"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "application_comments_parent_id_idx" ON "application_comments"("parent_id");

-- CreateIndex
CREATE INDEX "application_comments_author_id_idx" ON "application_comments"("author_id");

-- CreateIndex
CREATE INDEX "webhook_subscriptions_tenant_id_idx" ON "webhook_subscriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "webhook_subscriptions_is_active_idx" ON "webhook_subscriptions"("is_active");

-- CreateIndex
CREATE INDEX "webhook_deliveries_subscription_id_idx" ON "webhook_deliveries"("subscription_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_status_idx" ON "webhook_deliveries"("status");

-- CreateIndex
CREATE INDEX "webhook_deliveries_created_at_idx" ON "webhook_deliveries"("created_at");

-- CreateIndex
CREATE INDEX "request_counters_tenant_id_idx" ON "request_counters"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "request_counters_tenant_id_prefix_key" ON "request_counters"("tenant_id", "prefix");

-- CreateIndex
CREATE INDEX "borrower_duplicate_exceptions_requested_by_id_idx" ON "borrower_duplicate_exceptions"("requested_by_id");

-- CreateIndex
CREATE INDEX "borrower_duplicate_exceptions_decided_by_id_idx" ON "borrower_duplicate_exceptions"("decided_by_id");

-- CreateIndex
CREATE INDEX "borrower_duplicate_exceptions_matched_borrower_id_idx" ON "borrower_duplicate_exceptions"("matched_borrower_id");

-- CreateIndex
CREATE INDEX "borrower_duplicate_exceptions_status_idx" ON "borrower_duplicate_exceptions"("status");

-- CreateIndex
CREATE INDEX "borrower_duplicate_exceptions_expires_at_idx" ON "borrower_duplicate_exceptions"("expires_at");

-- CreateIndex
CREATE INDEX "borrower_duplicate_exceptions_identity_fingerprint_idx" ON "borrower_duplicate_exceptions"("identity_fingerprint");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_delegated_to_id_fkey" FOREIGN KEY ("delegated_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_memberships" ADD CONSTRAINT "department_memberships_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_memberships" ADD CONSTRAINT "department_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_memberships" ADD CONSTRAINT "department_memberships_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_desks" ADD CONSTRAINT "service_desks_auto_assign_user_id_fkey" FOREIGN KEY ("auto_assign_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_desks" ADD CONSTRAINT "service_desks_tenant_id_department_id_fkey" FOREIGN KEY ("tenant_id", "department_id") REFERENCES "departments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_service_desk_id_fkey" FOREIGN KEY ("service_desk_id") REFERENCES "service_desks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_types" ADD CONSTRAINT "request_types_service_category_id_fkey" FOREIGN KEY ("service_category_id") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_types" ADD CONSTRAINT "request_types_workflow_type_id_fkey" FOREIGN KEY ("workflow_type_id") REFERENCES "workflow_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_types" ADD CONSTRAINT "request_types_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_rules" ADD CONSTRAINT "escalation_rules_request_type_id_fkey" FOREIGN KEY ("request_type_id") REFERENCES "request_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_clocks" ADD CONSTRAINT "sla_clocks_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_clocks" ADD CONSTRAINT "sla_clocks_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "sla_policy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_pause_ledger" ADD CONSTRAINT "sla_pause_ledger_clock_id_fkey" FOREIGN KEY ("clock_id") REFERENCES "sla_clocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_timer_jobs" ADD CONSTRAINT "sla_timer_jobs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_timer_jobs" ADD CONSTRAINT "sla_timer_jobs_clock_id_fkey" FOREIGN KEY ("clock_id") REFERENCES "sla_clocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_escalation_events" ADD CONSTRAINT "sla_escalation_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_escalation_events" ADD CONSTRAINT "sla_escalation_events_clock_id_fkey" FOREIGN KEY ("clock_id") REFERENCES "sla_clocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_policies" ADD CONSTRAINT "approval_policies_request_type_id_fkey" FOREIGN KEY ("request_type_id") REFERENCES "request_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_policy_steps" ADD CONSTRAINT "approval_policy_steps_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "approval_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_policy_versions" ADD CONSTRAINT "approval_policy_versions_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "approval_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_instances" ADD CONSTRAINT "approval_instances_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_instances" ADD CONSTRAINT "approval_instances_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "approval_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_instance_steps" ADD CONSTRAINT "approval_instance_steps_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "approval_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_type_id_fkey" FOREIGN KEY ("workflow_type_id") REFERENCES "workflow_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_type_id_fkey" FOREIGN KEY ("workflow_type_id") REFERENCES "workflow_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_nodes" ADD CONSTRAINT "workflow_nodes_workflow_version_id_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_workflow_version_id_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_from_node_id_workflow_version_id_fkey" FOREIGN KEY ("from_node_id", "workflow_version_id") REFERENCES "workflow_nodes"("id", "workflow_version_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_to_node_id_workflow_version_id_fkey" FOREIGN KEY ("to_node_id", "workflow_version_id") REFERENCES "workflow_nodes"("id", "workflow_version_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_history" ADD CONSTRAINT "workflow_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_tenant_id_department_id_fkey" FOREIGN KEY ("tenant_id", "department_id") REFERENCES "departments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_request_type_id_fkey" FOREIGN KEY ("request_type_id") REFERENCES "request_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_service_desk_id_fkey" FOREIGN KEY ("service_desk_id") REFERENCES "service_desks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_parent_request_id_fkey" FOREIGN KEY ("parent_request_id") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_activities" ADD CONSTRAINT "request_activities_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_activities" ADD CONSTRAINT "request_activities_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_attachments" ADD CONSTRAINT "request_attachments_tenant_id_department_id_fkey" FOREIGN KEY ("tenant_id", "department_id") REFERENCES "departments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_attachments" ADD CONSTRAINT "request_attachments_request_id_tenant_id_department_id_fkey" FOREIGN KEY ("request_id", "tenant_id", "department_id") REFERENCES "requests"("id", "tenant_id", "department_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_attachments" ADD CONSTRAINT "request_attachments_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "request_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_attachments" ADD CONSTRAINT "request_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_hardware_requests" ADD CONSTRAINT "it_hardware_requests_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_hardware_requests" ADD CONSTRAINT "it_hardware_requests_manager_approved_by_id_fkey" FOREIGN KEY ("manager_approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_hardware_requests" ADD CONSTRAINT "it_hardware_requests_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_requests" ADD CONSTRAINT "hr_leave_requests_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_expense_reimbursements" ADD CONSTRAINT "finance_expense_reimbursements_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_line_items" ADD CONSTRAINT "expense_line_items_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "finance_expense_reimbursements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_line_items" ADD CONSTRAINT "expense_line_items_receipt_attachment_id_fkey" FOREIGN KEY ("receipt_attachment_id") REFERENCES "request_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_approvals" ADD CONSTRAINT "request_approvals_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_approvals" ADD CONSTRAINT "request_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_approvals" ADD CONSTRAINT "request_approvals_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_approvals" ADD CONSTRAINT "request_approvals_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "approval_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_approvals" ADD CONSTRAINT "request_approvals_delegated_by_fkey" FOREIGN KEY ("delegated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_approvals" ADD CONSTRAINT "request_approvals_delegated_to_fkey" FOREIGN KEY ("delegated_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_delegations" ADD CONSTRAINT "approval_delegations_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "request_approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_delegations" ADD CONSTRAINT "approval_delegations_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_delegations" ADD CONSTRAINT "approval_delegations_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_reminders" ADD CONSTRAINT "approval_reminders_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "request_approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_reminders" ADD CONSTRAINT "approval_reminders_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_resumes" ADD CONSTRAINT "candidate_resumes_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_resumes" ADD CONSTRAINT "candidate_resumes_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_resumes" ADD CONSTRAINT "candidate_resumes_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "notification_domain_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "notification_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_request_id_fkey" FOREIGN KEY ("related_request_id") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_service_desk_id_fkey" FOREIGN KEY ("service_desk_id") REFERENCES "service_desks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_audit_events" ADD CONSTRAINT "platform_audit_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_audit_events" ADD CONSTRAINT "platform_audit_events_tenant_id_department_id_fkey" FOREIGN KEY ("tenant_id", "department_id") REFERENCES "departments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_schedules" ADD CONSTRAINT "interview_schedules_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_schedules" ADD CONSTRAINT "interview_schedules_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_schedules" ADD CONSTRAINT "interview_schedules_scheduled_by_fkey" FOREIGN KEY ("scheduled_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_feedbacks" ADD CONSTRAINT "interview_feedbacks_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_feedbacks" ADD CONSTRAINT "interview_feedbacks_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "offboarding_requests" ADD CONSTRAINT "offboarding_requests_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offboarding_requests" ADD CONSTRAINT "offboarding_requests_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offboarding_requests" ADD CONSTRAINT "offboarding_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offboarding_requests" ADD CONSTRAINT "offboarding_requests_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offboarding_tasks" ADD CONSTRAINT "offboarding_tasks_offboarding_id_fkey" FOREIGN KEY ("offboarding_id") REFERENCES "offboarding_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offboarding_tasks" ADD CONSTRAINT "offboarding_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offboarding_tasks" ADD CONSTRAINT "offboarding_tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_type_entity_routings" ADD CONSTRAINT "request_type_entity_routings_request_type_id_fkey" FOREIGN KEY ("request_type_id") REFERENCES "request_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_entitlements" ADD CONSTRAINT "catalog_entitlements_request_type_id_fkey" FOREIGN KEY ("request_type_id") REFERENCES "request_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_source_request_id_fkey" FOREIGN KEY ("source_request_id") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_linked_request_id_fkey" FOREIGN KEY ("linked_request_id") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_parent_account_id_fkey" FOREIGN KEY ("parent_account_id") REFERENCES "crm_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contact_account_roles" ADD CONSTRAINT "crm_contact_account_roles_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contact_account_roles" ADD CONSTRAINT "crm_contact_account_roles_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_territory_id_fkey" FOREIGN KEY ("territory_id") REFERENCES "crm_territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_documents" ADD CONSTRAINT "crm_lead_documents_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_documents" ADD CONSTRAINT "crm_lead_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_assignment_rules" ADD CONSTRAINT "crm_assignment_rules_territory_id_fkey" FOREIGN KEY ("territory_id") REFERENCES "crm_territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tag_assignments" ADD CONSTRAINT "crm_tag_assignments_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "crm_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_pipeline_stages" ADD CONSTRAINT "crm_pipeline_stages_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "crm_pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "crm_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "crm_pipeline_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunity_stage_history" ADD CONSTRAINT "crm_opportunity_stage_history_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_account_requests" ADD CONSTRAINT "crm_account_requests_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_account_requests" ADD CONSTRAINT "crm_account_requests_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_beneficiaries" ADD CONSTRAINT "crm_beneficiaries_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_trust_products" ADD CONSTRAINT "crm_trust_products_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_trust_products" ADD CONSTRAINT "crm_trust_products_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_trust_products" ADD CONSTRAINT "crm_trust_products_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_trust_products" ADD CONSTRAINT "crm_trust_products_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_kyc_records" ADD CONSTRAINT "crm_kyc_records_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_kyc_records" ADD CONSTRAINT "crm_kyc_records_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_import_jobs" ADD CONSTRAINT "crm_import_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_export_jobs" ADD CONSTRAINT "crm_export_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_territories" ADD CONSTRAINT "crm_territories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_territory_members" ADD CONSTRAINT "crm_territory_members_territory_id_fkey" FOREIGN KEY ("territory_id") REFERENCES "crm_territories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_territory_members" ADD CONSTRAINT "crm_territory_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_quotas" ADD CONSTRAINT "crm_quotas_territory_id_fkey" FOREIGN KEY ("territory_id") REFERENCES "crm_territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_quotas" ADD CONSTRAINT "crm_quotas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_dashboard_layouts" ADD CONSTRAINT "crm_dashboard_layouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_workflows" ADD CONSTRAINT "crm_workflows_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_workflow_executions" ADD CONSTRAINT "crm_workflow_executions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "crm_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_participants" ADD CONSTRAINT "request_participants_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_participants" ADD CONSTRAINT "request_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_participants" ADD CONSTRAINT "request_participants_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aml_rescreen_events" ADD CONSTRAINT "aml_rescreen_events_borrower_profile_id_fkey" FOREIGN KEY ("borrower_profile_id") REFERENCES "borrower_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aml_rescreen_events" ADD CONSTRAINT "aml_rescreen_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aml_rescreen_events" ADD CONSTRAINT "aml_rescreen_events_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aml_rescreen_events" ADD CONSTRAINT "aml_rescreen_events_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspicious_transactions" ADD CONSTRAINT "suspicious_transactions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspicious_transactions" ADD CONSTRAINT "suspicious_transactions_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspicious_transactions" ADD CONSTRAINT "suspicious_transactions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspicious_transactions" ADD CONSTRAINT "suspicious_transactions_aml_rescreen_event_id_fkey" FOREIGN KEY ("aml_rescreen_event_id") REFERENCES "aml_rescreen_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "str_attachments" ADD CONSTRAINT "str_attachments_str_id_fkey" FOREIGN KEY ("str_id") REFERENCES "suspicious_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "str_attachments" ADD CONSTRAINT "str_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_policy_limits" ADD CONSTRAINT "credit_policy_limits_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviation_approvals" ADD CONSTRAINT "deviation_approvals_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviation_approvals" ADD CONSTRAINT "deviation_approvals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviation_approvals" ADD CONSTRAINT "deviation_approvals_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviation_approvals" ADD CONSTRAINT "deviation_approvals_rejected_by_id_fkey" FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_withdrawn_by_id_fkey" FOREIGN KEY ("withdrawn_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_profiles" ADD CONSTRAINT "borrower_profiles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_profiles" ADD CONSTRAINT "borrower_profiles_relationship_owner_id_fkey" FOREIGN KEY ("relationship_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_profiles" ADD CONSTRAINT "borrower_profiles_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_profiles" ADD CONSTRAINT "borrower_profiles_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_credit_profiles" ADD CONSTRAINT "borrower_credit_profiles_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "borrower_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_incomes" ADD CONSTRAINT "borrower_incomes_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "borrower_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_bureau_reports" ADD CONSTRAINT "borrower_bureau_reports_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "borrower_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_bureau_reports" ADD CONSTRAINT "borrower_bureau_reports_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_bureau_facilities" ADD CONSTRAINT "borrower_bureau_facilities_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "borrower_bureau_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_activities" ADD CONSTRAINT "borrower_activities_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "borrower_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_risk_runs" ADD CONSTRAINT "borrower_risk_runs_borrower_profile_id_fkey" FOREIGN KEY ("borrower_profile_id") REFERENCES "borrower_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fatca_crs_declarations" ADD CONSTRAINT "fatca_crs_declarations_borrower_profile_id_fkey" FOREIGN KEY ("borrower_profile_id") REFERENCES "borrower_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fatca_crs_declarations" ADD CONSTRAINT "fatca_crs_declarations_self_certified_by_id_fkey" FOREIGN KEY ("self_certified_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fatca_crs_declarations" ADD CONSTRAINT "fatca_crs_declarations_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directors" ADD CONSTRAINT "directors_borrower_profile_id_fkey" FOREIGN KEY ("borrower_profile_id") REFERENCES "borrower_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directors" ADD CONSTRAINT "directors_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shareholders" ADD CONSTRAINT "shareholders_borrower_profile_id_fkey" FOREIGN KEY ("borrower_profile_id") REFERENCES "borrower_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shareholders" ADD CONSTRAINT "shareholders_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ultimate_beneficial_owners" ADD CONSTRAINT "ultimate_beneficial_owners_borrower_profile_id_fkey" FOREIGN KEY ("borrower_profile_id") REFERENCES "borrower_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "related_party_members" ADD CONSTRAINT "related_party_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "related_party_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "related_party_members" ADD CONSTRAINT "related_party_members_borrower_profile_id_fkey" FOREIGN KEY ("borrower_profile_id") REFERENCES "borrower_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_sla_policy_branch_overrides" ADD CONSTRAINT "credit_sla_policy_branch_overrides_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "credit_sla_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_sla_policy_branch_overrides" ADD CONSTRAINT "credit_sla_policy_branch_overrides_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_parent_application_id_fkey" FOREIGN KEY ("parent_application_id") REFERENCES "credit_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_borrower_profile_id_fkey" FOREIGN KEY ("borrower_profile_id") REFERENCES "borrower_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_assigned_rm_id_fkey" FOREIGN KEY ("assigned_rm_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_assigned_analyst_id_fkey" FOREIGN KEY ("assigned_analyst_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_loo_generated_by_id_fkey" FOREIGN KEY ("loo_generated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_facilities" ADD CONSTRAINT "application_facilities_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_facilities" ADD CONSTRAINT "application_facilities_request_item_id_fkey" FOREIGN KEY ("request_item_id") REFERENCES "request_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_worksheets" ADD CONSTRAINT "pricing_worksheets_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "application_facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_worksheets" ADD CONSTRAINT "pricing_worksheets_prepared_by_id_fkey" FOREIGN KEY ("prepared_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_items" ADD CONSTRAINT "request_items_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exposure_summaries" ADD CONSTRAINT "exposure_summaries_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_ratings" ADD CONSTRAINT "external_ratings_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecl_snapshots" ADD CONSTRAINT "ecl_snapshots_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecl_forecasts" ADD CONSTRAINT "ecl_forecasts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashflow_projections" ADD CONSTRAINT "cashflow_projections_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projection_line_items" ADD CONSTRAINT "projection_line_items_projection_id_fkey" FOREIGN KEY ("projection_id") REFERENCES "cashflow_projections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensitivity_scenarios" ADD CONSTRAINT "sensitivity_scenarios_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_parties" ADD CONSTRAINT "application_parties_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_parties" ADD CONSTRAINT "application_parties_borrower_profile_id_fkey" FOREIGN KEY ("borrower_profile_id") REFERENCES "borrower_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_documents" ADD CONSTRAINT "credit_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_documents" ADD CONSTRAINT "credit_documents_borrower_profile_id_fkey" FOREIGN KEY ("borrower_profile_id") REFERENCES "borrower_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_documents" ADD CONSTRAINT "credit_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_documents" ADD CONSTRAINT "credit_documents_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_document_versions" ADD CONSTRAINT "credit_document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "credit_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_audit_events" ADD CONSTRAINT "credit_audit_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_sla_breaches" ADD CONSTRAINT "credit_sla_breaches_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_sla_breaches" ADD CONSTRAINT "credit_sla_breaches_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "credit_sla_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaterals" ADD CONSTRAINT "collaterals_soft_deleted_by_id_fkey" FOREIGN KEY ("soft_deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaterals" ADD CONSTRAINT "collaterals_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "application_facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collateral_application_links" ADD CONSTRAINT "collateral_application_links_collateral_id_fkey" FOREIGN KEY ("collateral_id") REFERENCES "collaterals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collateral_application_links" ADD CONSTRAINT "collateral_application_links_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collateral_application_links" ADD CONSTRAINT "collateral_application_links_linked_by_id_fkey" FOREIGN KEY ("linked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collateral_valuations" ADD CONSTRAINT "collateral_valuations_collateral_id_fkey" FOREIGN KEY ("collateral_id") REFERENCES "collaterals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collateral_liens" ADD CONSTRAINT "collateral_liens_collateral_id_fkey" FOREIGN KEY ("collateral_id") REFERENCES "collaterals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_covers" ADD CONSTRAINT "insurance_covers_collateral_id_fkey" FOREIGN KEY ("collateral_id") REFERENCES "collaterals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guarantees" ADD CONSTRAINT "guarantees_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "application_facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guarantees" ADD CONSTRAINT "guarantees_guarantor_profile_id_fkey" FOREIGN KEY ("guarantor_profile_id") REFERENCES "borrower_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_profitabilities" ADD CONSTRAINT "account_profitabilities_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profitability_lines" ADD CONSTRAINT "profitability_lines_profitability_id_fkey" FOREIGN KEY ("profitability_id") REFERENCES "account_profitabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_shares" ADD CONSTRAINT "wallet_shares_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_counterparties" ADD CONSTRAINT "key_counterparties_borrower_profile_id_fkey" FOREIGN KEY ("borrower_profile_id") REFERENCES "borrower_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_utilisation_snapshots" ADD CONSTRAINT "account_utilisation_snapshots_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_decisions" ADD CONSTRAINT "credit_decisions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_decisions" ADD CONSTRAINT "credit_decisions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_recommendations" ADD CONSTRAINT "credit_recommendations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_recommendations" ADD CONSTRAINT "credit_recommendations_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_recommendations" ADD CONSTRAINT "credit_recommendations_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "credit_recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_fulfilled_by_id_fkey" FOREIGN KEY ("fulfilled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_waived_by_id_fkey" FOREIGN KEY ("waived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "credit_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursement_orders" ADD CONSTRAINT "disbursement_orders_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursement_orders" ADD CONSTRAINT "disbursement_orders_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursement_orders" ADD CONSTRAINT "disbursement_orders_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursement_orders" ADD CONSTRAINT "disbursement_orders_disbursed_by_id_fkey" FOREIGN KEY ("disbursed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursement_orders" ADD CONSTRAINT "disbursement_orders_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_approval_matrices" ADD CONSTRAINT "credit_approval_matrices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_approval_matrix_versions" ADD CONSTRAINT "credit_approval_matrix_versions_matrix_id_fkey" FOREIGN KEY ("matrix_id") REFERENCES "credit_approval_matrices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_approval_matrix_versions" ADD CONSTRAINT "credit_approval_matrix_versions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_statements" ADD CONSTRAINT "financial_statements_borrower_profile_id_fkey" FOREIGN KEY ("borrower_profile_id") REFERENCES "borrower_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_statements" ADD CONSTRAINT "financial_statements_entered_by_id_fkey" FOREIGN KEY ("entered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_statements" ADD CONSTRAINT "financial_statements_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_line_items" ADD CONSTRAINT "financial_line_items_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "financial_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_ratios" ADD CONSTRAINT "financial_ratios_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "financial_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_factor_definitions" ADD CONSTRAINT "score_factor_definitions_predecessor_id_fkey" FOREIGN KEY ("predecessor_id") REFERENCES "score_factor_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_memo_versions" ADD CONSTRAINT "credit_memo_versions_locked_by_id_fkey" FOREIGN KEY ("locked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_memo_versions" ADD CONSTRAINT "credit_memo_versions_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_memo_versions" ADD CONSTRAINT "credit_memo_versions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_band_configs" ADD CONSTRAINT "rating_band_configs_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_scorecard_versions" ADD CONSTRAINT "credit_scorecard_versions_scorecard_id_fkey" FOREIGN KEY ("scorecard_id") REFERENCES "credit_scorecards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_scorecard_versions" ADD CONSTRAINT "credit_scorecard_versions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_score_runs" ADD CONSTRAINT "credit_score_runs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_score_runs" ADD CONSTRAINT "credit_score_runs_scorecard_version_id_fkey" FOREIGN KEY ("scorecard_version_id") REFERENCES "credit_scorecard_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_score_runs" ADD CONSTRAINT "credit_score_runs_override_approved_by_id_fkey" FOREIGN KEY ("override_approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_score_runs" ADD CONSTRAINT "credit_score_runs_calculated_by_id_fkey" FOREIGN KEY ("calculated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_assessment_results" ADD CONSTRAINT "application_assessment_results_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_assessment_results" ADD CONSTRAINT "application_assessment_results_score_run_id_fkey" FOREIGN KEY ("score_run_id") REFERENCES "credit_score_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_assessment_results" ADD CONSTRAINT "application_assessment_results_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_assessment_results" ADD CONSTRAINT "application_assessment_results_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qualitative_assessments" ADD CONSTRAINT "qualitative_assessments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qualitative_assessments" ADD CONSTRAINT "qualitative_assessments_assessed_by_id_fkey" FOREIGN KEY ("assessed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_incomes" ADD CONSTRAINT "retail_incomes_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "committee_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_agenda_items" ADD CONSTRAINT "committee_agenda_items_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "committee_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_agenda_items" ADD CONSTRAINT "committee_agenda_items_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_agenda_items" ADD CONSTRAINT "committee_agenda_items_presented_by_id_fkey" FOREIGN KEY ("presented_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_votes" ADD CONSTRAINT "committee_votes_agenda_item_id_fkey" FOREIGN KEY ("agenda_item_id") REFERENCES "committee_agenda_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_votes" ADD CONSTRAINT "committee_votes_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "committee_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_health" ADD CONSTRAINT "facility_health_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_health" ADD CONSTRAINT "facility_health_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "covenant_definitions" ADD CONSTRAINT "covenant_definitions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "covenant_tests" ADD CONSTRAINT "covenant_tests_covenant_id_fkey" FOREIGN KEY ("covenant_id") REFERENCES "covenant_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "covenant_tests" ADD CONSTRAINT "covenant_tests_tested_by_id_fkey" FOREIGN KEY ("tested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_warning_signals" ADD CONSTRAINT "early_warning_signals_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_warning_signals" ADD CONSTRAINT "early_warning_signals_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_warning_signals" ADD CONSTRAINT "early_warning_signals_covenant_id_fkey" FOREIGN KEY ("covenant_id") REFERENCES "covenant_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_warning_signals" ADD CONSTRAINT "early_warning_signals_condition_id_fkey" FOREIGN KEY ("condition_id") REFERENCES "conditions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pii_read_logs" ADD CONSTRAINT "pii_read_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_export_events" ADD CONSTRAINT "credit_export_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_override_approvals" ADD CONSTRAINT "score_override_approvals_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_override_approvals" ADD CONSTRAINT "score_override_approvals_first_approver_id_fkey" FOREIGN KEY ("first_approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_override_approvals" ADD CONSTRAINT "score_override_approvals_second_approver_id_fkey" FOREIGN KEY ("second_approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_override_approvals" ADD CONSTRAINT "score_override_approvals_score_run_id_fkey" FOREIGN KEY ("score_run_id") REFERENCES "credit_score_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_bureau_checks" ADD CONSTRAINT "credit_bureau_checks_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_bureau_checks" ADD CONSTRAINT "credit_bureau_checks_attached_doc_id_fkey" FOREIGN KEY ("attached_doc_id") REFERENCES "credit_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_bureau_checks" ADD CONSTRAINT "credit_bureau_checks_run_by_id_fkey" FOREIGN KEY ("run_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bureau_checklists" ADD CONSTRAINT "bureau_checklists_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bureau_checklists" ADD CONSTRAINT "bureau_checklists_ticked_by_id_fkey" FOREIGN KEY ("ticked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bureau_checklists" ADD CONSTRAINT "bureau_checklists_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "industry_assessments" ADD CONSTRAINT "industry_assessments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rmd_issues" ADD CONSTRAINT "rmd_issues_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esg_assessments" ADD CONSTRAINT "esg_assessments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sicr_assessments" ADD CONSTRAINT "sicr_assessments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_signoffs" ADD CONSTRAINT "application_signoffs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_signoffs" ADD CONSTRAINT "application_signoffs_signed_by_id_fkey" FOREIGN KEY ("signed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_duplicate_matches" ADD CONSTRAINT "crm_duplicate_matches_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "ai_prompt_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_overrides" ADD CONSTRAINT "ai_overrides_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "ai_interactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_overrides" ADD CONSTRAINT "ai_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_fx_rates" ADD CONSTRAINT "credit_fx_rates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_comments" ADD CONSTRAINT "application_comments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_comments" ADD CONSTRAINT "application_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_comments" ADD CONSTRAINT "application_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "application_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "webhook_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_duplicate_exceptions" ADD CONSTRAINT "borrower_duplicate_exceptions_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_duplicate_exceptions" ADD CONSTRAINT "borrower_duplicate_exceptions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_duplicate_exceptions" ADD CONSTRAINT "borrower_duplicate_exceptions_matched_borrower_id_fkey" FOREIGN KEY ("matched_borrower_id") REFERENCES "borrower_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

