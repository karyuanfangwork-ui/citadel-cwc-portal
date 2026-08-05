#!/usr/bin/env tsx
/**
 * Unified Credit Module Seed Orchestrator
 *
 * Replaces individual seed scripts with a single entry point + CLI flags.
 *
 * Usage:
 *   npx tsx prisma/seed-credit.ts                    # Run all seeds
 *   npx tsx prisma/seed-credit.ts --flags             # Feature flags only
 *   npx tsx prisma/seed-credit.ts --workflow          # Workflow steps/transitions only
 *   npx tsx prisma/seed-credit.ts --notifications     # Notification templates only
 *   npx tsx prisma/seed-credit.ts --approvals         # Approval matrices only
 *   npx tsx prisma/seed-credit.ts --demo              # Full demo data (applications, borrowers, etc.)
 *   npx tsx prisma/seed-credit.ts --clear              # Wipe all credit data (FK-safe order)
 *   npx tsx prisma/seed-credit.ts --workflow --flags   # Combine specific seeds
 *   npx tsx prisma/seed-credit.ts --clear --demo       # Clear then seed demo
 *
 * Derived from: docs/credit-assessment/27-implementation-plan §0.2
 */

import { PrismaClient, RiskRating } from '@prisma/client';

const prisma = new PrismaClient();
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// ---------------------------------------------------------------------------
// Parse CLI flags
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const flags = {
  flags:          args.includes('--flags'),
  workflow:       args.includes('--workflow'),
  notifications:  args.includes('--notifications'),
  approvals:      args.includes('--approvals'),
  branches:       args.includes('--branches'),
  demo:           args.includes('--demo'),
  clear:          args.includes('--clear'),
  policyLimits:   args.includes('--policy-limits'),
  scoring:        args.includes('--scoring'),
};
const runAll = !flags.flags && !flags.workflow && !flags.notifications && !flags.approvals && !flags.branches && !flags.demo && !flags.clear && !flags.policyLimits && !flags.scoring;

// ---------------------------------------------------------------------------
// §3.1 — Branches (multi-branch support)
// ---------------------------------------------------------------------------
const BRANCHES = [
  { code: 'HQ', name: 'Headquarters', region: 'Central' },
  { code: 'BN', name: 'Branch-North', region: 'North' },
  { code: 'BS', name: 'Branch-South', region: 'South' },
];

async function seedBranches() {
  console.log('🏢 Seeding credit branches...');

  for (const branch of BRANCHES) {
    await prisma.branch.upsert({
      where: { code: branch.code },
      update: { name: branch.name, region: branch.region },
      create: { ...branch, tenantId: DEFAULT_TENANT_ID },
    });
    console.log(`  ✅ ${branch.code} — ${branch.name}`);
  }

  // Assign existing seed users to the HQ branch by default
  const hq = await prisma.branch.findUnique({ where: { code: 'HQ' } });
  if (hq) {
    const result = await prisma.user.updateMany({
      where: { branchId: null },
      data: { branchId: hq.id },
    });
    console.log(`  ✅ Assigned ${result.count} users to ${hq.code} (default branch)`);
  }
}

// ---------------------------------------------------------------------------
// 1. Feature Flags
// ---------------------------------------------------------------------------
async function seedFlags() {
  console.log('🚩 Seeding credit feature flags...');

  const creditFlags = [
    { key: 'credit:module',         description: 'Master toggle for the Credit Assessment Module',       enabled: true,  category: 'credit' },
    { key: 'credit:borrowers',      description: 'Borrower profile management',                         enabled: true,  category: 'credit' },
    { key: 'credit:applications',   description: 'Credit application intake and workflow',                enabled: true,  category: 'credit' },
    { key: 'credit:spreading',      description: 'Financial statement spreading (manual)',               enabled: true,  category: 'credit' },
    { key: 'credit:scoring',        description: 'Credit scoring and risk grading',                      enabled: true,  category: 'credit' },
    { key: 'credit:committee',      description: 'Committee workflow',                                    enabled: true,  category: 'credit' },
    { key: 'credit:collateral',     description: 'Collateral and guarantee management',                  enabled: true,  category: 'credit' },
    { key: 'credit:conditions',     description: 'Conditions precedent/subsequent tracking',             enabled: true,  category: 'credit' },
    { key: 'credit:monitoring',      description: 'Post-disbursement monitoring and EWS',                  enabled: true,  category: 'credit' },
    { key: 'credit:dashboards',     description: 'Credit operational dashboards',                        enabled: true,  category: 'credit' },
    { key: 'credit:ai',             description: 'AI advisory features (v2 - deferred)',                   enabled: true,  category: 'credit' },
    // §0.4 / §4.10 — OFF until bureau adapter is live. Compliance constraint.
    { key: 'credit:bureau_checks',  description: 'Bureau & AML adapter calls (OFF until adapter live)',   enabled: false, category: 'credit' },
    // Wave E — CA Memo Redesign: section visibility flags
    { key: 'credit:advanced_memo',    description: 'Enables bank-grade CA Memo sections (ECL, ESG, SICR, Sensitivity, CommitteeMeeting, Profitability, WalletShare, AccountUtilisation)', enabled: false, category: 'credit' },
    { key: 'credit:committee_formal', description: 'Enables full CommitteeMeeting formal vote flow inside the approval tab', enabled: true, category: 'credit' },
  ];

  for (const flag of creditFlags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: { description: flag.description, category: flag.category, enabled: flag.enabled },
      create: { ...flag, tenantId: DEFAULT_TENANT_ID },
    });
    console.log(`  ✅ ${flag.key} (enabled: ${flag.enabled})`);
  }
}

