import prisma from '../../utils/prisma';
import { Prisma, ApplicationState, ApprovalDecisionType, SignoffRole } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { AuditChainService } from './auditChain.service';
import { creditNotificationService, CreditEventType } from './creditNotification.service';
import { deriveAndSetConnectedPartyFlag } from './connectedParty.service';
import { validateSubmissionReadiness } from './submissionReadiness.service';
import { approvalMatrixService } from './approvalMatrix.service';
import { formatCurrency } from '../utils/formatCurrency';
import { computeBorrowerExposure, refreshBorrowerExposure, EXPOSURE_STATES } from './exposureCompute.service';
import { getApplicationEffectiveRating } from './applicationRating.service';
import { getLatestScoreRunAt, getLatestMaterialUpdate } from './applicationRating.service';
import { recalcScore } from './recalc.service';
import { freezeAssessmentResult } from './assessmentResult.service';
import { config } from '../../config';
import { EvidenceMappingInput } from '../validators/creditApplication.validator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// CA Memo Phase 1 — header & narrative fields
export interface CaMemoHeaderFields {
  customerGroupName?: string | null;
  cifNo?: string | null;
  applicationType?: 'NEW' | 'ADDITIONAL' | 'RENEWAL' | 'VARIATION' | null;
  originatingDepartment?: string | null;
  teamLeadName?: string | null;
  referredBy?: string | null;
  accountClassification?:
    | 'PERFORMING' | 'EARLY_CARE' | 'WATCHLIST' | 'NON_CCRIS_RR' | 'CCRIS_RR' | 'IMPAIRED'
    | null;
  connectedPartyFlag?: boolean;
  connectedPartyStaffName?: string | null;
  completeDocsDate?: string | Date | null;
  lastReviewDate?: string | Date | null;
  nextReviewDate?: string | Date | null;
  relationshipSince?: string | Date | null;
  lastSiteVisitDate?: string | Date | null;
  preambleText?: string | null;
  mattersToHighlight?: string | null;
  transactionDetailsText?: string | null;
  accountStrategy?: 'GROW' | 'MAINTAIN' | 'EXIT' | null;
  crossSellingInitiatives?: string | null;
  // Phase 3 — Way Out narratives
  firstWayOut?: string | null;
  secondWayOut?: string | null;
  otherWayOut?: string | null;
}

const CA_MEMO_DATE_FIELDS = [
  'completeDocsDate', 'lastReviewDate', 'nextReviewDate', 'relationshipSince', 'lastSiteVisitDate',
] as const;

const CA_MEMO_HEADER_FIELDS = [
  'customerGroupName', 'cifNo', 'applicationType', 'originatingDepartment', 'teamLeadName',
  'referredBy', 'accountClassification', 'connectedPartyFlag', 'connectedPartyStaffName',
  'completeDocsDate', 'lastReviewDate', 'nextReviewDate', 'relationshipSince', 'lastSiteVisitDate',
  'preambleText', 'mattersToHighlight', 'transactionDetailsText',
  'accountStrategy', 'crossSellingInitiatives',
  'firstWayOut', 'secondWayOut', 'otherWayOut',
] as const;

function applyCaMemoFields(
  target: Record<string, unknown>,
  data: CaMemoHeaderFields,
): void {
  for (const key of CA_MEMO_HEADER_FIELDS) {
    if (data[key] === undefined) continue;
    const value = data[key];
    if (value !== null && (CA_MEMO_DATE_FIELDS as readonly string[]).includes(key)) {
      target[key] = new Date(value as string | Date);
    } else {
      target[key] = value;
    }
  }
}

export interface CreateCreditApplicationData extends CaMemoHeaderFields {
  borrowerProfileId: string;
  productType: string;
  purpose?: string | null;
  requestedAmount: string | number;
  requestedTenor?: number | null;
  currency?: string;
  assignedRmId?: string | null;
  assignedAnalystId?: string | null;
  /** §3.1 — Multi-branch support */
  branchId?: string | null;
}

export interface UpdateCreditApplicationData extends CaMemoHeaderFields {
  productType?: string;
  purpose?: string | null;
  requestedAmount?: string | number;
  requestedTenor?: number | null;
  currency?: string;
  assignedRmId?: string | null;
  assignedAnalystId?: string | null;
  /** §3.1 — Multi-branch support */
  branchId?: string | null;
}

export interface ListCreditApplicationsOptions {
  page?: number;
  limit?: number;
  state?: string;
  /** §2.7 — Multi-state filter (overrides `state` when both are provided) */
  states?: string[];
  productType?: string;
  borrowerProfileId?: string;
  assignedRmId?: string;
  assignedAnalystId?: string;
  search?: string;
  /** §2.4 — Filter to apps assigned to the current user (RM or analyst) */
  assignedToMe?: string;
  /** §2.7 — Filter to apps with unresolved SLA breaches */
  overdueSla?: boolean;
  /** §3.1 — Multi-branch support: scope list to a given branch */
  branchId?: string;
  /** Sort field: amount | createdAt | state (default: createdAt) */
  sortBy?: string;
  /** Sort direction: asc | desc (default: desc) */
  sortDir?: 'asc' | 'desc';
  /** §2.4 — Row-level access: Prisma where clause injected by rmScope middleware.
   *  When present, this OR filter is AND-combined with the other filters,
   *  ensuring non-admin users only see their own applications. */
  rmScopeFilter?: Prisma.CreditApplicationWhereInput;
}

// ---------------------------------------------------------------------------
// State Machine
// ---------------------------------------------------------------------------
//
// Canonical application lifecycle (Prisma ApplicationState values):
//
//   DRAFT ──submit──► SUBMITTED
//   DRAFT ──withdraw──► WITHDRAWN
//   SUBMITTED ──start_kyc──► KYC_REVIEW
//   KYC_REVIEW ──place_compliance_hold──► COMPLIANCE_HOLD
//   KYC_REVIEW ──approve_kyc──► KYC_APPROVED
//   KYC_REVIEW ──reject_kyc──► KYC_REJECTED
//   COMPLIANCE_HOLD ──clear_compliance_hold──► KYC_APPROVED
//   COMPLIANCE_HOLD ──reject_compliance──► KYC_REJECTED
//   KYC_APPROVED ──start_underwriting──► UNDERWRITING
//   KYC_REJECTED ──resubmit──► SUBMITTED
//   UNDERWRITING ──start_assessment──► CREDIT_ASSESSMENT
//   CREDIT_ASSESSMENT ──submit_to_committee──► COMMITTEE_REVIEW
//   COMMITTEE_REVIEW ──approve──► APPROVED
//   COMMITTEE_REVIEW ──reject──► REJECTED
//   APPROVED ──start_condition_fulfilment──► CONDITION_FULFILMENT
//   APPROVED ──make_offer_direct──► OFFER (legacy path)
//   CONDITION_FULFILMENT ──make_offer──► OFFER (CP gate: all CPs fulfilled/waived)
//   OFFER ──accept_offer──► ACCEPTED
//   OFFER ──decline_offer──► REJECTED
//   ACCEPTED ──disburse──► DISBURSED
//   DISBURSED ──activate──► ACTIVE
//   ACTIVE ──close──► CLOSED
//   Any non-terminal state ──withdraw──► WITHDRAWN (reason required)
//
// Terminal states (no outgoing transitions):
//   REJECTED, CLOSED, WITHDRAWN
// ---------------------------------------------------------------------------

type TransitionAction = string;

interface TransitionDef {
  from: ApplicationState;
  to: ApplicationState;
  action: TransitionAction;
  /** Extra timestamp field to set on transition */
  timestampField?: string;
  /** Reason is required for this transition */
  reasonRequired?: boolean;
}

