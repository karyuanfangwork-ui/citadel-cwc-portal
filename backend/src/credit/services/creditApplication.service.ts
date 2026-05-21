import prisma from '../../utils/prisma';
import { Prisma, ApplicationState } from '@prisma/client';
import { AuditChainService } from './auditChain.service';

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
}

export interface UpdateCreditApplicationData extends CaMemoHeaderFields {
  productType?: string;
  purpose?: string | null;
  requestedAmount?: string | number;
  requestedTenor?: number | null;
  currency?: string;
  assignedRmId?: string | null;
  assignedAnalystId?: string | null;
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
  // Active → Closed
  { from: ApplicationState.ACTIVE, to: ApplicationState.CLOSED, action: 'close', timestampField: 'closedAt' },
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
    if (search) {
      where.OR = [
        { applicationNo: { contains: search, mode: 'insensitive' } },
        { purpose: { contains: search, mode: 'insensitive' } },
      ];
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
    return prisma.creditApplication.findFirst({
      where: { id, deletedAt: null },
      include: {
        borrowerProfile: {
          select: {
            id: true,
            borrowerType: true,
            account: { select: { id: true, name: true } },
            contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        assignedRm: { select: { id: true, firstName: true, lastName: true } },
        assignedAnalyst: { select: { id: true, firstName: true, lastName: true } },
        facilities: true,
        parties: { include: { borrowerProfile: { select: { id: true, borrowerType: true } } } },
        documents: { where: { deletedAt: null } },
      },
    });
  }

  /**
   * Create a new credit application.
   */
  async createApplication(data: CreateCreditApplicationData, actorId?: string) {
    const applicationNo = await generateApplicationNo();

    const createData: Prisma.CreditApplicationCreateInput = {
      applicationNo,
      state: ApplicationState.DRAFT,
      borrowerProfile: { connect: { id: data.borrowerProfileId } },
      productType: data.productType as any,
      purpose: data.purpose ?? undefined,
      requestedAmount: new Prisma.Decimal(data.requestedAmount),
      requestedTenor: data.requestedTenor ?? undefined,
      currency: (data.currency as any) ?? 'MYR',
      ...(data.assignedRmId && { assignedRm: { connect: { id: data.assignedRmId } } }),
      ...(data.assignedAnalystId && { assignedAnalyst: { connect: { id: data.assignedAnalystId } } }),
    };
    applyCaMemoFields(createData as Record<string, unknown>, data);

    const application = await prisma.creditApplication.create({
      data: createData,
      include: {
        borrowerProfile: { select: { id: true, borrowerType: true } },
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
  async updateApplication(id: string, data: UpdateCreditApplicationData, actorId?: string) {
    const existing = await prisma.creditApplication.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) return null;

    // Only allow updates in DRAFT state
    if (existing.state !== ApplicationState.DRAFT) {
      throw new Error('Application can only be edited in DRAFT state');
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
    applyCaMemoFields(updateData as Record<string, unknown>, data);

    const application = await prisma.creditApplication.update({
      where: { id },
      data: updateData,
      include: {
        borrowerProfile: { select: { id: true, borrowerType: true } },
        assignedRm: { select: { id: true, firstName: true, lastName: true } },
        assignedAnalyst: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Create audit event for update
    await this.createAuditEvent(id, actorId, 'update', existing.state, existing.state, {
      updatedFields: Object.keys(data),
    });

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
    }
    if (action === 'withdraw') {
      updateData.withdrawalReason = reason ?? null;
    }

    const application = await prisma.creditApplication.update({
      where: { id },
      data: updateData,
      include: {
        borrowerProfile: { select: { id: true, borrowerType: true } },
        assignedRm: { select: { id: true, firstName: true, lastName: true } },
        assignedAnalyst: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Create audit event for state transition
    await this.createAuditEvent(id, actorId, action, existing.state, transition.to, {
      reason: reason ?? null,
    });

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