// ---------------------------------------------------------------------------
// 2. Workflow Steps & Transitions
// ---------------------------------------------------------------------------
const WORKFLOW_CODE = 'CREDIT_APPLICATION';

interface StepDef {
  label: string;
  status: string;
  icon: string;
  isInitial?: boolean;
  isFinal?: boolean;
  slaPause?: boolean;
}

const STEPS: StepDef[] = [
  { label: 'Draft',              status: 'DRAFT',              icon: 'edit',                isInitial: true },
  { label: 'Submitted',          status: 'SUBMITTED',          icon: 'check_circle' },
  { label: 'KYC Review',         status: 'KYC_REVIEW',         icon: 'radio_button_checked', slaPause: true },
  { label: 'Compliance Hold',     status: 'COMPLIANCE_HOLD',    icon: 'pause_circle' },
  { label: 'KYC Approved',       status: 'KYC_APPROVED',       icon: 'check_circle' },
  { label: 'KYC Rejected',       status: 'KYC_REJECTED',       icon: 'cancel' },
  { label: 'Underwriting',       status: 'UNDERWRITING',        icon: 'radio_button_checked', slaPause: true },
  { label: 'Credit Assessment',  status: 'CREDIT_ASSESSMENT',   icon: 'radio_button_checked', slaPause: true },
  { label: 'Committee Review',    status: 'COMMITTEE_REVIEW',    icon: 'radio_button_checked', slaPause: true },
  { label: 'Approved',            status: 'APPROVED',            icon: 'check_circle' },
  { label: 'Condition Fulfilment', status: 'CONDITION_FULFILMENT', icon: 'fact_check' },
  { label: 'Rejected',            status: 'REJECTED',            icon: 'cancel',              isFinal: true },
  { label: 'Offer',               status: 'OFFER',               icon: 'radio_button_checked' },
  { label: 'Accepted',            status: 'ACCEPTED',             icon: 'check_circle' },
  { label: 'Disbursed',          status: 'DISBURSED',            icon: 'radio_button_checked' },
  { label: 'Active',              status: 'ACTIVE',              icon: 'check_circle' },
  { label: 'Closed',              status: 'CLOSED',               icon: 'check_circle',        isFinal: true },
  { label: 'Withdrawn',           status: 'WITHDRAWN',           icon: 'cancel',              isFinal: true },
  { label: 'Referred Back',       status: 'REFERRED_BACK',       icon: 'replay' },
];

interface TransitionDef {
  fromStatus: string;
  toStatus: string;
  transitionLabel: string;
  requiresComment: boolean;
}

