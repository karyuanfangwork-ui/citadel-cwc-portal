import prisma from '../../utils/prisma';
import { Prisma, ApplicationState, ApprovalDecisionType, SignoffRole } from '@prisma/client';
import { AuditChainService } from './auditChain.service';
import { creditNotificationService, CreditEventType } from './creditNotification.service';
import { deriveAndSetConnectedPartyFlag } from './connectedParty.service';
import { validateSubmissionReadiness } from './submissionReadiness.service';
import { approvalMatrixService } from './approvalMatrix.service';
import { formatCurrency } from '../utils/formatCurrency';

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
  productType?: string;
  borrowerProfileId?: string;
  assignedRmId?: string;
  assignedAnalystId?: string;
  search?: string;
  /** §3.1 — Multi-branch support: scope list to a given branch */
  branchId?: string;
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
//   KYC_REVIEW ──approve_kyc──► KYC_APPROVED
//   KYC_REVIEW ──reject_kyc──► KYC_REJECTED
//   KYC_APPROVED ──start_underwriting──► UNDERWRITING
//   KYC_REJECTED ──resubmit──► SUBMITTED
//   UNDERWRITING ──start_assessment──► CREDIT_ASSESSMENT
//   CREDIT_ASSESSMENT ──submit_to_committee──► COMMITTEE_REVIEW
//   COMMITTEE_REVIEW ──approve──► APPROVED
//   COMMITTEE_REVIEW ──reject──► REJECTED
//   APPROVED ──make_offer──► OFFER
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
  // KYC Review → KYC Approved
  { from: ApplicationState.KYC_REVIEW, to: ApplicationState.KYC_APPROVED, action: 'approve_kyc' },
  // KYC Review → KYC Rejected
  { from: ApplicationState.KYC_REVIEW, to: ApplicationState.KYC_REJECTED, action: 'reject_kyc', reasonRequired: true },
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
  // Approved → Offer
  { from: ApplicationState.APPROVED, to: ApplicationState.OFFER, action: 'make_offer' },
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
  { from: ApplicationState.KYC_APPROVED, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
  { from: ApplicationState.KYC_REJECTED, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
  { from: ApplicationState.UNDERWRITING, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
  { from: ApplicationState.CREDIT_ASSESSMENT, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
  { from: ApplicationState.COMMITTEE_REVIEW, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
  { from: ApplicationState.APPROVED, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
  { from: ApplicationState.OFFER, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
  { from: ApplicationState.ACCEPTED, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true, timestampField: 'closedAt' },
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
  approve_kyc: 'credit:write',
  reject_kyc: 'credit:approve',
  resubmit: 'credit:write',
  start_underwriting: 'credit:write',
  start_assessment: 'credit:write',
  submit_to_committee: 'credit:write',
  approve: 'credit:approve',
  reject: 'credit:approve',
  make_offer: 'credit:approve',
  accept_offer: 'credit:write',
  decline_offer: 'credit:approve',
  disburse: 'credit:admin',
  activate: 'credit:admin',
  close: 'credit:admin',
  withdraw: 'credit:write',
};

/** Human-readable labels for transition actions */
const ACTION_LABELS: Record<string, string> = {
  submit: 'Submit Application',
  withdraw: 'Withdraw',
  start_kyc: 'Start KYC Review',
  approve_kyc: 'Approve KYC',
  reject_kyc: 'Reject KYC',
  resubmit: 'Resubmit',
  start_underwriting: 'Start Underwriting',
  start_assessment: 'Start Credit Assessment',
  submit_to_committee: 'Submit to Committee',
  approve: 'Approve',
  reject: 'Reject',
  make_offer: 'Make Offer',
  accept_offer: 'Accept Offer',
  decline_offer: 'Decline Offer',
  disburse: 'Disburse',
  activate: 'Activate',
  close: 'Close',
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
      productType,
      borrowerProfileId,
      assignedRmId,
      assignedAnalystId,
      search,
      branchId,
      rmScopeFilter,
    } = options;

    const skip = (page - 1) * limit;

    const where: Prisma.CreditApplicationWhereInput = {
      deletedAt: null,
    };

    if (state) {
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

    const [applications, total] = await Promise.all([
      prisma.creditApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
      }),
      prisma.creditApplication.count({ where }),
    ]);

    return {
      applications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
            account: { select: { id: true, name: true } },
            contact: { select: { id: true, firstName: true, lastName: true, email: true, nricPassport: true } },
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
        scoreRuns: { orderBy: { createdAt: 'desc' as const }, take: 1 },
        bureauChecks: true,
      },
    }) as any;

    if (!app) return null;

    // Flatten latest risk rating from score run onto the application object
    // so the frontend can check `app.riskRating` for section S4 completion
    const latestScoreRun = app.scoreRuns?.[0];
    app.riskRating = latestScoreRun?.riskRating ?? null;

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
        borrowerProfile: { select: { id: true, borrowerType: true, name: true, account: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true } } } },
        assignedRm: { select: { id: true, firstName: true, lastName: true } },
        assignedAnalyst: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Create initial audit event
    await this.createAuditEvent(application.id, actorId, 'create', null, ApplicationState.DRAFT, {
      applicationNo,
    });

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

    // §2.3 — Optimistic concurrency check
    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
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
        borrowerProfile: { select: { id: true, borrowerType: true, name: true, account: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true } } } },
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

    // §1.7 — Submission-readiness hard gate: block submit if validation fails
    if (action === 'submit') {
      const readiness = await validateSubmissionReadiness(id);
      if (!readiness.ready) {
        const errorMessages = readiness.errors.map((e) => `${e.field}: ${e.message}`).join('; ');
        throw new Error(`Submission blocked — ${errorMessages}`);
      }
    }

    // §1.1b — Sign-off completion gate: block submit_to_committee if CA Memo sign-off incomplete
    if (action === 'submit_to_committee') {
      const signoffs = await prisma.applicationSignoff.findMany({
        where: { applicationId: id },
        select: { role: true, signedAt: true },
      });
      const signed = new Set(signoffs.filter(s => s.signedAt).map(s => s.role));
      const required: SignoffRole[] = ['PREPARED_BY', 'REVIEWED_BY', 'CONCURRED_BY'] as const;
      if (!required.every(r => signed.has(r))) {
        throw Object.assign(
          new Error(
            'Cannot submit to committee — CA Memo sign-off incomplete. All sign-off roles (Prepared By, Reviewed By, Concurred By) must sign before committee review.',
          ),
          { statusCode: 400 },
        );
      }

      // §1.1 — Bureau checklist enforcement: block submit_to_committee if checklist
      // incomplete or not verified by a second officer.
      const { isBureauChecklistComplete, isBureauChecklistVerified } = await import('./bureauCheck.service');
      const checklistComplete = await isBureauChecklistComplete(id);
      if (!checklistComplete) {
        throw Object.assign(
          new Error(
            'Cannot submit to committee — Bureau checklist incomplete. CCRIS, CTOS and AML screening must be completed before committee submission.',
          ),
          { statusCode: 400 },
        );
      }
      const checklistVerified = await isBureauChecklistVerified(id);
      if (!checklistVerified) {
        throw Object.assign(
          new Error(
            'Cannot submit to committee — Bureau checklist must be verified by a second officer before committee submission.',
          ),
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
          borrowerProfile: { select: { creditRiskRating: true, totalExposure: true } },
        },
      });

      if (appWithBorrower) {
        const borrowerRating = appWithBorrower.borrowerProfile?.creditRiskRating ?? 'NR';
        const totalExposure = formatCurrency(
          appWithBorrower.borrowerProfile?.totalExposure ?? appWithBorrower.requestedAmount,
        ) ?? 0;

        const authorityResult = await approvalMatrixService.lookupApprovalAuthority(
          totalExposure,
          borrowerRating ?? 'NR',
          appWithBorrower.branchId,
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

    const application = await prisma.creditApplication.update({
      where: { id },
      data: updateData,
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
      }
    } catch (err) {
      // Notification failures must never block the business flow
      console.error(`[CreditApplication] Notification dispatch failed for ${action} on ${id}:`, err);
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
}

export const creditApplicationService = new CreditApplicationService();