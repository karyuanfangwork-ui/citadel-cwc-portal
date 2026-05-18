import prisma from '../../utils/prisma';
import { Prisma, ApplicationState } from '@prisma/client';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateCreditApplicationData {
  borrowerProfileId: string;
  productType: string;
  purpose?: string | null;
  requestedAmount: string | number;
  requestedTenor?: number | null;
  currency?: string;
  assignedRmId?: string | null;
  assignedAnalystId?: string | null;
}

export interface UpdateCreditApplicationData {
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
 * Uses a database sequence-like pattern via a Prisma transaction.
 */
async function generateApplicationNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CA-${year}-`;

  // Find the highest existing number with this prefix
  const lastApp = await prisma.creditApplication.findFirst({
    where: { applicationNo: { startsWith: prefix } },
    orderBy: { applicationNo: 'desc' },
    select: { applicationNo: true },
  });

  let seq = 1;
  if (lastApp) {
    const numPart = lastApp.applicationNo.replace(prefix, '');
    seq = parseInt(numPart, 10) + 1;
  }

  return `${prefix}${String(seq).padStart(5, '0')}`;
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
        to: t.to,
        reasonRequired: t.reasonRequired ?? false,
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
   */
  private async createAuditEvent(
    applicationId: string,
    actorId: string | undefined,
    action: string,
    oldState: string | null,
    newState: string,
    metadata: Record<string, unknown>,
  ) {
    // Get the last event for this application to compute hash chain
    const lastEvent = await prisma.creditAuditEvent.findFirst({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      select: { hash: true },
    });

    const payload = JSON.stringify({
      applicationId,
      actorId,
      action,
      oldState,
      newState,
      metadata,
      previousHash: lastEvent?.hash ?? null,
      timestamp: new Date().toISOString(),
    });

    const hash = createHash('sha256').update(payload).digest('hex');

    await prisma.creditAuditEvent.create({
      data: {
        applicationId,
        actorId: actorId ?? null,
        eventType: 'STATE_TRANSITION',
        action,
        oldState: oldState ?? null,
        newState,
        metadata: metadata as any,
        hash,
      },
    });
  }
}

export const creditApplicationService = new CreditApplicationService();