const TRANSITIONS: TransitionDef[] = [
  // Draft → Submitted
  { from: ApplicationState.DRAFT, to: ApplicationState.SUBMITTED, action: 'submit', timestampField: 'submittedAt' },
  // Draft → Withdrawn
  { from: ApplicationState.DRAFT, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
  // Submitted → KYC Review
  { from: ApplicationState.SUBMITTED, to: ApplicationState.KYC_REVIEW, action: 'start_kyc' },
  // KYC Review → Compliance Hold
  { from: ApplicationState.KYC_REVIEW, to: ApplicationState.COMPLIANCE_HOLD, action: 'place_compliance_hold', reasonRequired: true },
  // KYC Review → KYC Approved
  { from: ApplicationState.KYC_REVIEW, to: ApplicationState.KYC_APPROVED, action: 'approve_kyc' },
  // KYC Review → KYC Rejected
  { from: ApplicationState.KYC_REVIEW, to: ApplicationState.KYC_REJECTED, action: 'reject_kyc', reasonRequired: true },
  // Compliance Hold → KYC Approved / KYC Rejected
  { from: ApplicationState.COMPLIANCE_HOLD, to: ApplicationState.KYC_APPROVED, action: 'clear_compliance_hold', reasonRequired: true },
  { from: ApplicationState.COMPLIANCE_HOLD, to: ApplicationState.KYC_REJECTED, action: 'reject_compliance', reasonRequired: true },
  // KYC Approved → Underwriting
  { from: ApplicationState.KYC_APPROVED, to: ApplicationState.UNDERWRITING, action: 'start_underwriting' },
  // KYC Rejected → Submitted (resubmit)
  { from: ApplicationState.KYC_REJECTED, to: ApplicationState.SUBMITTED, action: 'resubmit' },
  // Underwriting → Credit Assessment
  { from: ApplicationState.UNDERWRITING, to: ApplicationState.CREDIT_ASSESSMENT, action: 'start_assessment' },
  // Credit Assessment → Committee Review
  { from: ApplicationState.CREDIT_ASSESSMENT, to: ApplicationState.COMMITTEE_REVIEW, action: 'submit_to_committee' },
  // Committee Review → Approved
  { from: ApplicationState.COMMITTEE_REVIEW, to: ApplicationState.APPROVED, action: 'approve', timestampField: 'decisionedAt' },
  // Committee Review → Rejected
  { from: ApplicationState.COMMITTEE_REVIEW, to: ApplicationState.REJECTED, action: 'reject', reasonRequired: true, timestampField: 'decisionedAt' },
  // Approved → Condition Fulfilment (Sprint 2 — CP fulfilment gate)
  { from: ApplicationState.APPROVED, to: ApplicationState.CONDITION_FULFILMENT, action: 'start_condition_fulfilment' },
  // Condition Fulfilment → Offer (all CPs fulfilled/waived)
  { from: ApplicationState.CONDITION_FULFILMENT, to: ApplicationState.OFFER, action: 'make_offer' },
  // Approved → Offer (legacy direct path — still allowed for backward compat)
  { from: ApplicationState.APPROVED, to: ApplicationState.OFFER, action: 'make_offer_direct' },
  // Offer → Accepted
  { from: ApplicationState.OFFER, to: ApplicationState.ACCEPTED, action: 'accept_offer' },
  // Offer → Rejected (customer declines)
  { from: ApplicationState.OFFER, to: ApplicationState.REJECTED, action: 'decline_offer', reasonRequired: true, timestampField: 'decisionedAt' },
  // Accepted → Disbursed
  { from: ApplicationState.ACCEPTED, to: ApplicationState.DISBURSED, action: 'disburse' },
  // Disbursed → Active
  { from: ApplicationState.DISBURSED, to: ApplicationState.ACTIVE, action: 'activate' },
  // Active → Closed (reason required — closure type + justification)
  { from: ApplicationState.ACTIVE, to: ApplicationState.CLOSED, action: 'close', reasonRequired: true, timestampField: 'closedAt' },
  // Any non-terminal → Withdrawn
  { from: ApplicationState.SUBMITTED, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
  { from: ApplicationState.KYC_REVIEW, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
  { from: ApplicationState.COMPLIANCE_HOLD, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
  { from: ApplicationState.KYC_APPROVED, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
  { from: ApplicationState.KYC_REJECTED, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
  { from: ApplicationState.UNDERWRITING, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
  { from: ApplicationState.CREDIT_ASSESSMENT, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
  { from: ApplicationState.COMMITTEE_REVIEW, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
  { from: ApplicationState.APPROVED, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
  { from: ApplicationState.CONDITION_FULFILMENT, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
  { from: ApplicationState.OFFER, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
  { from: ApplicationState.ACCEPTED, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
  // ── Refer Back transitions (any review stage → REFERRED_BACK) ──
  { from: ApplicationState.KYC_REVIEW, to: ApplicationState.REFERRED_BACK, action: 'refer_back', reasonRequired: true },
  { from: ApplicationState.COMPLIANCE_HOLD, to: ApplicationState.REFERRED_BACK, action: 'refer_back', reasonRequired: true },
  { from: ApplicationState.CREDIT_ASSESSMENT, to: ApplicationState.REFERRED_BACK, action: 'refer_back', reasonRequired: true },
  { from: ApplicationState.COMMITTEE_REVIEW, to: ApplicationState.REFERRED_BACK, action: 'refer_back', reasonRequired: true },
  // ── Resume transitions (REFERRED_BACK → prior stage) ──
  { from: ApplicationState.REFERRED_BACK, to: ApplicationState.KYC_REVIEW, action: 'resume_kyc' },
  { from: ApplicationState.REFERRED_BACK, to: ApplicationState.UNDERWRITING, action: 'resume_underwriting' },
  { from: ApplicationState.REFERRED_BACK, to: ApplicationState.CREDIT_ASSESSMENT, action: 'resume_assessment' },
  { from: ApplicationState.REFERRED_BACK, to: ApplicationState.SUBMITTED, action: 'resubmit' },
  // ── REFERRED_BACK can also be withdrawn ──
  { from: ApplicationState.REFERRED_BACK, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
];

/** Terminal states — cannot transition out */
const TERMINAL_STATES: ApplicationState[] = [
  ApplicationState.REJECTED,
  ApplicationState.CLOSED,
  ApplicationState.WITHDRAWN,
];

/**
 * Get the valid transitions for a given current state.
 */
/** Action → required permission mapping (tiered RBAC) */
const TRANSITION_PERMISSIONS: Record<string, string> = {
  submit: 'credit:write',
  start_kyc: 'credit:write',
  place_compliance_hold: 'credit:approve',
  approve_kyc: 'credit:write',
  reject_kyc: 'credit:approve',
  clear_compliance_hold: 'credit:approve',
  reject_compliance: 'credit:approve',
  resubmit: 'credit:write',
  start_underwriting: 'credit:write',
  start_assessment: 'credit:write',
  submit_to_committee: 'credit:write',
  approve: 'credit:approve',
  reject: 'credit:approve',
  start_condition_fulfilment: 'credit:approve',
  make_offer: 'credit:approve',
  make_offer_direct: 'credit:approve',
  accept_offer: 'credit:write',
  decline_offer: 'credit:approve',
  disburse: 'credit:admin',
  activate: 'credit:admin',
  close: 'credit:admin',
  withdraw: 'credit:write',
  refer_back: 'credit:approve',
  resume_kyc: 'credit:write',
  resume_underwriting: 'credit:write',
  resume_assessment: 'credit:write',
};

/** Human-readable labels for transition actions */
const ACTION_LABELS: Record<string, string> = {
  submit: 'Submit Application',
  withdraw: 'Withdraw',
  start_kyc: 'Start KYC Review',
  place_compliance_hold: 'Place Compliance Hold',
  approve_kyc: 'Approve KYC',
  reject_kyc: 'Reject KYC',
  clear_compliance_hold: 'Clear Compliance Hold',
  reject_compliance: 'Reject Compliance',
  resubmit: 'Resubmit',
  start_underwriting: 'Start Underwriting',
  start_assessment: 'Start Credit Assessment',
  submit_to_committee: 'Submit to Committee',
  approve: 'Approve',
  reject: 'Reject',
  start_condition_fulfilment: 'Start Condition Fulfilment',
  make_offer: 'Make Offer',
  make_offer_direct: 'Make Offer (Direct)',
  accept_offer: 'Accept Offer',
  decline_offer: 'Decline Offer',
  disburse: 'Disburse',
  activate: 'Activate',
  close: 'Close',
  refer_back: 'Refer Back',
  resume_kyc: 'Resume KYC Review',
  resume_underwriting: 'Resume Underwriting',
  resume_assessment: 'Resume Assessment',
};

function getValidTransitions(currentState: ApplicationState): TransitionDef[] {
  if (TERMINAL_STATES.includes(currentState)) return [];
  return TRANSITIONS.filter((t) => t.from === currentState);
}

/**
 * Find a specific transition definition.
 */
function findTransition(currentState: ApplicationState, action: string): TransitionDef | undefined {
  if (TERMINAL_STATES.includes(currentState)) return undefined;
  return TRANSITIONS.find((t) => t.from === currentState && t.action === action);
}

async function getAmlAdverseFindings(applicationId: string): Promise<string[]> {
  const app = await prisma.creditApplication.findUnique({
    where: { id: applicationId },
    select: {
      borrowerProfile: {
        select: {
          amlRiskTier: true,
          isSanctionedEntity: true,
        },
      },
      bureauChecklist: {
        select: {
          noAdverseRecord: true,
          adverseExceptionReason: true,
        },
      },
    },
  });

  const findings: string[] = [];
  const amlRiskTier = app?.borrowerProfile?.amlRiskTier;
  if (amlRiskTier === 'HIGH' || amlRiskTier === 'PROHIBITED') {
    findings.push(`AML risk tier is ${amlRiskTier}`);
  }
  if (app?.borrowerProfile?.isSanctionedEntity) {
    findings.push('Borrower is flagged as a sanctioned entity');
  }
  const checklist = app?.bureauChecklist;
  if (checklist && checklist.noAdverseRecord === false && !checklist.adverseExceptionReason) {
    findings.push('Bureau checklist has adverse records without an exception reason');
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Application number generator
// ---------------------------------------------------------------------------

/**
 * Generate the next application number in the format CA-YYYY-NNNNN.
 * Uses an atomic UPDATE ... RETURNING pattern with row-level lock via
 * CreditAppCounter to prevent race conditions on concurrent requests.
 */
async function generateApplicationNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CA-${year}-`;

  // Retry up to 3 times in case the counter is out of sync with existing rows
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await prisma.$transaction(async (tx) => {
      // Try to find existing counter row
      let counter = await tx.creditAppCounter.findUnique({
        where: { prefix: 'CA' },
      });

      if (!counter) {
        // No counter yet — find the max sequence from existing applications
        const maxApp = await tx.creditApplication.findFirst({
          where: { applicationNo: { startsWith: prefix } },
          orderBy: { applicationNo: 'desc' },
          select: { applicationNo: true },
        });
        const maxSeq = maxApp?.applicationNo
          ? parseInt(maxApp.applicationNo.replace(prefix, ''), 10) || 0
          : 0;

        counter = await tx.creditAppCounter.create({
          data: { prefix: 'CA', lastSeq: maxSeq + 1 },
        });
      } else {
        // Before incrementing, verify the next seq won't collide with an existing app
        const candidateNo = `${prefix}${String(counter.lastSeq + 1).padStart(5, '0')}`;
        const existing = await tx.creditApplication.findUnique({
          where: { applicationNo: candidateNo },
          select: { id: true },
        });

        if (existing) {
          // Counter is stale — find actual max and rebase
          const maxApp = await tx.creditApplication.findFirst({
            where: { applicationNo: { startsWith: prefix } },
            orderBy: { applicationNo: 'desc' },
            select: { applicationNo: true },
          });
          const actualMax = maxApp?.applicationNo
            ? parseInt(maxApp.applicationNo.replace(prefix, ''), 10) || 0
            : 0;

          counter = await tx.creditAppCounter.update({
            where: { id: counter.id },
            data: { lastSeq: actualMax + 1 },
          });
          return counter.lastSeq;
        }

        // Safe to increment
        counter = await tx.creditAppCounter.update({
          where: { id: counter.id },
          data: { lastSeq: { increment: 1 } },
        });
      }

      return counter.lastSeq;
    });

    const candidateNo = `${prefix}${String(result).padStart(5, '0')}`;
    // Double-check outside transaction for safety
    const exists = await prisma.creditApplication.findUnique({
      where: { applicationNo: candidateNo },
      select: { id: true },
    });
    if (!exists) return candidateNo;

    // Collision — retry (counter will be rebased on next iteration)
    console.warn(`Application number collision on attempt ${attempt}: ${candidateNo}, retrying...`);
  }

  // Fallback: generate a timestamp-based unique number
  const ts = Date.now().toString(36).toUpperCase();
  return `${prefix}${ts}`;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class CreditApplicationService {
  /**
   * List credit applications with pagination and filters.
   */
  async listApplications(options: ListCreditApplicationsOptions) {
    const {
      page = 1,
      limit = 20,
      state,
      states,
      productType,
      borrowerProfileId,
      assignedRmId,
      assignedAnalystId,
      search,
      assignedToMe,
      overdueSla,
      branchId,
      sortBy,
      sortDir = 'desc',
      rmScopeFilter,
    } = options;

    const skip = (page - 1) * limit;

    const where: Prisma.CreditApplicationWhereInput = {
      deletedAt: null,
    };

    if (states && states.length > 0) {
      // §2.7 — Multi-state filter overrides single state
      where.state = { in: states as ApplicationState[] };
    } else if (state) {
      where.state = state as ApplicationState;
    }
    if (productType) {
      where.productType = productType as any;
    }
    if (borrowerProfileId) {
      where.borrowerProfileId = borrowerProfileId;
    }
    if (assignedRmId) {
      where.assignedRmId = assignedRmId;
    }
    if (assignedAnalystId) {
      where.assignedAnalystId = assignedAnalystId;
    }
    if (branchId) {
      where.branchId = branchId;
    }
    if (search) {
      where.OR = [
        { applicationNo: { contains: search, mode: 'insensitive' } },
        { purpose: { contains: search, mode: 'insensitive' } },
      ];
    }

    // §2.4 — assignedToMe: OR filter for RM or analyst
    if (assignedToMe) {
      const meFilter: Prisma.CreditApplicationWhereInput = {
        OR: [
          { assignedRmId: assignedToMe },
          { assignedAnalystId: assignedToMe },
        ],
      };
      const existingAnd = (where.AND ?? []);
      where.AND = Array.isArray(existingAnd) ? [...existingAnd, meFilter] : [existingAnd, meFilter];
    }

    // §2.7 — overdueSla: unresolved breaches
    if (overdueSla) {
      const slaFilter: Prisma.CreditApplicationWhereInput = {
        slaBreaches: { some: { resolvedAt: null } },
      };
      const existingAnd = (where.AND ?? []);
      where.AND = Array.isArray(existingAnd) ? [...existingAnd, slaFilter] : [existingAnd, slaFilter];
    }

    // §2.4 — Row-level access: AND-combine the RM scope filter
    // This ensures non-admin users can only see applications assigned to them,
    // even if they try to filter by another RM's ID.
    if (rmScopeFilter) {
      // Merge scope filter as an AND condition with the existing where clause
      // Prisma's AND allows combining filters; the rmScopeFilter is typically
      // an OR like: [{ assignedRmId: userId }, { assignedAnalystId: userId }]
      if (where.AND) {
        // If AND already exists (array), append the scope filter
        const existingAnd = Array.isArray(where.AND) ? where.AND : [where.AND];
        (where.AND as Prisma.CreditApplicationWhereInput[]) = [
          ...existingAnd,
          rmScopeFilter,
        ];
      } else {
        where.AND = [rmScopeFilter];
      }

      // If rmScopeFilter narrows to assignedRmId, also clear any explicit assignedRmId
      // that would conflict (the scope filter takes precedence)
      if (rmScopeFilter.OR) {
        // The scope is an OR of assignedRmId/assignedAnalystId — allow the user's
        // explicit filter to further narrow within their own scope
        // No action needed: SQL AND will naturally combine both
      }
    }

    // §2.7 — Dynamic sorting
    const sortFieldMap: Record<string, string> = {
      amount: 'requestedAmount',
      createdAt: 'createdAt',
      state: 'state',
    };
    const prismaSortField = sortFieldMap[sortBy ?? ''] ?? 'createdAt';
    const orderBy = { [prismaSortField]: sortDir };

    const [applications, total] = await Promise.all([
      prisma.creditApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          borrowerProfile: {
            select: {
              id: true,
              borrowerType: true,
              name: true,
              creditRiskRating: true,
            },
          },
          branch: { select: { id: true, code: true, name: true } },
          assignedRm: { select: { id: true, firstName: true, lastName: true } },
          assignedAnalyst: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.creditApplication.count({ where }),
    ]);

    // §2.7 — Attach SLA breach flag from CreditSlaBreach table (single source of truth)
    const appIds = applications.map(a => a.id);
    const breachedAppIds = appIds.length > 0
      ? new Set(
          (await prisma.creditSlaBreach.findMany({
            where: { resolvedAt: null, applicationId: { in: appIds } },
            select: { applicationId: true },
            distinct: ['applicationId'],
          })).map(b => b.applicationId),
        )
      : new Set<string>();

    const applicationsWithBreach = applications.map(app => ({
      ...app,
      hasOpenSlaBreach: breachedAppIds.has(app.id),
    }));

    return {
      applications: applicationsWithBreach,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get summary statistics for the applications list page.
   * Returns total, active, myAssigned, pipeline counts by grouped stage,
   * total exposure sum, and SLA breach count — all respecting RM scope.
   */
  async getApplicationSummary(rmScopeFilter?: Prisma.CreditApplicationWhereInput, userId?: string) {
    const baseWhere: Prisma.CreditApplicationWhereInput = { deletedAt: null };
    const scopedWhere = rmScopeFilter
      ? { ...baseWhere, AND: [rmScopeFilter] }
      : baseWhere;

    const [total, activeResult, myAssignedResult, pipelineResult, exposureResult, overdueSlaCount] =
      await Promise.all([
        // Total applications
        prisma.creditApplication.count({ where: scopedWhere }),

        // Active (non-terminal) applications
        prisma.creditApplication.count({
          where: {
            ...scopedWhere,
            state: { notIn: ['REJECTED', 'CLOSED', 'WITHDRAWN'] as ApplicationState[] },
          },
        }),

        // My assigned (RM or analyst)
        userId
          ? prisma.creditApplication.count({
              where: {
                ...scopedWhere,
                OR: [
                  { assignedRmId: userId },
                  { assignedAnalystId: userId },
                ],
              },
            })
          : Promise.resolve(0),

        // Pipeline counts by grouped stage
        prisma.creditApplication.groupBy({
          by: ['state'],
          where: scopedWhere,
          _count: { state: true },
        }),

        // Total exposure (sum of requestedAmount)
        prisma.creditApplication.aggregate({
          where: scopedWhere,
          _sum: { requestedAmount: true },
        }),

        // Overdue SLA breach count (scoped)
        prisma.creditSlaBreach.count({
          where: {
            resolvedAt: null,
            application: scopedWhere,
          },
        }),
      ]);

    // Map raw pipeline state counts into grouped stages matching the frontend KANBAN_COLUMNS
    const stateCountMap = new Map<string, number>();
    for (const row of pipelineResult) {
      stateCountMap.set(row.state, row._count.state);
    }

    const PIPELINE_GROUPS: Record<string, ApplicationState[]> = {
      lead: ['DRAFT'],
      onboarding: ['SUBMITTED', 'KYC_REVIEW', 'COMPLIANCE_HOLD', 'KYC_APPROVED', 'KYC_REJECTED'],
      assessment: ['UNDERWRITING', 'CREDIT_ASSESSMENT'],
      approval: ['COMMITTEE_REVIEW', 'APPROVED', 'REJECTED'],
      conditionFulfilment: ['CONDITION_FULFILMENT'],
      offer: ['OFFER', 'ACCEPTED'],
      disbursement: ['DISBURSED'],
      completed: ['ACTIVE', 'CLOSED', 'WITHDRAWN'],
    };

    const pipeline = Object.entries(PIPELINE_GROUPS).map(([key, states]) => ({
      key,
      count: states.reduce((sum, s) => sum + (stateCountMap.get(s) ?? 0), 0),
    }));

    return {
      total,
      active: activeResult,
      myAssigned: myAssignedResult,
      pipeline,
      totalExposure: exposureResult._sum.requestedAmount
        ? Number(exposureResult._sum.requestedAmount)
        : 0,
      overdueSla: overdueSlaCount,
    };
  }

  /**
   * Get a single credit application by ID.
   */
  async getApplication(id: string) {
    const app = await prisma.creditApplication.findFirst({
      where: { id, deletedAt: null },
      include: {
        borrowerProfile: {
          select: {
            id: true,
            borrowerType: true,
            name: true,
            registrationNumber: true,
            industry: true,
            nricPassport: true,
            address: true,
            phone: true,
            email: true,
            account: { select: { id: true, name: true, industry: true, companySize: true, annualRevenue: true, registrationNumber: true, accountType: true, parentAccountId: true, description: true, address: true, city: true, state: true, country: true } },
            contact: { select: { id: true, firstName: true, lastName: true, email: true, nricPassport: true, phone: true, mobile: true, jobTitle: true, dateOfBirth: true } },
            // §S3 — Include financial statements for completion check + FinancialsTab
            financialStatements: {
              where: { deletedAt: null },
              select: {
                id: true,
                statementType: true,
                period: true,
                fiscalYearEnd: true,
                currency: true,
                status: true,
                _count: { select: { lineItems: true, ratios: true } },
                // P3-7 — expose key ratios so KPI cards can show DSCR / Current Ratio
                ratios: {
                  where: { ratioKey: { in: ['dscr', 'current_ratio', 'debt_to_equity'] } },
                  select: { ratioKey: true, value: true },
                },
              },
              orderBy: { fiscalYearEnd: 'desc' as const },
            },
          },
        },
        assignedRm: { select: { id: true, firstName: true, lastName: true } },
        assignedAnalyst: { select: { id: true, firstName: true, lastName: true } },
        facilities: true,
        parties: { include: { borrowerProfile: { select: { id: true, borrowerType: true, name: true } } } },
        documents: { where: { deletedAt: null } },
        // §2.3 — Include related records needed for section completion checks
        retailIncome: true,
        bureauChecklist: true,
        scoreRuns: {
          orderBy: { runAt: 'desc' as const },
          take: 1,
          select: {
            id: true,
            riskRating: true,
            baseRiskRating: true,
            totalScore: true,
            isOverride: true,
            runAt: true,
            createdAt: true,
            bureauCapsApplied: true,
            inputSnapshot: true,
            missingInputs: true,
            calculationSource: true,
            calculatedById: true,
            factorScores: true,
            scorecardVersionId: true,
          },
        },
        bureauChecks: true,
        _count: { select: { scoreRuns: true } },
        assessmentResults: {
          where: { status: 'FROZEN' },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    }) as any;

    if (!app) return null;

    // Prefer canonical denormalised application rating; retain latest-score fallback
    // for older records that have not been backfilled yet.
    const latestScoreRun = app.scoreRuns?.[0];
    app.riskRating = app.riskRating ?? latestScoreRun?.riskRating ?? null;
    app.baseRiskRating = latestScoreRun?.baseRiskRating ?? null;
    app.totalScore = latestScoreRun ? Number(latestScoreRun.totalScore) : null;
    app.scoreRunCount = app._count?.scoreRuns ?? app.scoreRuns?.length ?? 0;
    app.latestScoreRunAt = latestScoreRun?.runAt ?? latestScoreRun?.createdAt ?? null;
    app.latestScoreRunStatus = latestScoreRun ? 'COMPLETED' : null;
    // Phase 4 — expose explainability fields from the latest score run
    app.bureauCapsApplied = latestScoreRun?.bureauCapsApplied ?? null;
    app.missingInputs = latestScoreRun?.missingInputs ?? null;
    app.inputSnapshot = latestScoreRun?.inputSnapshot ?? null;
    app.calculationSource = latestScoreRun?.calculationSource ?? null;
    app.isOverride = latestScoreRun?.isOverride ?? false;
    app.factorScores = latestScoreRun?.factorScores ?? null;
    // P1-5 — flatten the frozen assessment result if it exists
    const frozenAssessment = app.assessmentResults?.[0];
    app.frozenAssessment = frozenAssessment ?? null;
    // P3-7 — flatten key financial ratios from the latest approved statement
    // so KPI cards can show DSCR / Current Ratio / Debt-to-Equity
    const latestApprovedStmt = app.borrowerProfile?.financialStatements?.find(
      (s: any) => s.status === 'APPROVED',
    ) ?? app.borrowerProfile?.financialStatements?.[0];
    if (latestApprovedStmt?.ratios) {
      const ratioMap: Record<string, number> = {};
      for (const r of latestApprovedStmt.ratios) {
        ratioMap[r.ratioKey] = Number(r.value);
      }
      app.dscr = ratioMap['dscr'] ?? null;
      app.currentRatio = ratioMap['current_ratio'] ?? null;
      app.debtToEquity = ratioMap['debt_to_equity'] ?? null;
    }

    return app;
  }

  /**
   * Create a new credit application.
   */
  async createApplication(data: CreateCreditApplicationData, actorId?: string) {
    const applicationNo = await generateApplicationNo();

    const effectiveRmId = data.assignedRmId ?? actorId;  // ← auto-assign creating user as RM when none specified

    // §3.1 — Default branch from the assigned RM's branch when not explicitly provided
    let effectiveBranchId = data.branchId ?? null;
    if (!effectiveBranchId && effectiveRmId) {
      const rm = await prisma.user.findUnique({ where: { id: effectiveRmId }, select: { branchId: true } });
      effectiveBranchId = rm?.branchId ?? null;
    }

    const createData: Prisma.CreditApplicationCreateInput = {
      applicationNo,
      state: ApplicationState.DRAFT,
      borrowerProfile: { connect: { id: data.borrowerProfileId } },
      productType: data.productType as any,
      purpose: data.purpose ?? undefined,
      requestedAmount: new Prisma.Decimal(data.requestedAmount),
      requestedTenor: data.requestedTenor ?? undefined,
      currency: (data.currency as any) ?? 'MYR',
      ...(effectiveRmId && { assignedRm: { connect: { id: effectiveRmId } } }),
      ...(data.assignedAnalystId && { assignedAnalyst: { connect: { id: data.assignedAnalystId } } }),
      ...(effectiveBranchId && { branch: { connect: { id: effectiveBranchId } } }),
    };
    applyCaMemoFields(createData as Record<string, unknown>, data);

    const application = await prisma.creditApplication.create({
      data: createData,
      include: {
        borrowerProfile: { select: { id: true, borrowerType: true, name: true, registrationNumber: true, industry: true, nricPassport: true, address: true, phone: true, email: true } },
        assignedRm: { select: { id: true, firstName: true, lastName: true } },
        assignedAnalyst: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Create initial audit event
    await this.createAuditEvent(application.id, actorId, 'create', null, ApplicationState.DRAFT, {
      applicationNo,
    });

    // P2-2: Determine and persist the processing lane
    try {
      const { persistLane } = await import('./lane.service');
      await persistLane(application.id);
    } catch (_e) {
      // Non-blocking — lane defaults to CORPORATE if determination fails
    }

    return application;
  }

  /**
   * Update an existing credit application (only in DRAFT state).
   */
  async updateApplication(id: string, data: UpdateCreditApplicationData, actorId?: string, expectedVersion?: number) {
    const existing = await prisma.creditApplication.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) return null;

    // Assignment-only updates (assignedRmId / assignedAnalystId) are allowed in
    // any non-terminal state so that managers can reassign staff after submission.
    // All other field changes still require DRAFT state.
    const TERMINAL_STATES: ApplicationState[] = [
      ApplicationState.CLOSED,
      ApplicationState.WITHDRAWN,
      ApplicationState.ACTIVE,
      ApplicationState.DISBURSED,
    ];
    const isAssignmentOnlyUpdate =
      Object.keys(data).every(k => k === 'assignedRmId' || k === 'assignedAnalystId');

    if (isAssignmentOnlyUpdate) {
      if (TERMINAL_STATES.includes(existing.state)) {
        throw new Error('Cannot reassign RM/Analyst on a terminal application');
      }
    } else {
      if (existing.state !== ApplicationState.DRAFT) {
        throw new Error('Application can only be edited in DRAFT state');
      }
    }

    // §F25 — Mandatory optimistic concurrency: version is required
    if (expectedVersion === undefined || expectedVersion === null) {
      throw new AppError('version required', 428);
    }

    // §2.3 — Optimistic concurrency check
    if (existing.version !== expectedVersion) {
      const { versionConflictError } = await import('../../middleware/occ.middleware');
      throw versionConflictError(existing.version, {
        id: existing.id,
        version: existing.version,
        state: existing.state,
        updatedAt: existing.updatedAt,
      });
    }

    const updateData: Prisma.CreditApplicationUpdateInput = {};

    if (data.productType !== undefined) updateData.productType = data.productType as any;
    if (data.purpose !== undefined) updateData.purpose = data.purpose;
    if (data.requestedAmount !== undefined) updateData.requestedAmount = new Prisma.Decimal(data.requestedAmount);
    if (data.requestedTenor !== undefined) updateData.requestedTenor = data.requestedTenor;
    if (data.currency !== undefined) updateData.currency = data.currency as any;
    if (data.assignedRmId !== undefined) {
      (updateData as any).assignedRmId = data.assignedRmId;
    }
    if (data.assignedAnalystId !== undefined) {
      (updateData as any).assignedAnalystId = data.assignedAnalystId;
    }
    if (data.branchId !== undefined) {
      (updateData as any).branchId = data.branchId;
    }
    applyCaMemoFields(updateData as Record<string, unknown>, data);

    // §2.3 — Auto-increment version on every update
    (updateData as any).version = { increment: 1 };

    const application = await prisma.creditApplication.update({
      where: { id },
      data: updateData,
      include: {
        borrowerProfile: { select: { id: true, borrowerType: true, name: true, registrationNumber: true, industry: true, nricPassport: true, address: true, phone: true, email: true, account: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true } } } },
        assignedRm: { select: { id: true, firstName: true, lastName: true } },
        assignedAnalyst: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Create audit event for update — include assignment change details
    const auditMeta: Record<string, any> = { updatedFields: Object.keys(data) };
    if (data.assignedRmId !== undefined) {
      auditMeta.previousRmId = existing.assignedRmId;
      auditMeta.newRmId = data.assignedRmId;
    }
    if (data.assignedAnalystId !== undefined) {
      auditMeta.previousAnalystId = existing.assignedAnalystId;
      auditMeta.newAnalystId = data.assignedAnalystId;
    }
    await this.createAuditEvent(id, actorId, 'update', existing.state, existing.state, auditMeta);

    // ── Notify newly assigned RM / Analyst ──
    if (data.assignedRmId && data.assignedRmId !== existing.assignedRmId) {
      try {
        const { notify } = await import('../../services/notification.service');
        await notify({
          userId: data.assignedRmId,
          eventType: 'CREDIT_RM_ASSIGNED',
          variables: {
            applicationId: id,
            applicationNo: application.applicationNo ?? id,
            assigneeRole: 'RM',
          },
        });
      } catch { /* non-blocking */ }
    }
    if (data.assignedAnalystId && data.assignedAnalystId !== existing.assignedAnalystId) {
      try {
        const { notify } = await import('../../services/notification.service');
        await notify({
          userId: data.assignedAnalystId,
          eventType: 'CREDIT_ANALYST_ASSIGNED',
          variables: {
            applicationId: id,
            applicationNo: application.applicationNo ?? id,
            assigneeRole: 'Analyst',
          },
        });
      } catch { /* non-blocking */ }
    }

    // Phase 2 — event-driven recalc: amount/tenor/product changes affect
    // exposure-based approval authority and retail DSR (proposedInstalment).
    const materialFields = ['productType', 'requestedAmount', 'requestedTenor'];
    if (materialFields.some((f) => (data as any)[f] !== undefined)) {
      recalcScore(id, 'application_amount_tenor_product_update', {
        sourceUpdatedAt: new Date(),
      }).catch(() => {});
    }

    return application;
  }

  /**
   * Soft-delete a credit application (only in DRAFT state).
   */
  async deleteApplication(id: string, actorId?: string) {
    const existing = await prisma.creditApplication.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) return null;

    // Only allow deletion in DRAFT state
    if (existing.state !== ApplicationState.DRAFT) {
      throw new Error('Application can only be deleted in DRAFT state');
    }

    const application = await prisma.creditApplication.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Create audit event
    await this.createAuditEvent(id, actorId, 'delete', existing.state, existing.state, {});

    return application;
  }

  // -------------------------------------------------------------------------
  // State Machine — Transition
  // -------------------------------------------------------------------------

  /**
   * Transition a credit application to a new state.
   */
  async transitionApplication(
    id: string,
    action: string,
    actorId?: string,
    reason?: string,
    options?: { skipApprovalChainCheck?: boolean; rejectionReasonCode?: string },
  ) {
    const existing = await prisma.creditApplication.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) return null;

    const transition = findTransition(existing.state, action);

    if (!transition) {
      const validActions = getValidTransitions(existing.state).map((t) => t.action);
      throw new Error(
        `Invalid transition '${action}' from state '${existing.state}'. Valid actions: ${validActions.join(', ')}`,
      );
    }

    if (transition.reasonRequired && !reason) {
      throw new Error(`Reason is required for action '${action}'`);
    }

    // §2.7 — Require structured rejection reason code for reject actions
    if ((action === 'reject' || action === 'reject_kyc' || action === 'decline_offer') && !options?.rejectionReasonCode) {
      throw new Error(`Rejection reason code is required for action '${action}'`);
    }

    // §1.7 — Submission-readiness hard gate: block DRAFT -> SUBMITTED if intake validation fails.
    // Committee-only controls (bureau verification, verified docs, signoff, score run) are enforced
    // separately on submit_to_committee to avoid over-blocking early intake.
    if (action === 'submit') {
      const readiness = await validateSubmissionReadiness(id, { stage: 'submission' });
      if (!readiness.ready) {
        const errorMessages = readiness.errors.map((e) => `${e.field}: ${e.message}`).join('; ');
        throw new Error(`Submission blocked — ${errorMessages}`);
      }
    }

    if (action === 'approve_kyc') {
      const adverseFindings = await getAmlAdverseFindings(id);
      if (adverseFindings.length > 0) {
        throw Object.assign(
          new Error(
            `Cannot approve KYC — compliance hold required for adverse AML/PEP/sanctions findings: ${adverseFindings.join('; ')}. Use Place Compliance Hold instead.`,
          ),
          { statusCode: 400 },
        );
      }
    }

    // Sprint 1 hard gates: block committee submission unless scorecard, verified documents,
    // bureau verification, and three-way signoff are complete.
    if (action === 'submit_to_committee') {
      const signoffs = await prisma.applicationSignoff.findMany({
        where: { applicationId: id },
        select: { role: true, signedAt: true, signedById: true },
      });
      const signed = new Set(signoffs.filter(s => s.signedAt).map(s => s.role));
      const required: SignoffRole[] = ['PREPARED_BY', 'REVIEWED_BY', 'CONCURRED_BY'] as const;
      const missingRoles = required.filter(r => !signed.has(r));
      if (missingRoles.length > 0) {
        throw Object.assign(
          new Error(
            `Cannot submit to committee — CA Memo sign-off incomplete. Missing: ${missingRoles.join(', ')}.`,
          ),
          { statusCode: 400 },
        );
      }

      const signedBy = new Map(signoffs.map(s => [s.role, s.signedById]));
      if (signedBy.get('PREPARED_BY') === signedBy.get('REVIEWED_BY')) {
        throw Object.assign(
          new Error('Cannot submit to committee — segregation of duties violation: Prepared By and Reviewed By cannot be the same user.'),
          { statusCode: 400 },
        );
      }
      if (signedBy.get('REVIEWED_BY') === signedBy.get('CONCURRED_BY')) {
        throw Object.assign(
          new Error('Cannot submit to committee — segregation of duties violation: Reviewed By and Concurred By cannot be the same user.'),
          { statusCode: 400 },
        );
      }
      if (signedBy.get('PREPARED_BY') === signedBy.get('CONCURRED_BY')) {
        throw Object.assign(
          new Error('Cannot submit to committee — segregation of duties violation: Prepared By and Concurred By cannot be the same user.'),
          { statusCode: 400 },
        );
      }

      // Committee gate: require at least one score run AND the latest run
      // must be at least as fresh as the most recent material input change.
      const scoreRunCount = await prisma.creditScoreRun.count({ where: { applicationId: id } });
      if (scoreRunCount === 0) {
        throw Object.assign(
          new Error('Cannot submit to committee — at least one completed CreditScoreRun is required. A manually populated risk rating alone is not sufficient.'),
          { statusCode: 400 },
        );
      }

      const latestRunAt = await getLatestScoreRunAt(id);
      const latestMaterialAt = await getLatestMaterialUpdate(id);
      if (latestRunAt && latestMaterialAt > latestRunAt) {
        throw Object.assign(
          new Error(
            `Cannot submit to committee — the latest score run (${latestRunAt.toISOString()}) is stale relative to material inputs updated at ${latestMaterialAt.toISOString()}. Trigger a rescore before submitting.`,
          ),
          { statusCode: 400 },
        );
      }

      // P1-3 — absolute staleness ceiling: even if no material input changed,
      // a run older than the configurable ceiling (default 30 days) is blocked.
      if (latestRunAt) {
        const maxAgeDays = config.credit.scoreMaxAgeDays;
        const ageMs = Date.now() - latestRunAt.getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        if (ageDays > maxAgeDays) {
          throw Object.assign(
            new Error(
              `Cannot submit to committee — the latest score run is ${Math.round(ageDays)} days old, exceeding the ${maxAgeDays}-day staleness ceiling. Trigger a rescore before submitting.`,
            ),
            { statusCode: 400 },
          );
        }
      }

      // P1-5 — freeze the assessment result at committee submission so the
      // rating/recommendation/reason-codes are immutable from this point forward
      await freezeAssessmentResult(id, actorId ?? 'system');

      const readiness = await validateSubmissionReadiness(id, { stage: 'committee' });
      if (!readiness.ready) {
        const errorMessages = readiness.errors.map((e) => `${e.field}: ${e.message}`).join('; ');
        throw Object.assign(
          new Error(`Cannot submit to committee — ${errorMessages}`),
          { statusCode: 400 },
        );
      }
    }
    // §2.5 — Approval chain completion gate: block approve/reject from COMMITTEE_REVIEW
    // unless all required approval decisions have been collected via the
    // approval actions endpoint. This prevents bypassing multi-approver gating
    // via simple state machine transitions.
    // Skipped when called from committee finalization (which has its own
    // quorum/voting governance) or admin-level bulk operations.
    if ((action === 'approve' || action === 'reject') && !options?.skipApprovalChainCheck) {
      const appWithBorrower = await prisma.creditApplication.findUnique({
        where: { id },
        include: {
          borrowerProfile: { select: { creditRiskRating: true } },
        },
      });

      if (appWithBorrower) {
        const borrowerRating = await getApplicationEffectiveRating(id);
        // §F2 — Use canonical exposure computation instead of stale totalExposure
        const { totalExposure: liveExposure } = await computeBorrowerExposure(appWithBorrower.borrowerProfileId);
        const totalExposure = formatCurrency(
          liveExposure || appWithBorrower.requestedAmount,
        ) ?? 0;

        const authorityResult = await approvalMatrixService.lookupApprovalAuthority(
          totalExposure,
          borrowerRating ?? 'NR',
          appWithBorrower.branchId,
          appWithBorrower.lane,
        );

        const requiredApproverCount = authorityResult?.requiredApproverCount ?? 1;

        // Count distinct approvers who have submitted APPROVE decisions
        const approveDecisions = await prisma.creditDecision.findMany({
          where: {
            applicationId: id,
            decisionType: ApprovalDecisionType.APPROVE,
          },
          select: { decisionById: true },
        });
        const distinctApproverIds = new Set(approveDecisions.map((d) => d.decisionById));
        const approvalsCollected = distinctApproverIds.size;

        if (approvalsCollected < requiredApproverCount) {
          throw Object.assign(
            new Error(
              `Approval chain incomplete: ${approvalsCollected}/${requiredApproverCount} required approvals collected. ` +
              `Use the approval actions endpoint to submit approval decisions before transitioning to ${action === 'approve' ? 'APPROVED' : 'REJECTED'}.`,
            ),
            { statusCode: 403 },
          );
        }
      }
    }

    // §1.3 — Hard-block: disallow ACTIVE/DISBURSED if tangible collateral valuation > 12 months
    if (action === 'activate' || action === 'disburse') {
      const { hasStaleCollateralValuations } = await import('../jobs/collateralInsuranceMonitor.job');
      const freshness = await hasStaleCollateralValuations(id);
      if (freshness.blocked) {
        const details = freshness.staleCollaterals
          .map((c: { type: string; ageMonths: number | null }) => `${c.type}: valuation ${c.ageMonths ?? 'N/A'} months old`)
          .join('; ');
        throw new Error(
          `Cannot ${action}: stale collateral valuations (>12 months). ${details}. Please update valuations before proceeding.`,
        );
      }
    }

    // Sprint 2 — CP Fulfilment gate: block CONDITION_FULFILMENT → OFFER if any
    // PRECEDENT conditions are unfulfilled and not formally waived.
    if (action === 'make_offer' && transition.from === ApplicationState.CONDITION_FULFILMENT) {
      const precedentConditions = await prisma.condition.findMany({
        where: { applicationId: id, conditionType: 'PRECEDENT' },
        select: { id: true, title: true, isFulfilled: true, status: true, waiverReason: true, waivedAt: true },
      });
      const blocking = precedentConditions.filter(
        (c) => !c.isFulfilled && c.status !== 'WAIVED' && !c.waivedAt,
      );
      if (blocking.length > 0) {
        const details = blocking.map((c) => c.title).join(', ');
        throw Object.assign(
          new Error(
            `Cannot make offer — ${blocking.length} precedent condition(s) unfulfilled and not waived: ${details}. Fulfil or formally waive all precedent conditions before making an offer.`,
          ),
          { statusCode: 400 },
        );
      }
    }

    // Sprint 2 — SICR gate: block submit_to_committee for corporate applications
    // if no SICR assessment exists.
    if (action === 'submit_to_committee') {
      const appWithBorrowerType = await prisma.creditApplication.findUnique({
        where: { id },
        select: {
          borrowerProfile: { select: { borrowerType: true } },
        },
      });
      const borrowerType = appWithBorrowerType?.borrowerProfile?.borrowerType;
      if (borrowerType === 'CORPORATE') {
        const sicrCount = await prisma.sicrAssessment.count({ where: { applicationId: id } });
        if (sicrCount === 0) {
          throw Object.assign(
            new Error(
              'Cannot submit to committee — at least one SICR assessment is required for corporate applications.',
            ),
            { statusCode: 400 },
          );
        }
      }
    }

    // Sprint 2 — Financial statement validation: block submit_to_committee for
    // corporate/SME if financial statements have no line items or balance sheet
    // doesn't balance (Assets = Liabilities + Equity within tolerance).
    if (action === 'submit_to_committee') {
      const appWithBp = await prisma.creditApplication.findUnique({
        where: { id },
        select: {
          borrowerProfile: {
            select: {
              borrowerType: true,
              id: true,
            },
          },
        },
      });
      const bt = appWithBp?.borrowerProfile?.borrowerType;
      const bpId = appWithBp?.borrowerProfile?.id;
      const isRetail = bt === 'INDIVIDUAL' || bt === 'SOLE_PROPRIETOR';

      if (!isRetail && bpId) {
        const statements = await prisma.financialStatement.findMany({
          where: { borrowerProfileId: bpId, deletedAt: null, statementType: 'BS' },
          include: { lineItems: { select: { lineKey: true, amount: true } } },
        });

        for (const stmt of statements) {
          // Check: statement must have at least 1 line item
          if (stmt.lineItems.length === 0) {
            throw Object.assign(
              new Error(
                `Cannot submit to committee — balance sheet (FY ${stmt.fiscalYearEnd.toISOString().slice(0, 4)}) has no line items. Populate financial data before submission.`,
              ),
              { statusCode: 400 },
            );
          }

          // Check: Assets = Liabilities + Equity (within RM 1 tolerance)
          const vals: Record<string, number> = {};
          for (const li of stmt.lineItems) {
            vals[li.lineKey] = Number(li.amount);
          }
          const totalAssets = vals['total_assets'] ?? 0;
          const totalLiabilities = vals['total_liabilities'] ?? 0;
          const totalEquity = vals['total_equity'] ?? 0;
          if (totalAssets > 0 || totalLiabilities > 0 || totalEquity > 0) {
            const delta = Math.abs(totalAssets - (totalLiabilities + totalEquity));
            if (delta > 1) {
              throw Object.assign(
                new Error(
                  `Cannot submit to committee — balance sheet (FY ${stmt.fiscalYearEnd.toISOString().slice(0, 4)}) does not balance: Assets (${totalAssets.toFixed(2)}) ≠ Liabilities (${totalLiabilities.toFixed(2)}) + Equity (${totalEquity.toFixed(2)}). Delta: ${delta.toFixed(2)}.`,
                ),
                { statusCode: 400 },
              );
            }
          }
        }
      }
    }

    // §1.3 — E-sign document gate: block OFFER → ACCEPTED if no verified Letter of Offer
    let acceptedOfferDocId: string | null = null;
    if (action === 'accept_offer') {
      const signedLoo = await prisma.creditDocument.findFirst({
        where: {
          applicationId: id,
          classification: 'LETTER_OF_OFFER',
          verificationStatus: 'VERIFIED',
          deletedAt: null,
        },
      });
      if (!signedLoo) {
        throw Object.assign(
          new Error('Cannot accept offer: a verified signed Letter of Offer must be uploaded as a Legal document before the offer can be accepted.'),
          { statusCode: 400 },
        );
      }
      acceptedOfferDocId = signedLoo.id;

      // §2.3 — LOO expiry gate: block OFFER → ACCEPTED if LOO has expired
      const { looService } = await import('./loo.service');
      const { expired, expiryDate } = await looService.checkExpiry(id);
      if (expired) {
        const msg = expiryDate
          ? `Letter of Offer has expired on ${expiryDate.toLocaleDateString()}. Please regenerate.`
          : 'Letter of Offer has expired. Please regenerate.';
        throw Object.assign(new Error(msg), { statusCode: 400 });
      }
    }

    // §1.2 — Disbursement control gate: block direct ACCEPTED→DISBURSED transition.
    // Disbursement must go through DisbursementOrder workflow (create → approve → disburse).
    if (action === 'disburse') {
      const { DisbursementStatus } = await import('@prisma/client');
      const order = await prisma.disbursementOrder.findUnique({ where: { applicationId: id } });
      if (!order) {
        throw Object.assign(
          new Error('Cannot disburse: no disbursement order exists. Create and approve a disbursement order first.'),
          { statusCode: 400 },
        );
      }
      if (order.status !== DisbursementStatus.APPROVED) {
        throw Object.assign(
          new Error(`Cannot disburse: disbursement order status is ${order.status}, expected APPROVED. Approve the order first.`),
          { statusCode: 400 },
        );
      }
      // Do NOT transition here — disburseOrder() handles state transition
      throw Object.assign(
        new Error('Direct state transition to DISBURSED is blocked. Use the disbursement order workflow (POST /disbursement/disburse) instead.'),
        { statusCode: 400 },
      );
    }

    // Build update data
    const updateData: Prisma.CreditApplicationUpdateInput = {
      state: transition.to,
    };

    // Set timestamp field if defined
    if (transition.timestampField) {
      (updateData as any)[transition.timestampField] = new Date();
    }

    // Set rejection/withdrawal reason based on action
    if (action === 'reject' || action === 'reject_kyc' || action === 'decline_offer') {
      updateData.rejectionReason = reason ?? null;
      (updateData as any).rejectionReasonCode = options?.rejectionReasonCode ?? null;
    }
    if (action === 'withdraw') {
      updateData.withdrawalReason = reason ?? null;
    }

    // §2.3 — Auto-increment version on every state transition
    (updateData as any).version = { increment: 1 };

    // §F25 — Race-safe state transition: use updateMany with state guard so that
    // if another process moved the application to a different state since our read,
    // the write is a no-op (count 0) and we throw a 409 conflict.
    const { count } = await prisma.creditApplication.updateMany({
      where: { id, state: existing.state },
      data: updateData as any,
    });

    if (count === 0) {
      throw new AppError('Application state changed since read. Please refresh and try again.', 409);
    }

    // Re-read the application after the guarded write for side effects
    const application = await prisma.creditApplication.findFirst({
      where: { id, deletedAt: null },
      include: {
        borrowerProfile: {
          select: {
            id: true,
            borrowerType: true,
            name: true,
            account: { select: { id: true, name: true } },
            contact: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        assignedRm: { select: { id: true, firstName: true, lastName: true } },
        assignedAnalyst: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Should never be null since updateMany count > 0, but satisfy TS
    if (!application) {
      throw new AppError('Application not found after transition', 500);
    }

    // Create audit event for state transition
    await this.createAuditEvent(id, actorId, action, existing.state, transition.to, {
      reason: reason ?? null,
      ...(acceptedOfferDocId ? { signedLooDocId: acceptedOfferDocId } : {}),
    });

    // §1.2 — On submit, derive connected-party flag from RelatedPartyGroup membership
    if (action === 'submit') {
      try {
        await deriveAndSetConnectedPartyFlag(id, actorId ?? undefined);
      } catch (err: any) {
        // Non-blocking: flag derivation failure must not prevent submission
        console.error(`[ConnectedParty] Failed to derive flag for ${id}: ${err.message}`);
      }
    }

    // Dispatch notification based on the action — failures must never block the transition
    try {
      const notificationEventType = this.resolveNotificationEventType(action);
      if (notificationEventType) {
        const borrowerName =
          application.borrowerProfile?.account?.name ||
          (application.borrowerProfile?.contact
            ? `${application.borrowerProfile.contact.firstName} ${application.borrowerProfile.contact.lastName}`
            : application.borrowerProfile?.name) || 'Unknown';

        await creditNotificationService.onApplicationEvent(
          id,
          notificationEventType,
          actorId ?? '',
          {
            applicationNo: application.applicationNo,
            borrowerName,
            applicationState: transition.to,
            ...(action === 'withdraw' && reason ? { withdrawnBy: actorId ?? undefined } : {}),
            ...(reason ? { rejectionReason: reason } : {}),
          },
        );

        // Sprint 4 — Dispatch webhook event to external subscribers
        const { webhookService } = await import('./webhook.service');
        await webhookService.dispatchEvent(notificationEventType, {
          eventType: notificationEventType,
          applicationId: id,
          applicationNo: application.applicationNo ?? undefined,
          borrowerName,
          state: transition.to as string,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      // Notification failures must never block the business flow
      console.error(`[CreditApplication] Notification dispatch failed for ${action} on ${id}:`, err);
    }

    // §F2 — Sync borrower exposure whenever a transition enters or leaves EXPOSURE_STATES
    // (APPROVED, OFFER, ACCEPTED, DISBURSED, ACTIVE). This keeps the denormalised
    // BorrowerProfile.totalExposure in lockstep with the canonical computation.
    const oldInExposure = (EXPOSURE_STATES as readonly string[]).includes(existing.state as string);
    const newInExposure = (EXPOSURE_STATES as readonly string[]).includes(transition.to as string);
    if (oldInExposure !== newInExposure) {
      try {
        await refreshBorrowerExposure(application.borrowerProfileId);
      } catch (err: any) {
        console.error(`[CreditApplication] Failed to refresh exposure for ${application.borrowerProfileId}: ${err.message}`);
      }
    }

    return application;
  }

  /**
   * Get the list of valid transitions for an application.
   */
  async getValidTransitionsForApplication(id: string) {
    const existing = await prisma.creditApplication.findFirst({
      where: { id, deletedAt: null },
      select: { state: true },
    });

    if (!existing) return null;

    const transitions = getValidTransitions(existing.state);
    return {
      currentState: existing.state,
      transitions: transitions.map((t) => ({
        action: t.action,
        label: ACTION_LABELS[t.action] || t.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        fromState: t.from,
        toState: t.to,
        requiresComment: t.reasonRequired ?? false,
        requiredPermission: TRANSITION_PERMISSIONS[t.action] || 'credit:approve',
      })),
    };
  }

  /**
   * Get the audit trail for an application.
   */
  async getAuditTrail(id: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      prisma.creditAuditEvent.findMany({
        where: { applicationId: id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.creditAuditEvent.count({ where: { applicationId: id } }),
    ]);

    return {
      events,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get the latest evidence mapping snapshot for an application.
   */
  async getEvidenceMapping(id: string) {
    const event = await prisma.creditAuditEvent.findFirst({
      where: { applicationId: id, eventType: 'EVIDENCE_MAPPING' },
      orderBy: { createdAt: 'desc' },
    });

    const updatedBy = event?.actorId
      ? await prisma.user.findUnique({
          where: { id: event.actorId },
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        })
      : null;

    return event
      ? {
          applicationId: id,
          sourceSummary: (event.metadata as any)?.sourceSummary ?? null,
          mappings: (event.metadata as any)?.mappings ?? [],
          updatedAt: event.createdAt.toISOString(),
          updatedBy,
        }
      : {
          applicationId: id,
          sourceSummary: null,
          mappings: [],
          updatedAt: null,
          updatedBy: null,
        };
  }

  /**
   * Persist a new evidence mapping snapshot as an audit-chain event.
   */
  async saveEvidenceMapping(id: string, actorId: string | undefined, data: EvidenceMappingInput) {
    const application = await prisma.creditApplication.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!application) {
      throw new AppError('Credit application not found', 404);
    }

    await AuditChainService.appendEvent(id, 'EVIDENCE_MAPPING', actorId ?? null, 'upsert_evidence_mapping', null, null, {
      sourceSummary: data.sourceSummary ?? null,
      mappings: data.mappings,
      version: 1,
    });

    return this.getEvidenceMapping(id);
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Map a transition action to a CreditEventType for notifications.
   * Returns undefined for actions that do not trigger notifications.
   */
  private resolveNotificationEventType(action: string): CreditEventType | undefined {
    switch (action) {
      case 'submit':
        return 'credit_application_submitted';
      case 'approve':
        return 'credit_application_approved';
      case 'reject':
      case 'reject_kyc':
      case 'decline_offer':
        return 'credit_application_rejected';
      case 'submit_to_committee':
        return 'credit_approval_requested';
      case 'withdraw':
        return 'credit_application_withdrawn';
      case 'place_compliance_hold':
        return 'credit_compliance_hold_placed';
      case 'clear_compliance_hold':
        return 'credit_compliance_hold_cleared';
      default:
        return undefined;
    }
  }

  /**
   * Create an audit event with hash-chain for tamper evidence.
   * Delegates to AuditChainService for consistent hash-chain creation.
   */
  private async createAuditEvent(
    applicationId: string,
    actorId: string | undefined,
    action: string,
    oldState: string | null,
    newState: string,
    metadata: Record<string, unknown>,
  ) {
    await AuditChainService.appendEvent(
      applicationId,
      'STATE_TRANSITION',
      actorId ?? null,
      action,
      oldState ?? undefined,
      newState,
      metadata,
    );
  }

  // -------------------------------------------------------------------------
  // Clone / Renew
  // -------------------------------------------------------------------------

  /**
   * Clone an application into a new DRAFT.
   * Works for APPROVED, ACTIVE, CLOSED, and REJECTED states (not just REJECTED).
   * Copies: borrowerProfileId, productType, currency, requestedAmount,
   * requestedTenor, purpose, parties, facilities.
   * Sets parentApplicationId to source.id, state to DRAFT,
   * assignedRmId to requestedById.
   * If asRenewal=true, appends "(Renewal)" to purpose.
   */
  async cloneApplication(
    applicationId: string,
    requestedById: string,
    options?: { asRenewal?: boolean },
  ): Promise<string> {
    const source = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      include: { parties: true, facilities: true },
    });
    if (!source) {
      throw new AppError('Source application not found', 404);
    }

    const CLONEABLE_STATES: ApplicationState[] = [
      ApplicationState.APPROVED,
      ApplicationState.ACTIVE,
      ApplicationState.CLOSED,
      ApplicationState.REJECTED,
    ];
    if (!CLONEABLE_STATES.includes(source.state)) {
      throw new AppError(
        `Cannot clone application in ${source.state} state. Only APPROVED, ACTIVE, CLOSED, or REJECTED applications can be cloned.`,
        400,
      );
    }

    // Check deleted
    if (source.deletedAt) {
      throw new AppError('Cannot clone a deleted application', 400);
    }

    const applicationNo = await generateApplicationNo();

    let purpose = source.purpose;
    if (options?.asRenewal) {
      purpose = purpose ? `${purpose} (Renewal)` : '(Renewal)';
    }

    const newApp = await prisma.creditApplication.create({
      data: {
        applicationNo,
        borrowerProfileId: source.borrowerProfileId,
        productType: source.productType,
        currency: source.currency,
        requestedAmount: source.requestedAmount,
        requestedTenor: source.requestedTenor,
        purpose,
        state: ApplicationState.DRAFT,
        assignedRmId: requestedById,
        parentApplicationId: source.id,
        // Copy parties
        parties: {
          create: source.parties.map((p) => ({
            role: p.role,
            borrowerProfileId: p.borrowerProfileId,
            liabilityPct: p.liabilityPct,
          })),
        },
        // Copy facilities
        facilities: {
          create: source.facilities.map((f) => ({
            facilityType: f.facilityType,
            amount: f.amount,
            tenorMonths: f.tenorMonths,
            ratePct: f.ratePct,
            purpose: f.purpose,
            existingLimit: f.existingLimit,
            proposedChange: f.proposedChange,
            newLimit: f.newLimit,
            outstandingBalance: f.outstandingBalance,
            undisbursedLimit: f.undisbursedLimit,
            approvingLevel: f.approvingLevel,
            pricingLabel: f.pricingLabel,
          })),
        },
      },
    });

    // Audit event
    await AuditChainService.appendEvent(
      newApp.id,
      'APPLICATION_CLONED',
      requestedById,
      options?.asRenewal ? 'clone_as_renewal' : 'clone',
      source.id,
      newApp.id,
      {
        parentApplicationId: source.id,
        fromState: source.state,
        asRenewal: options?.asRenewal ?? false,
      },
    );

    return newApp.id;
  }
}

export const creditApplicationService = new CreditApplicationService();