// ---------------------------------------------------------------------------
// Canonical transitions — must match creditApplication.service.ts TRANSITIONS
// ---------------------------------------------------------------------------
const TRANSITIONS: TransitionDef[] = [
  // ── Forward path ──
  { fromStatus: 'DRAFT',              toStatus: 'SUBMITTED',            transitionLabel: 'SUBMIT',               requiresComment: false },
  { fromStatus: 'SUBMITTED',          toStatus: 'KYC_REVIEW',            transitionLabel: 'START_KYC',            requiresComment: false },
  { fromStatus: 'KYC_REVIEW',          toStatus: 'KYC_APPROVED',          transitionLabel: 'APPROVE_KYC',          requiresComment: false },
  { fromStatus: 'KYC_REVIEW',          toStatus: 'KYC_REJECTED',          transitionLabel: 'REJECT_KYC',           requiresComment: true },
  { fromStatus: 'KYC_REVIEW',          toStatus: 'COMPLIANCE_HOLD',       transitionLabel: 'PLACE_COMPLIANCE_HOLD', requiresComment: true },
  { fromStatus: 'COMPLIANCE_HOLD',     toStatus: 'KYC_APPROVED',          transitionLabel: 'CLEAR_COMPLIANCE_HOLD',requiresComment: true },
  { fromStatus: 'COMPLIANCE_HOLD',     toStatus: 'KYC_REJECTED',          transitionLabel: 'REJECT_COMPLIANCE',    requiresComment: true },
  { fromStatus: 'KYC_APPROVED',        toStatus: 'UNDERWRITING',          transitionLabel: 'START_UNDERWRITING',   requiresComment: false },
  { fromStatus: 'KYC_REJECTED',        toStatus: 'SUBMITTED',             transitionLabel: 'RESUBMIT',             requiresComment: true },
  { fromStatus: 'UNDERWRITING',        toStatus: 'CREDIT_ASSESSMENT',     transitionLabel: 'START_ASSESSMENT',     requiresComment: false },
  { fromStatus: 'CREDIT_ASSESSMENT',   toStatus: 'COMMITTEE_REVIEW',      transitionLabel: 'SUBMIT_TO_COMMITTEE', requiresComment: false },
  { fromStatus: 'COMMITTEE_REVIEW',    toStatus: 'APPROVED',              transitionLabel: 'APPROVE',              requiresComment: false },
  { fromStatus: 'COMMITTEE_REVIEW',    toStatus: 'REJECTED',              transitionLabel: 'REJECT',               requiresComment: true },
  { fromStatus: 'APPROVED',            toStatus: 'CONDITION_FULFILMENT',  transitionLabel: 'START_CONDITION_FULFILMENT', requiresComment: false },
  { fromStatus: 'APPROVED',            toStatus: 'OFFER',                  transitionLabel: 'MAKE_OFFER_DIRECT',    requiresComment: false },
  { fromStatus: 'CONDITION_FULFILMENT',toStatus: 'OFFER',                  transitionLabel: 'MAKE_OFFER',           requiresComment: false },
  { fromStatus: 'OFFER',               toStatus: 'ACCEPTED',              transitionLabel: 'ACCEPT_OFFER',         requiresComment: false },
  { fromStatus: 'OFFER',               toStatus: 'REJECTED',              transitionLabel: 'DECLINE_OFFER',        requiresComment: true },
  { fromStatus: 'ACCEPTED',            toStatus: 'DISBURSED',              transitionLabel: 'DISBURSE',             requiresComment: false },
  { fromStatus: 'DISBURSED',           toStatus: 'ACTIVE',                transitionLabel: 'ACTIVATE',             requiresComment: false },
  { fromStatus: 'ACTIVE',              toStatus: 'CLOSED',                  transitionLabel: 'CLOSE',               requiresComment: true },
  // ── Refer-back transitions ──
  { fromStatus: 'KYC_REVIEW',          toStatus: 'REFERRED_BACK',        transitionLabel: 'REFER_BACK',           requiresComment: true },
  { fromStatus: 'COMPLIANCE_HOLD',     toStatus: 'REFERRED_BACK',        transitionLabel: 'REFER_BACK',           requiresComment: true },
  { fromStatus: 'CREDIT_ASSESSMENT',   toStatus: 'REFERRED_BACK',        transitionLabel: 'REFER_BACK',           requiresComment: true },
  { fromStatus: 'COMMITTEE_REVIEW',    toStatus: 'REFERRED_BACK',        transitionLabel: 'REFER_BACK',           requiresComment: true },
  // ── Resume from referred back ──
  { fromStatus: 'REFERRED_BACK',       toStatus: 'KYC_REVIEW',            transitionLabel: 'RESUME_KYC',           requiresComment: false },
  { fromStatus: 'REFERRED_BACK',       toStatus: 'UNDERWRITING',          transitionLabel: 'RESUME_UNDERWRITING',  requiresComment: false },
  { fromStatus: 'REFERRED_BACK',       toStatus: 'CREDIT_ASSESSMENT',     transitionLabel: 'RESUME_ASSESSMENT',   requiresComment: false },
  { fromStatus: 'REFERRED_BACK',       toStatus: 'SUBMITTED',             transitionLabel: 'RESUBMIT',             requiresComment: true },
  // ── Withdraw from any non-terminal state ──
  { fromStatus: 'DRAFT',              toStatus: 'WITHDRAWN',              transitionLabel: 'WITHDRAW',             requiresComment: true },
  { fromStatus: 'SUBMITTED',          toStatus: 'WITHDRAWN',              transitionLabel: 'WITHDRAW',             requiresComment: true },
  { fromStatus: 'KYC_REVIEW',          toStatus: 'WITHDRAWN',              transitionLabel: 'WITHDRAW',             requiresComment: true },
  { fromStatus: 'COMPLIANCE_HOLD',     toStatus: 'WITHDRAWN',              transitionLabel: 'WITHDRAW',             requiresComment: true },
  { fromStatus: 'KYC_APPROVED',        toStatus: 'WITHDRAWN',              transitionLabel: 'WITHDRAW',             requiresComment: true },
  { fromStatus: 'KYC_REJECTED',        toStatus: 'WITHDRAWN',              transitionLabel: 'WITHDRAW',             requiresComment: true },
  { fromStatus: 'UNDERWRITING',        toStatus: 'WITHDRAWN',              transitionLabel: 'WITHDRAW',             requiresComment: true },
  { fromStatus: 'CREDIT_ASSESSMENT',   toStatus: 'WITHDRAWN',              transitionLabel: 'WITHDRAW',             requiresComment: true },
  { fromStatus: 'COMMITTEE_REVIEW',    toStatus: 'WITHDRAWN',              transitionLabel: 'WITHDRAW',             requiresComment: true },
  { fromStatus: 'APPROVED',            toStatus: 'WITHDRAWN',              transitionLabel: 'WITHDRAW',             requiresComment: true },
  { fromStatus: 'CONDITION_FULFILMENT',toStatus: 'WITHDRAWN',              transitionLabel: 'WITHDRAW',             requiresComment: true },
  { fromStatus: 'REFERRED_BACK',       toStatus: 'WITHDRAWN',              transitionLabel: 'WITHDRAW',             requiresComment: true },
  { fromStatus: 'OFFER',               toStatus: 'WITHDRAWN',              transitionLabel: 'WITHDRAW',             requiresComment: true },
  { fromStatus: 'ACCEPTED',            toStatus: 'WITHDRAWN',              transitionLabel: 'WITHDRAW',             requiresComment: true },
];

