import { LeadStatus } from '@prisma/client';
import { AppError } from '../middleware/error.middleware';
import { applyOwnerScope } from './crm-scope.service';
import prisma from '../utils/prisma';

export const ACTIVE_LEAD_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED'];
const ACTIVE_STATUS_ORDER: Partial<Record<LeadStatus, number>> = { NEW: 0, CONTACTED: 1, QUALIFIED: 2 };
const ADVANCE_TARGET_STATUSES: LeadStatus[] = ['CONTACTED', 'QUALIFIED'];

export const isActiveLeadStatus = (status: LeadStatus) => ACTIVE_LEAD_STATUSES.includes(status);

type Actor = { id: string; email?: string | null };
type DbClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function findVisibleLead(tx: DbClient, leadId: string, visibleOwnerIds: string[] | null) {
  const lead = await tx.crmLead.findFirst({
    where: applyOwnerScope({ id: leadId, deletedAt: null }, visibleOwnerIds),
  });
  if (!lead) throw new AppError('Lead not found', 404);
  return lead;
}

function requiredReason(reason: string, label: string): string {
  const trimmed = reason.trim();
  if (!trimmed) throw new AppError(`${label} is required`, 400);
  return trimmed;
}

export async function advanceLeadStatus(leadId: string, targetStatus: LeadStatus, actor: Actor, visibleOwnerIds: string[] | null) {
  if (!ADVANCE_TARGET_STATUSES.includes(targetStatus)) {
    throw new AppError('Lead status can only advance to CONTACTED or QUALIFIED', 400);
  }
  return prisma.$transaction(async (tx) => {
    const lead = await findVisibleLead(tx, leadId, visibleOwnerIds);
    const currentOrder = ACTIVE_STATUS_ORDER[lead.status];
    const targetOrder = ACTIVE_STATUS_ORDER[targetStatus];
    if (currentOrder === undefined || targetOrder === undefined || targetOrder <= currentOrder) {
      throw new AppError('Lead status must advance forward through the active pipeline', 400);
    }
    const updated = await tx.crmLead.update({
      where: { id: lead.id },
      data: { status: targetStatus },
      include: { owner: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    await tx.auditLog.create({
      data: { userId: actor.id, userEmail: actor.email ?? undefined, action: 'ADVANCE_STATUS', resourceType: 'CrmLead', resourceId: lead.id,
        oldValues: { status: lead.status }, newValues: { status: targetStatus } },
    });
    return updated;
  });
}

export async function markLeadLost(leadId: string, reason: string, actor: Actor, visibleOwnerIds: string[] | null) {
  const lostReason = requiredReason(reason, 'Lost reason');
  return prisma.$transaction(async (tx) => {
    const lead = await findVisibleLead(tx, leadId, visibleOwnerIds);
    if (!isActiveLeadStatus(lead.status)) throw new AppError('Only active leads can be marked as lost', 400);
    const updated = await tx.crmLead.update({
      where: { id: lead.id },
      data: { status: 'LOST', lostAt: new Date(), lostReason },
      include: { owner: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    await tx.auditLog.create({
      data: { userId: actor.id, userEmail: actor.email ?? undefined, action: 'MARK_LOST', resourceType: 'CrmLead', resourceId: lead.id,
        oldValues: { status: lead.status }, newValues: { status: 'LOST', lostReason } },
    });
    return updated;
  });
}

export async function markLeadUnqualified(leadId: string, actor: Actor, visibleOwnerIds: string[] | null) {
  return prisma.$transaction(async (tx) => {
    const lead = await findVisibleLead(tx, leadId, visibleOwnerIds);
    if (!isActiveLeadStatus(lead.status)) throw new AppError('Only active leads can be marked as unqualified', 400);
    const updated = await tx.crmLead.update({
      where: { id: lead.id },
      data: { status: 'UNQUALIFIED' },
      include: { owner: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    await tx.auditLog.create({
      data: { userId: actor.id, userEmail: actor.email ?? undefined, action: 'MARK_UNQUALIFIED', resourceType: 'CrmLead', resourceId: lead.id,
        oldValues: { status: lead.status }, newValues: { status: 'UNQUALIFIED' } },
    });
    return updated;
  });
}

export async function reopenLead(leadId: string, reason: string, actor: Actor, visibleOwnerIds: string[] | null) {
  const reopenReason = requiredReason(reason, 'Reopen reason');
  return prisma.$transaction(async (tx) => {
    const lead = await findVisibleLead(tx, leadId, visibleOwnerIds);
    if (lead.status !== 'LOST' && lead.status !== 'UNQUALIFIED') {
      throw new AppError('Only lost or unqualified leads can be reopened', 400);
    }
    const updated = await tx.crmLead.update({
      where: { id: lead.id },
      data: lead.status === 'LOST'
        ? { status: 'NEW', lostAt: null, lostReason: null }
        : { status: 'NEW' },
      include: { owner: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    await tx.auditLog.create({
      data: { userId: actor.id, userEmail: actor.email ?? undefined, action: 'REOPEN', resourceType: 'CrmLead', resourceId: lead.id,
        oldValues: { status: lead.status, lostReason: lead.lostReason }, newValues: { status: 'NEW', reopenReason } },
    });
    return updated;
  });
}
