import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/error.middleware';
import prisma from '../utils/prisma';
import { applyOwnerScope } from './crm-scope.service';
import { validateStageTransition } from './crm-stage-gate.service';
import { generateWinLossDebrief } from './crm-ai.service';
import { logger } from '../utils/logger';

type Actor = { id: string; email: string };
type Transaction = Prisma.TransactionClient;

const stageInclude = {
  stage: true,
} as const;

function requiredReason(reason: string | undefined, label: string): string {
  const normalized = reason?.trim();
  if (!normalized) throw new AppError(`${label} is required`, 400);
  return normalized;
}

function stageGate(opportunity: Record<string, unknown>, from: any, to: any) {
  const result = validateStageTransition(opportunity, from, to);
  if (result.ok) return;
  const error: any = new Error(result.reason);
  error.gateFailed = true;
  error.needsApproval = !!result.needsApproval;
  throw error;
}

async function findOpportunity(tx: Transaction, id: string, visibleOwnerIds: string[] | null) {
  const opportunity = await tx.crmOpportunity.findFirst({
    where: applyOwnerScope({ id, deletedAt: null }, visibleOwnerIds),
    include: stageInclude,
  });
  if (!opportunity) throw new AppError('Opportunity not found', 404);
  return opportunity;
}

async function recordTransition(
  tx: Transaction,
  opportunity: Awaited<ReturnType<typeof findOpportunity>>,
  destination: { id: string; name: string; probability: number },
  actor: Actor,
  action: string,
  description: string,
  update: Prisma.CrmOpportunityUpdateInput,
  auditValues: Record<string, unknown>,
) {
  const updated = await tx.crmOpportunity.update({
    where: { id: opportunity.id },
    data: { ...update, stageId: destination.id, probability: destination.probability },
    include: {
      stage: true,
      account: { select: { id: true, name: true } },
      owner: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  await tx.crmActivity.create({
    data: {
      activityType: 'NOTE', subject: action === 'REOPEN' ? `Opportunity reopened to ${destination.name}` : action === 'MARK_LOST' ? 'Opportunity marked Closed Lost' : `Deal moved to ${destination.name}`,
      description, userId: actor.id, accountId: opportunity.accountId, opportunityId: opportunity.id, source: 'SYSTEM',
    },
  });
  await tx.crmOpportunityStageHistory.create({
    data: { opportunityId: opportunity.id, fromStageName: opportunity.stage.name, toStageName: destination.name, movedByUserId: actor.id },
  });
  await tx.auditLog.create({
    data: {
      userId: actor.id, userEmail: actor.email, action: action === 'MOVE_STAGE' ? 'UPDATE' : action,
      resourceType: 'CrmOpportunity', resourceId: opportunity.id,
      oldValues: { stageId: opportunity.stageId, stageName: opportunity.stage.name, lostReason: opportunity.lostReason },
      newValues: { stageId: destination.id, stageName: destination.name, ...auditValues },
    },
  });
  return updated;
}

function scheduleWinLossDebrief(opportunityId: string, userId: string) {
  setImmediate(() => {
    generateWinLossDebrief(opportunityId)
      .then(async (debrief) => {
        const content = `**AI Win/Loss Debrief**\n\n${debrief.summary}\n\n**Key Factors:**\n${debrief.keyFactors.map(f => `• ${f}`).join('\n')}\n\n**Lessons Learned:**\n${debrief.lessonsLearned.map(l => `• ${l}`).join('\n')}\n\n**Follow-On Actions:**\n${debrief.followOnActions.map(a => `• ${a}`).join('\n')}`;
        await prisma.crmNote.create({ data: { content, opportunityId, authorId: userId } });
      })
      .catch(error => logger.warn('[CRM] Win/loss debrief failed', { error }));
  });
}

/** Move an active opportunity exactly one configured display order forward. */
export async function moveOpportunityStage(opportunityId: string, stageId: string, actor: Actor, visibleOwnerIds: string[] | null) {
  const result = await prisma.$transaction(async (tx) => {
    const opportunity = await findOpportunity(tx, opportunityId, visibleOwnerIds);
    if (opportunity.stage.isWonStage) throw new AppError('Closed Won opportunities cannot be moved or reopened', 400);
    if (opportunity.stage.isLostStage) throw new AppError('Closed Lost opportunities must be reopened before moving stages', 400);

    const destination = await tx.crmPipelineStage.findUnique({ where: { id: stageId } });
    if (!destination) throw new AppError('Stage not found', 404);
    if (destination.pipelineId !== opportunity.pipelineId) throw new AppError('Stage must belong to the same pipeline', 400);
    if (destination.isLostStage) throw new AppError('Use Mark Closed Lost to close an opportunity as lost', 400);
    if (destination.displayOrder !== opportunity.stage.displayOrder + 1) {
      throw new AppError('Opportunities may only move to the immediately next stage', 400);
    }
    stageGate(opportunity as any, opportunity.stage, destination);
    const updated = await recordTransition(
      tx, opportunity, destination, actor, 'MOVE_STAGE',
      `Opportunity "${opportunity.name}" moved from "${opportunity.stage.name}" to "${destination.name}"`,
      { wonAt: destination.isWonStage ? new Date() : null, lostAt: null, lostReason: null },
      {},
    );
    return { updated, closed: destination.isWonStage };
  });
  if (result.closed) scheduleWinLossDebrief(opportunityId, actor.id);
  return result.updated;
}

/** Close any active opportunity against the configured lost stage, with a reason. */
export async function markOpportunityLost(opportunityId: string, reason: string | undefined, actor: Actor, visibleOwnerIds: string[] | null) {
  const lostReason = requiredReason(reason, 'Lost reason');
  const result = await prisma.$transaction(async (tx) => {
    const opportunity = await findOpportunity(tx, opportunityId, visibleOwnerIds);
    if (opportunity.stage.isWonStage) throw new AppError('Closed Won opportunities cannot be changed', 400);
    if (opportunity.stage.isLostStage) throw new AppError('Opportunity is already Closed Lost', 400);
    const destination = await tx.crmPipelineStage.findFirst({ where: { pipelineId: opportunity.pipelineId, isLostStage: true }, orderBy: { displayOrder: 'asc' } });
    if (!destination) throw new AppError('The selected pipeline has no Closed Lost stage', 400);
    // Closed Lost is the explicit exception to ordering; retain field and approval gates.
    stageGate(opportunity as any, opportunity.stage, { ...destination, enforceForwardOnly: false });
    const updated = await recordTransition(
      tx, opportunity, destination, actor, 'MARK_LOST',
      `Opportunity "${opportunity.name}" was marked Closed Lost. Reason: ${lostReason}`,
      { wonAt: null, lostAt: new Date(), lostReason }, { lostReason },
    );
    return updated;
  });
  scheduleWinLossDebrief(opportunityId, actor.id);
  return result;
}

/** Reopen a Closed Lost opportunity into the first active stage of its current pipeline. */
export async function reopenOpportunity(opportunityId: string, reason: string | undefined, actor: Actor, visibleOwnerIds: string[] | null) {
  const reopenReason = requiredReason(reason, 'Reopen reason');
  return prisma.$transaction(async (tx) => {
    const opportunity = await findOpportunity(tx, opportunityId, visibleOwnerIds);
    if (opportunity.stage.isWonStage) throw new AppError('Closed Won opportunities cannot be moved or reopened', 400);
    if (!opportunity.stage.isLostStage) throw new AppError('Only Closed Lost opportunities can be reopened', 400);
    const destination = await tx.crmPipelineStage.findFirst({
      where: { pipelineId: opportunity.pipelineId, isWonStage: false, isLostStage: false }, orderBy: { displayOrder: 'asc' },
    });
    if (!destination) throw new AppError('The selected pipeline has no active stage to reopen into', 400);
    return recordTransition(
      tx, opportunity, destination, actor, 'REOPEN',
      `Opportunity "${opportunity.name}" was reopened to "${destination.name}". Reason: ${reopenReason}`,
      { wonAt: null, lostAt: null, lostReason: null }, { reopenReason },
    );
  });
}