async function seedWorkflow() {
  console.log('🔄 Seeding credit workflow steps & transitions...');

  // Upsert workflow type
  const workflow = await prisma.workflowType.upsert({
    where: { code: WORKFLOW_CODE },
    update: { name: 'Credit Application', description: 'Credit application lifecycle' },
    create: { code: WORKFLOW_CODE, name: 'Credit Application', description: 'Credit application lifecycle' },
  });

  // Upsert steps
  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    await prisma.workflowStep.upsert({
      where: { workflowTypeId_status: { workflowTypeId: workflow.id, status: step.status } },
      update: { label: step.label, icon: step.icon, displayOrder: i, isInitial: !!step.isInitial, isFinal: !!step.isFinal, slaPause: !!step.slaPause },
      create: { workflowTypeId: workflow.id, label: step.label, status: step.status, icon: step.icon, displayOrder: i, isInitial: !!step.isInitial, isFinal: !!step.isFinal, slaPause: !!step.slaPause },
    });
  }

  // Upsert transitions (unique on fromStatus + toStatus)
  for (const t of TRANSITIONS) {
    await prisma.workflowTransition.upsert({
      where: { fromStatus_toStatus: { fromStatus: t.fromStatus, toStatus: t.toStatus } },
      update: { transitionLabel: t.transitionLabel, requiresComment: t.requiresComment },
      create: { fromStatus: t.fromStatus, toStatus: t.toStatus, transitionLabel: t.transitionLabel, requiresComment: t.requiresComment },
    });
  }

  console.log(`  ✅ ${STEPS.length} steps, ${TRANSITIONS.length} transitions`);
}

// ---------------------------------------------------------------------------
// 3. Notification Templates
// ---------------------------------------------------------------------------
const CREDIT_TEMPLATES = [
  {
    name: 'credit_application_submitted',
    eventType: 'credit_application_submitted',
    emailSubject: 'Credit Application {{applicationNo}} Submitted',
    emailBody: `<p>Hi {{userName}},</p>
<p>A new credit application <strong>{{applicationNo}}</strong> has been submitted for borrower <strong>{{borrowerName}}</strong> with a requested amount of <strong>{{currency}} {{requestedAmount}}</strong>.</p>
<p>Please review the application at your earliest convenience.</p>
<p><a href="{{appUrl}}/credit/applications/{{applicationId}}">View Application</a></p>`,
    smsBody: 'Credit app {{applicationNo}} submitted for {{borrowerName}} ({{currency}} {{requestedAmount}}). Review at {{appUrl}}/credit/applications/{{applicationId}}',
    pushTitle: 'New Credit Application Submitted',
    pushBody: 'Application {{applicationNo}} for {{borrowerName}} — {{currency}} {{requestedAmount}}',
  },
  {
    name: 'credit_application_approved',
    eventType: 'credit_application_approved',
    emailSubject: 'Credit Application {{applicationNo}} Approved',
    emailBody: `<p>Hi {{userName}},</p>
<p>Credit application <strong>{{applicationNo}}</strong> for borrower <strong>{{borrowerName}}</strong> has been <strong style="color: green;">approved</strong>.</p>
<p>Approved amount: <strong>{{currency}} {{approvedAmount}}</strong></p>
<p><a href="{{appUrl}}/credit/applications/{{applicationId}}">View Application</a></p>`,
    smsBody: 'Credit app {{applicationNo}} APPROVED for {{borrowerName}}. Amount: {{currency}} {{approvedAmount}}.',
    pushTitle: 'Credit Application Approved',
    pushBody: 'Application {{applicationNo}} for {{borrowerName}} has been approved ({{currency}} {{approvedAmount}})',
  },
  {
    name: 'credit_application_rejected',
    eventType: 'credit_application_rejected',
    emailSubject: 'Credit Application {{applicationNo}} Rejected',
    emailBody: `<p>Hi {{userName}},</p>
<p>Credit application <strong>{{applicationNo}}</strong> for borrower <strong>{{borrowerName}}</strong> has been <strong style="color: red;">rejected</strong>.</p>
<p>Reason: {{rejectionReason}}</p>
<p><a href="{{appUrl}}/credit/applications/{{applicationId}}">View Application</a></p>`,
    smsBody: 'Credit app {{applicationNo}} REJECTED for {{borrowerName}}. Reason: {{rejectionReason}}.',
    pushTitle: 'Credit Application Rejected',
    pushBody: 'Application {{applicationNo}} for {{borrowerName}} has been rejected. Reason: {{rejectionReason}}',
  },
  {
    name: 'credit_approval_requested',
    eventType: 'credit_approval_requested',
    emailSubject: 'Approval Requested — Credit Application {{applicationNo}}',
    emailBody: `<p>Hi {{userName}},</p>
<p>Your approval is requested for credit application <strong>{{applicationNo}}</strong> (borrower: <strong>{{borrowerName}}</strong>, amount: <strong>{{currency}} {{requestedAmount}}</strong>).</p>
<p>Current status: <strong>{{applicationState}}</strong></p>
<p>Approvals collected: {{approvalsCollected}} / {{approvalsRequired}}</p>
<p><a href="{{appUrl}}/credit/applications/{{applicationId}}">Review & Approve</a></p>`,
    smsBody: 'Approval requested: Credit app {{applicationNo}} ({{borrowerName}}, {{currency}} {{requestedAmount}}). {{approvalsCollected}}/{{approvalsRequired}} approvals. Review at {{appUrl}}',
    pushTitle: 'Approval Requested',
    pushBody: 'Application {{applicationNo}} — {{borrowerName}}, {{currency}} {{requestedAmount}}. Your approval is needed.',
  },
  {
    name: 'credit_application_withdrawn',
    eventType: 'credit_application_withdrawn',
    emailSubject: 'Credit Application {{applicationNo}} Withdrawn',
    emailBody: `<p>Hi {{userName}},</p>
<p>Credit application <strong>{{applicationNo}}</strong> for borrower <strong>{{borrowerName}}</strong> has been <strong>withdrawn</strong>.</p>
<p>Withdrawn by: {{withdrawnBy}}</p>
<p><a href="{{appUrl}}/credit/applications/{{applicationId}}">View Application</a></p>`,
    smsBody: 'Credit app {{applicationNo}} for {{borrowerName}} has been withdrawn by {{withdrawnBy}}.',
    pushTitle: 'Credit Application Withdrawn',
    pushBody: 'Application {{applicationNo}} for {{borrowerName}} has been withdrawn.',
  },
];

