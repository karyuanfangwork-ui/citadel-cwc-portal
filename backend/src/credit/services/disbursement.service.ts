import prisma from '../../utils/prisma';
import { DisbursementStatus, ApplicationState } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { AuditChainService } from './auditChain.service';
import { notifyMultiple } from '../../services/notification.service';
import { logger } from '../../utils/logger';
import { assertRecordOnlyAllowed } from '../adapters/registry';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CreateDisbursementDto {
  totalAmount: number;
  currency?: string;
  disbursementMethod?: string;
  beneficiaryBank?: string;
  beneficiaryAccount?: string;
  referenceNote?: string;
}

export interface ReadinessCheck {
  pass: boolean;
  reason: string;
}

export interface ReadinessResult {
  ready: boolean;
  checks: ReadinessCheck[];
}

// ── Order Number Generator ──────────────────────────────────────────────────

async function generateOrderNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DO-${year}-`;
  const last = await prisma.disbursementOrder.findFirst({
    where: { orderNo: { startsWith: prefix } },
    orderBy: { orderNo: 'desc' },
    select: { orderNo: true },
  });
  const next = last ? parseInt(last.orderNo.replace(prefix, ''), 10) + 1 : 1;
  return `${prefix}${String(next).padStart(5, '0')}`;
}

// ── Disbursement Readiness Gate ─────────────────────────────────────────────

export async function checkDisbursementReadiness(applicationId: string): Promise<ReadinessResult> {
  const checks: ReadinessCheck[] = [];

  // 1. Application must be in ACCEPTED state
  const app = await prisma.creditApplication.findUnique({
    where: { id: applicationId },
    select: { state: true },
  });
  if (app?.state !== ApplicationState.ACCEPTED) {
    checks.push({
      pass: false,
      reason: 'Application must be in ACCEPTED state before disbursement.',
    });
  }

  // 2. All conditions precedent must be FULFILLED or WAIVED
  const openPrecedents = await prisma.condition.count({
    where: { applicationId, conditionType: 'PRECEDENT', status: 'PENDING' },
  });
  if (openPrecedents > 0) {
    checks.push({
      pass: false,
      reason: `${openPrecedents} condition(s) precedent still pending.`,
    });
  }
  // Also check conditions that are open (not fulfilled / not waived) for PRECEDENT type
  const unfulfilledPrecedents = await prisma.condition.count({
    where: {
      applicationId,
      conditionType: 'PRECEDENT',
      isFulfilled: false,
      waivedById: null,
    },
  });
  if (unfulfilledPrecedents > 0 && openPrecedents === 0) {
    // They may have status PENDING but we want to double check isFulfilled / waived
    checks.push({
      pass: false,
      reason: `${unfulfilledPrecedents} condition(s) precedent not yet fulfilled or waived.`,
    });
  }

  // 3. At least one approved CreditDecision must exist
  const decision = await prisma.creditDecision.findFirst({
    where: { applicationId, decisionType: 'APPROVE' },
  });
  if (!decision) {
    checks.push({
      pass: false,
      reason: 'No approval decision on record.',
    });
  }

  // 4. Letter of Offer must be verified
  const offerDoc = await prisma.creditDocument.findFirst({
    where: { applicationId, classification: 'LETTER_OF_OFFER', verificationStatus: 'VERIFIED', deletedAt: null },
  });
  if (!offerDoc) {
    checks.push({
      pass: false,
      reason: 'Signed Letter of Offer must be uploaded and verified.',
    });
  }

  return { ready: checks.every(c => c.pass), checks };
}

// ── Create Disbursement Order ───────────────────────────────────────────────

export async function createOrder(
  applicationId: string,
  requestedById: string,
  dto: CreateDisbursementDto,
) {
  // LOS-021: fail closed if live lending is on but CBS is still a placeholder
  assertRecordOnlyAllowed('cbs');

  // Run readiness gate
  const readiness = await checkDisbursementReadiness(applicationId);
  if (!readiness.ready) {
    const reasons = readiness.checks.filter(c => !c.pass).map(c => c.reason).join(' ');
    throw new AppError(`Cannot create disbursement order: ${reasons}`, 400);
  }

  // Validate totalAmount does not exceed sum of approved facility amounts (F22)
  const facilities = await prisma.applicationFacility.findMany({
    where: { applicationId, deletedAt: null },
    select: { approvedAmount: true, amount: true },
  });
  const approvedTotal = facilities.reduce(
    (sum, f) => sum + Number(f.approvedAmount ?? f.amount),
    0,
  );
  if (dto.totalAmount > approvedTotal) {
    throw new AppError(
      `Disbursement amount (${dto.totalAmount}) exceeds the total approved facility amount (${approvedTotal}).`,
      400,
    );
  }

  // Check no existing PENDING/APPROVED order
  const existing = await prisma.disbursementOrder.findUnique({
    where: { applicationId },
  });
  if (existing && existing.status !== 'CANCELLED') {
    throw new AppError(
      `Disbursement order already exists for this application (status: ${existing.status}). Cancel it first to create a new one.`,
      409,
    );
  }

  const orderNo = await generateOrderNo();

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.disbursementOrder.create({
      data: {
        applicationId,
        orderNo,
        requestedById,
        totalAmount: dto.totalAmount,
        currency: dto.currency ?? 'MYR',
        disbursementMethod: dto.disbursementMethod ?? null,
        beneficiaryBank: dto.beneficiaryBank ?? null,
        beneficiaryAccount: dto.beneficiaryAccount ?? null,
        referenceNote: dto.referenceNote ?? null,
      },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        disbursedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Audit event
    await AuditChainService.appendEvent(
      applicationId,
      'DISBURSEMENT_ORDER_CREATED',
      requestedById,
      'create_disbursement_order',
      undefined,
      undefined,
      { orderNo: created.orderNo, totalAmount: String(dto.totalAmount) },
      tx as any,
    );

    return created;
  });

  // Notify RM + ops
  await notifyDisbursementEvent(applicationId, 'disbursement_requested', requestedById, {
    orderNo: order.orderNo,
    totalAmount: String(dto.totalAmount),
  });

  return order;
}

// ── Approve Disbursement Order ──────────────────────────────────────────────

export async function approveOrder(
  orderId: string,
  approvedById: string,
) {
  const order = await prisma.disbursementOrder.findUnique({
    where: { id: orderId },
    include: {
      requestedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!order) {
    throw new AppError('Disbursement order not found.', 404);
  }

  if (order.status !== DisbursementStatus.PENDING) {
    throw new AppError(`Cannot approve: order status is ${order.status}, expected PENDING.`, 400);
  }

  // Maker-checker: approver cannot be the same as requestor
  if (order.requestedById === approvedById) {
    throw new AppError(
      'Disbursement approval requires a different officer from the one who created the order.',
      400,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.disbursementOrder.update({
      where: { id: orderId },
      data: {
        approvedById,
        approvedAt: new Date(),
        status: DisbursementStatus.APPROVED,
      },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        disbursedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Audit event
    await AuditChainService.appendEvent(
      order.applicationId,
      'DISBURSEMENT_ORDER_APPROVED',
      approvedById,
      'approve_disbursement_order',
      'PENDING',
      'APPROVED',
      { orderNo: order.orderNo },
      tx as any,
    );

    return result;
  });

  // Notify
  await notifyDisbursementEvent(order.applicationId, 'disbursement_approved', approvedById, {
    orderNo: order.orderNo,
  });

  return updated;
}

// ── Confirm Disbursement ────────────────────────────────────────────────────

export async function disburseOrder(
  orderId: string,
  disbursedById: string,
) {
  const order = await prisma.disbursementOrder.findUnique({
    where: { id: orderId },
    include: {
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!order) {
    throw new AppError('Disbursement order not found.', 404);
  }

  if (order.status !== DisbursementStatus.APPROVED) {
    throw new AppError(`Cannot disburse: order status is ${order.status}, expected APPROVED.`, 400);
  }

  // Three-role segregation: disburser cannot be the approver
  if (order.approvedById === disbursedById) {
    throw new AppError(
      'Disbursement must be confirmed by a different officer from the one who approved the order.',
      400,
    );
  }

  // Also check disburser is not the requestor
  if (order.requestedById === disbursedById) {
    throw new AppError(
      'Disbursement must be confirmed by a different officer from the one who created the order.',
      400,
    );
  }

  // Sprint 2 — CP Fulfilment gate: block disbursement if any PRECEDENT conditions
  // are unfulfilled and not formally waived.
  const precedentConditions = await prisma.condition.findMany({
    where: { applicationId: order.applicationId, conditionType: 'PRECEDENT' },
    select: { id: true, title: true, isFulfilled: true, status: true, waivedAt: true },
  });
  const blockingCps = precedentConditions.filter(
    (c) => !c.isFulfilled && c.status !== 'WAIVED' && !c.waivedAt,
  );
  if (blockingCps.length > 0) {
    const details = blockingCps.map((c) => c.title).join(', ');
    throw new AppError(
      `Cannot disburse — ${blockingCps.length} precedent condition(s) unfulfilled and not waived: ${details}. Fulfil or formally waive all precedent conditions before disbursement.`,
      400,
    );
  }

  // Use transaction: update order + transition application state + audit event
  const updated = await prisma.$transaction(async (tx) => {
    const disbursement = await tx.disbursementOrder.update({
      where: { id: orderId },
      data: {
        disbursedById,
        disbursedAt: new Date(),
        status: DisbursementStatus.DISBURSED,
      },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        disbursedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Transition application to DISBURSED
    await tx.creditApplication.update({
      where: { id: order.applicationId },
      data: { state: ApplicationState.DISBURSED },
    });

    // Audit event
    await AuditChainService.appendEvent(
      order.applicationId,
      'DISBURSEMENT_COMPLETED',
      disbursedById,
      'confirm_disbursement',
      'APPROVED',
      'DISBURSED',
      { orderNo: order.orderNo, totalAmount: order.totalAmount.toString() },
      tx as any,
    );

    return disbursement;
  });

  // Notify
  await notifyDisbursementEvent(order.applicationId, 'disbursement_completed', disbursedById, {
    orderNo: order.orderNo,
    totalAmount: order.totalAmount.toString(),
  });

  return updated;
}

// ── Cancel Disbursement Order ───────────────────────────────────────────────

export async function cancelOrder(
  orderId: string,
  cancelledById: string,
  reason: string,
) {
  const order = await prisma.disbursementOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new AppError('Disbursement order not found.', 404);
  }

  if (order.status === DisbursementStatus.DISBURSED) {
    throw new AppError('Cannot cancel a disbursement order that has already been disbursed.', 400);
  }
  if (order.status === DisbursementStatus.CANCELLED) {
    throw new AppError('Order is already cancelled.', 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.disbursementOrder.update({
      where: { id: orderId },
      data: {
        cancelledById,
        cancelledAt: new Date(),
        cancellationReason: reason,
        status: DisbursementStatus.CANCELLED,
      },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        disbursedBy: { select: { id: true, firstName: true, lastName: true } },
        cancelledBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Audit event
    await AuditChainService.appendEvent(
      order.applicationId,
      'DISBURSEMENT_ORDER_CANCELLED',
      cancelledById,
      'cancel_disbursement_order',
      order.status,
      'CANCELLED',
      { orderNo: order.orderNo, cancellationReason: reason },
      tx as any,
    );

    return result;
  });

  return updated;
}

// ── Get Order ───────────────────────────────────────────────────────────────

export async function getOrder(applicationId: string) {
  return prisma.disbursementOrder.findUnique({
    where: { applicationId },
    include: {
      requestedBy: { select: { id: true, firstName: true, lastName: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
      disbursedBy: { select: { id: true, firstName: true, lastName: true } },
      cancelledBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

// ── Notification Helper ─────────────────────────────────────────────────────

async function notifyDisbursementEvent(
  applicationId: string,
  eventType: string,
  actorId: string,
  details: Record<string, string>,
) {
  try {
    const app = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      select: {
        applicationNo: true,
        assignedRmId: true,
        assignedAnalystId: true,
        borrowerProfile: { select: { name: true } },
      },
    });

    if (!app) return;

    const targetIds: string[] = [];
    if (app.assignedRmId && app.assignedRmId !== actorId) targetIds.push(app.assignedRmId);
    if (app.assignedAnalystId && app.assignedAnalystId !== actorId) targetIds.push(app.assignedAnalystId);

    if (targetIds.length === 0) return;

    await notifyMultiple(targetIds, eventType, {
      applicationId,
      applicationNo: app.applicationNo,
      borrowerName: app.borrowerProfile?.name ?? 'Unknown',
      ...details,
    });

    logger.info(`[Disbursement] ${eventType} notified ${targetIds.length} user(s) for app ${applicationId}`);
  } catch (err) {
    // Never block business flow on notification failure
    logger.error(`[Disbursement] Notification failed for ${eventType} on ${applicationId}`, { error: String(err) });
  }
}