async function seedNotifications() {
  console.log('🔔 Seeding credit notification templates...');

  for (const tpl of CREDIT_TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: { name: tpl.name },
      update: {
        eventType: tpl.eventType,
        emailSubject: tpl.emailSubject,
        emailBody: tpl.emailBody,
        smsBody: tpl.smsBody ?? null,
        pushTitle: tpl.pushTitle ?? null,
        pushBody: tpl.pushBody ?? null,
      },
      create: {
        tenantId: DEFAULT_TENANT_ID,
        name: tpl.name,
        eventType: tpl.eventType,
        emailSubject: tpl.emailSubject,
        emailBody: tpl.emailBody,
        smsBody: tpl.smsBody ?? null,
        pushTitle: tpl.pushTitle ?? null,
        pushBody: tpl.pushBody ?? null,
      },
    });
    console.log(`  ✅ ${tpl.name}`);
  }
}

// ---------------------------------------------------------------------------
// 4. Approval Matrices
// ---------------------------------------------------------------------------
const APPROVAL_MATRICES = [
  {
    name: 'Tier 1 — RM Authority (<500K)',
    description: 'All risk ratings. Single RM-level approval required for credit exposure below MYR 500,000.',
    minExposure: 0,
    maxExposure: 499999.99,
    minRating: RiskRating.AAA,
    maxRating: RiskRating.D,
    authorityLevel: 'RM',
    requiredApproverCount: 1,
    effectiveFrom: new Date('2025-01-01'),
    effectiveTo: null,
  },
  {
    name: 'Tier 2 — Senior Manager Authority (500K–5M)',
    description: 'All risk ratings. Two Senior Manager approvals required for credit exposure between MYR 500,000 and MYR 5,000,000.',
    minExposure: 500000,
    maxExposure: 4999999.99,
    minRating: RiskRating.AAA,
    maxRating: RiskRating.D,
    authorityLevel: 'MANAGER',
    requiredApproverCount: 2,
    effectiveFrom: new Date('2025-01-01'),
    effectiveTo: null,
  },
  {
    name: 'Tier 3 — Committee Authority (>5M)',
    description: 'All risk ratings. Three Committee-level approvals required for credit exposure above MYR 5,000,000.',
    minExposure: 5000000,
    maxExposure: 999999999999.99,
    minRating: RiskRating.AAA,
    maxRating: RiskRating.D,
    authorityLevel: 'COMMITTEE',
    requiredApproverCount: 3,
    effectiveFrom: new Date('2025-01-01'),
    effectiveTo: null,
  },
];

async function seedApprovals() {
  console.log('⚖️ Seeding credit approval matrices...');

  for (const matrix of APPROVAL_MATRICES) {
    const existing = await prisma.creditApprovalMatrix.findFirst({ where: { name: matrix.name } });
    if (existing) {
      await prisma.creditApprovalMatrix.update({
        where: { id: existing.id },
        data: {
          description: matrix.description,
          minExposure: matrix.minExposure,
          maxExposure: matrix.maxExposure,
          minRating: matrix.minRating,
          maxRating: matrix.maxRating,
          authorityLevel: matrix.authorityLevel,
          requiredApproverCount: matrix.requiredApproverCount,
          effectiveFrom: matrix.effectiveFrom,
          effectiveTo: matrix.effectiveTo,
        },
      });
    } else {
      await prisma.creditApprovalMatrix.create({ data: matrix });
    }
    console.log(`  ✅ ${matrix.name}`);
  }
}

// ---------------------------------------------------------------------------
// 5a. Credit Policy Limits — Lane Thresholds & Single-Borrower Limits
// ---------------------------------------------------------------------------
const LANE_THRESHOLD_LIMITS = [
  {
    type: 'LANE_THRESHOLD' as const,
    label: 'Personal Fast Amount Cap',
    maxValue: 150000,
    thresholdPct: 80,
    isActive: true,
    currency: 'MYR',
    sector: null,
    productType: null,
  },
  {
    type: 'LANE_THRESHOLD' as const,
    label: 'SME Turnover Cap',
    maxValue: 5000000,
    thresholdPct: 80,
    isActive: true,
    currency: 'MYR',
    sector: null,
    productType: null,
  },
];

async function seedPolicyLimits() {
  console.log('📏 Seeding credit policy limits (lane thresholds)...');

  // Use the first admin user as createdById, or fallback
  const adminUser = await prisma.user.findFirst({ where: { email: 'admin@test.local' } });
  const createdById = adminUser?.id;
  if (!createdById) {
    console.log('  ⚠️ No admin user found — skipping policy limit seed');
    return;
  }

  for (const limit of LANE_THRESHOLD_LIMITS) {
    const existing = await prisma.creditPolicyLimit.findFirst({
      where: { type: limit.type, label: limit.label, isActive: true },
    });
    if (existing) {
      await prisma.creditPolicyLimit.update({
        where: { id: existing.id },
        data: {
          maxValue: limit.maxValue,
          thresholdPct: limit.thresholdPct,
          currency: limit.currency,
        },
      });
      console.log(`  ✅ Updated: ${limit.label} (RM${limit.maxValue.toLocaleString()})`);
    } else {
      await prisma.creditPolicyLimit.create({
        data: {
          type: limit.type,
          label: limit.label,
          maxValue: limit.maxValue,
          thresholdPct: limit.thresholdPct,
          isActive: limit.isActive,
          currency: limit.currency,
          sector: limit.sector,
          productType: limit.productType,
          createdById,
        },
      });
      console.log(`  ✅ Created: ${limit.label} (RM${limit.maxValue.toLocaleString()})`);
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Clear all credit data (FK-safe order)
// ---------------------------------------------------------------------------
async function clearCreditData() {
  console.log('🧹 Clearing all Credit Module data...');

  // FK-safe deletion order: children before parents.
  // All models that belong to the Credit module are included.
  // CRM-module models (CrmAccount, CrmContact, CrmLead, CrmPipeline, etc.) are excluded.
  const deletes: [string, () => Promise<number>][] = [
    // ── Deepest leaves (no credit-module children) ──────────────────────
    ['committee votes',                () => prisma.committeeVote.deleteMany({}).then(r => r.count)],
    ['projection line items',          () => prisma.projectionLineItem.deleteMany({}).then(r => r.count)],
    ['profitability lines',            () => prisma.profitabilityLine.deleteMany({}).then(r => r.count)],
    ['collateral liens',               () => prisma.collateralLien.deleteMany({}).then(r => r.count)],
    ['collateral valuations',          () => prisma.collateralValuation.deleteMany({}).then(r => r.count)],
    ['insurance covers',               () => prisma.insuranceCover.deleteMany({}).then(r => r.count)],
    ['covenant tests',                 () => prisma.covenantTest.deleteMany({}).then(r => r.count)],
    ['credit document versions',       () => prisma.creditDocumentVersion.deleteMany({}).then(r => r.count)],
    ['financial line items',           () => prisma.financialLineItem.deleteMany({}).then(r => r.count)],
    ['financial ratios',               () => prisma.financialRatio.deleteMany({}).then(r => r.count)],
    ['credit SLA breaches',            () => prisma.creditSlaBreach.deleteMany({}).then(r => r.count)],
    ['score override approvals',       () => prisma.scoreOverrideApproval.deleteMany({}).then(r => r.count)],
    ['credit export events',           () => prisma.creditExportEvent.deleteMany({}).then(r => r.count)],

    // ── Committee (agenda items + members reference meeting) ────────────
    ['committee agenda items',          () => prisma.committeeAgendaItem.deleteMany({}).then(r => r.count)],
    ['committee members',              () => prisma.committeeMember.deleteMany({}).then(r => r.count)],

    // ── Application-level children (all FK → CreditApplication) ────────
    ['ECL forecasts',                  () => prisma.eclForecast.deleteMany({}).then(r => r.count)],
    ['ECL snapshots',                  () => prisma.eclSnapshot.deleteMany({}).then(r => r.count)],
    ['exposure summaries',             () => prisma.exposureSummary.deleteMany({}).then(r => r.count)],
    ['external ratings',               () => prisma.externalRating.deleteMany({}).then(r => r.count)],
    ['sensitivity scenarios',           () => prisma.sensitivityScenario.deleteMany({}).then(r => r.count)],
    ['cashflow projections',           () => prisma.cashflowProjection.deleteMany({}).then(r => r.count)],
    ['account profitabilities',        () => prisma.accountProfitability.deleteMany({}).then(r => r.count)],
    ['wallet shares',                  () => prisma.walletShare.deleteMany({}).then(r => r.count)],
    ['account utilisation snapshots',  () => prisma.accountUtilisationSnapshot.deleteMany({}).then(r => r.count)],
    ['credit bureau checks',           () => prisma.creditBureauCheck.deleteMany({}).then(r => r.count)],
    ['industry assessments',            () => prisma.industryAssessment.deleteMany({}).then(r => r.count)],
    ['risk assessments',               () => prisma.riskAssessment.deleteMany({}).then(r => r.count)],
    ['RMD issues',                     () => prisma.rmdIssue.deleteMany({}).then(r => r.count)],
    ['ESG assessments',                () => prisma.esgAssessment.deleteMany({}).then(r => r.count)],
    ['SICR assessments',               () => prisma.sicrAssessment.deleteMany({}).then(r => r.count)],
    ['application signoffs',           () => prisma.applicationSignoff.deleteMany({}).then(r => r.count)],
    ['credit decisions',               () => prisma.creditDecision.deleteMany({}).then(r => r.count)],
    ['document requirements',          () => prisma.documentRequirement.deleteMany({}).then(r => r.count)],
    ['credit audit events',            () => prisma.creditAuditEvent.deleteMany({}).then(r => r.count)],
    ['conditions',                     () => prisma.condition.deleteMany({}).then(r => r.count)],
    ['early warning signals',           () => prisma.earlyWarningSignal.deleteMany({}).then(r => r.count)],
    ['facility health records',        () => prisma.facilityHealth.deleteMany({}).then(r => r.count)],
    ['payment events',                 () => prisma.paymentEvent.deleteMany({}).then(r => r.count)],
    ['covenant definitions',           () => prisma.covenantDefinition.deleteMany({}).then(r => r.count)],
    ['credit documents',               () => prisma.creditDocument.deleteMany({}).then(r => r.count)],
    ['application parties',            () => prisma.applicationParty.deleteMany({}).then(r => r.count)],

    // ── Facility-level (depend on ApplicationFacility) ──────────────────
    ['collaterals',                    () => prisma.collateral.deleteMany({}).then(r => r.count)],
    ['guarantees',                     () => prisma.guarantee.deleteMany({}).then(r => r.count)],

    // ── Request items → then facilities ─────────────────────────────────
    ['request items',                   () => prisma.requestItem.deleteMany({}).then(r => r.count)],
    ['facilities',                      () => prisma.applicationFacility.deleteMany({}).then(r => r.count)],

    // ── Borrower profile children ──────────────────────────────────────
    ['directors',                      () => prisma.director.deleteMany({}).then(r => r.count)],
    ['shareholders',                    () => prisma.shareholder.deleteMany({}).then(r => r.count)],
    ['ultimate beneficial owners',     () => prisma.ultimateBeneficialOwner.deleteMany({}).then(r => r.count)],
    ['key counterparties',             () => prisma.keyCounterparty.deleteMany({}).then(r => r.count)],
    ['related party members',          () => prisma.relatedPartyMember.deleteMany({}).then(r => r.count)],

    // ── Financial statements (after line items & ratios) ────────────────
    ['financial statements',           () => prisma.financialStatement.deleteMany({}).then(r => r.count)],

    // ── Score runs → then score-related parents ─────────────────────────
    ['score runs',                      () => prisma.creditScoreRun.deleteMany({}).then(r => r.count)],
    ['scorecard versions',              () => prisma.creditScorecardVersion.deleteMany({}).then(r => r.count)],
    ['scorecards',                      () => prisma.creditScorecard.deleteMany({}).then(r => r.count)],
    ['rating band configs',             () => prisma.ratingBandConfig.deleteMany({}).then(r => r.count)],
    ['score factor definitions',        () => prisma.scoreFactorDefinition.deleteMany({}).then(r => r.count)],

    // ── Committee meetings (after agenda items & members) ───────────────
    ['committee meetings',              () => prisma.committeeMeeting.deleteMany({}).then(r => r.count)],

    // ── SLA policies (after breaches) ───────────────────────────────────
    ['credit SLA policies',             () => prisma.creditSlaPolicy.deleteMany({}).then(r => r.count)],

    // ── Approval matrices (after versions) ──────────────────────────────
    ['approval matrix versions',        () => prisma.creditApprovalMatrixVersion.deleteMany({}).then(r => r.count)],
    ['approval matrices',               () => prisma.creditApprovalMatrix.deleteMany({}).then(r => r.count)],

    // ── Request approvals (service-desk credit approvals) ───────────────
    ['request approvals',               () => prisma.requestApproval.deleteMany({}).then(r => r.count)],

    // ── Top-level parents ───────────────────────────────────────────────
    ['applications',                     () => prisma.creditApplication.deleteMany({}).then(r => r.count)],
    ['borrower profiles',               () => prisma.borrowerProfile.deleteMany({}).then(r => r.count)],
    ['related party groups',            () => prisma.relatedPartyGroup.deleteMany({}).then(r => r.count)],
    ['credit app counters',             () => prisma.creditAppCounter.deleteMany({}).then(r => r.count)],
  ];

  for (const [label, fn] of deletes) {
    try {
      const count = await fn();
      console.log(`  ✅ ${count} ${label} deleted`);
    } catch (err: any) {
      console.warn(`  ⚠ Skipping ${label}: ${err.message}`);
    }
  }

  console.log('🧹 Credit Module data cleared.');
}

// ---------------------------------------------------------------------------
// 6a. Scoring Governance Seed — scorecards, rating bands, factor definitions (P2.1)
// ---------------------------------------------------------------------------
async function seedScoringGovernance() {
  console.log('📊 Seeding scoring governance data...');

  // ── Score Factor Definitions ─────────────────────────────────────────
  const { scoreFactorDefinitionService } = await import('../src/credit/services/scoreFactorDefinition.service');
  const factorCount = await scoreFactorDefinitionService.seedDefinitions();
  console.log(`  ✅ ${factorCount} score factor definitions seeded (idempotent)`);

  // ── Default Scorecard + Version ───────────────────────────────────────
  const defaultScorecard = await prisma.creditScorecard.upsert({
    where: { name: 'Default Credit Scorecard' },
    update: {},
    create: {
      name: 'Default Credit Scorecard',
      description: 'Standard credit scoring model for all borrower types. 9-factor weighted scorecard.',
      isActive: true,
    },
  });

  const existingVersion = await prisma.creditScorecardVersion.findFirst({
    where: { scorecardId: defaultScorecard.id, version: 1 },
  });

  if (!existingVersion) {
    const adminUser = await prisma.user.findFirst({ where: { email: 'admin@test.local' } });
    await prisma.creditScorecardVersion.create({
      data: {
        scorecardId: defaultScorecard.id,
        version: 1,
        factorWeights: {
          financial_performance: 20,
          leverage: 15,
          liquidity: 12,
          cashflow: 18,
          management: 10,
          industry: 8,
          collateral: 7,
          relationship: 5,
          market_conditions: 5,
        },
        retailFactorWeights: {
          financial_performance: 15,
          leverage: 10,
          liquidity: 10,
          cashflow: 30,
          management: 10,
          industry: 8,
          collateral: 7,
          relationship: 5,
          market_conditions: 5,
        },
        isActive: true,
        effectiveFrom: new Date('2025-01-01'),
        approvedById: adminUser?.id ?? null,
        approvedAt: adminUser ? new Date() : null,
      },
    });
    console.log('  ✅ Default scorecard v1 seeded');
  } else {
    console.log('  ⏭ Default scorecard v1 already exists');
  }

  // ── Rating Bands ─────────────────────────────────────────────────────
  const { seedDefaultRatingBands } = await import('../src/credit/services/ratingBand.service');
  await seedDefaultRatingBands(await prisma.user.findFirst({ where: { email: 'admin@test.local' } }).then(u => u?.id) ?? undefined);
  console.log('  ✅ Rating bands seeded (idempotent)');

  console.log('✅ Scoring governance data seeded.');
}

// ---------------------------------------------------------------------------
// 6. Demo data — delegates to existing creditDemoSeed
// ---------------------------------------------------------------------------
async function seedDemo() {
  console.log('🎬 Seeding credit demo data...');
  const { seedCreditDemo } = await import('./creditDemoSeed');
  // Use admin user IDs from main seed — find or use empty strings for defaults
  const adminUser = await prisma.user.findFirst({ where: { email: 'admin@test.local' } });
  const analystUser = await prisma.user.findFirst({ where: { email: 'it@test.local' } });
  await seedCreditDemo(adminUser?.id ?? '', analystUser?.id ?? '');
  console.log('✅ Credit demo data seeded.');
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------
async function main() {
  console.log('🌱 Credit Module Seed Orchestrator');
  console.log(`   Flags: ${JSON.stringify(flags)}`);
  console.log(`   Run all: ${runAll}\n`);

  const shouldRun = (flag: boolean) => runAll || flag;

  try {
    if (flags.clear) {
      // Production guard for --clear flag
      if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_DATA_CLEAR !== 'true') {
        console.error('⛔ ABORTING: The --clear flag deletes all credit data and must NOT run on production.');
        console.error('   If you are absolutely sure, set ALLOW_PRODUCTION_DATA_CLEAR=true to override.');
        process.exit(1);
      }
      await clearCreditData();
      if (!flags.flags && !flags.workflow && !flags.notifications && !flags.approvals && !flags.branches && !flags.demo) {
        await prisma.$disconnect();
        return;
      }
    }

    if (shouldRun(flags.flags))         await seedFlags();
    if (shouldRun(flags.workflow))      await seedWorkflow();
    if (shouldRun(flags.notifications)) await seedNotifications();
    if (shouldRun(flags.approvals))     await seedApprovals();
    if (shouldRun(flags.branches))      await seedBranches();
    if (shouldRun(flags.policyLimits))   await seedPolicyLimits();
    if (shouldRun(flags.scoring))        await seedScoringGovernance();
    if (shouldRun(flags.demo))          await seedDemo();

    console.log('\n✅ Done.');
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();