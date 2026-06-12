import { PrismaClient, Prisma } from '@prisma/client';
import { generateWinLossDebrief } from './crm-ai.service';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error.middleware';
import { applyOwnerScope } from './crm-scope.service';

const prisma = new PrismaClient();

// ============================================================================
// DASHBOARD STATISTICS
// ============================================================================

export async function getDashboardStats(userId?: string) {
  const ownerFilter = userId ? { ownerId: userId } : {};
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const [
    totalAccounts,
    totalContacts,
    totalLeads,
    totalOpportunities,
    pipelineValue,
    wonDeals,
    lostDeals,
    recentActivities,
    leadsByStatus,
    opportunitiesByStage,
    followUpDueToday,
    staleLeads,
    overdueDeals,
  ] = await Promise.all([
    prisma.crmAccount.count({ where: { isActive: true, deletedAt: null, ...ownerFilter } }),
    prisma.crmContact.count({ where: { isActive: true, deletedAt: null } }),
    prisma.crmLead.count({ where: { status: { notIn: ['CONVERTED', 'LOST'] }, deletedAt: null, ...ownerFilter } }),
    prisma.crmOpportunity.count({ where: { deletedAt: null, ...ownerFilter } }),
    prisma.crmOpportunity.aggregate({
      _sum: { value: true },
      where: {
        stage: { isWonStage: false, isLostStage: false },
        deletedAt: null,
        ...ownerFilter,
      },
    }),
    prisma.crmOpportunity.aggregate({
      _sum: { value: true },
      _count: true,
      where: { stage: { isWonStage: true }, deletedAt: null, ...ownerFilter },
    }),
    prisma.crmOpportunity.aggregate({
      _sum: { value: true },
      _count: true,
      where: { stage: { isLostStage: true }, deletedAt: null, ...ownerFilter },
    }),
    prisma.crmActivity.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      where: userId ? { userId } : {},
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        opportunity: { select: { id: true, name: true } },
      },
    }),
    prisma.crmLead.groupBy({
      by: ['status'],
      _count: true,
      where: { deletedAt: null, ...ownerFilter },
    }),
    prisma.crmOpportunity.groupBy({
      by: ['stageId'],
      _count: true,
      _sum: { value: true },
      where: { deletedAt: null, ...ownerFilter },
    }),
    // Follow-ups due today
    prisma.crmLead.count({
      where: {
        followUpDate: { gte: todayStart, lt: todayEnd },
        status: { notIn: ['CONVERTED', 'LOST'] },
        deletedAt: null,
        ...ownerFilter,
      },
    }),
    // Stale leads (no activity in 7 days)
    prisma.crmLead.count({
      where: {
        status: { notIn: ['CONVERTED', 'LOST'] },
        deletedAt: null,
        ...ownerFilter,
        activities: { none: { createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } } },
      },
    }),
    // Overdue deals (past expected close date, not won/lost)
    prisma.crmOpportunity.count({
      where: {
        expectedCloseDate: { lt: now },
        wonAt: null,
        lostAt: null,
        deletedAt: null,
        ...ownerFilter,
      },
    }),
  ]);

  return {
    totalAccounts,
    totalContacts,
    totalLeads,
    totalOpportunities,
    pipelineValue: pipelineValue._sum.value || 0,
    wonDeals: { count: wonDeals._count, value: wonDeals._sum.value || 0 },
    lostDeals: { count: lostDeals._count, value: lostDeals._sum.value || 0 },
    winRate: wonDeals._count + lostDeals._count > 0
      ? Math.round((wonDeals._count / (wonDeals._count + lostDeals._count)) * 100)
      : 0,
    recentActivities,
    leadsByStatus,
    opportunitiesByStage,
    // Phase 2: Priority stats
    followUpDueToday,
    staleLeads,
    overdueDeals,
  };
}

// ============================================================================
// LEAD CONVERSION
// ============================================================================

export async function convertLead(
  leadId: string,
  data: {
    opportunityName: string;
    pipelineId: string;
    stageId: string;
    value?: number;
    expectedCloseDate?: string;
    createAccount?: boolean;
    accountName?: string;
  },
  userId: string,
  visibleOwnerIds: string[] | null = [userId]
) {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.crmLead.findFirst({
      where: applyOwnerScope({ id: leadId, deletedAt: null }, visibleOwnerIds),
      include: { account: true, contact: true },
    });
    if (!lead) throw new AppError('Lead not found', 404);

    if (lead.status === 'CONVERTED') {
      throw new Error('Lead is already converted');
    }

    // Create account if needed
    let accountId = lead.accountId;
    // Auto-create account when lead has none
    if (!accountId) {
      data.createAccount = true;
    }
    if (data.createAccount && !accountId) {
      const newAccount = await tx.crmAccount.create({
        data: {
          name: data.accountName || lead.companyName || lead.title,
          email: lead.contactEmail || undefined,
          phone: lead.contactPhone || undefined,
          ownerId: userId,
        },
      });
      accountId = newAccount.id;

      // Create contact from lead info if we have a name
      if (lead.contactName) {
        const nameParts = lead.contactName.split(' ');
        const newContact = await tx.crmContact.create({
          data: {
            accountId: newAccount.id,
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            email: lead.contactEmail || undefined,
            phone: lead.contactPhone || undefined,
            isPrimary: true,
          },
        });
        lead.contactId = newContact.id;
      }
    }

    if (!accountId) {
      throw new Error('Lead must have an account or createAccount must be true');
    }

    // Look up the stage to inherit its default probability
    const stage = await tx.crmPipelineStage.findUniqueOrThrow({
      where: { id: data.stageId },
    });

    // Determine contactId: prefer existing, then newly created during conversion
    const contactId = lead.contactId || lead.contact?.id || null;

    // Create the opportunity
    const opportunity = await tx.crmOpportunity.create({
      data: {
        name: data.opportunityName,
        accountId,
        contactId,
        pipelineId: data.pipelineId,
        stageId: data.stageId,
        ownerId: userId,
        value: data.value || lead.estimatedValue || 0,
        probability: stage.probability,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
        description: lead.description,
      },
    });

    // Mark lead as converted
    await tx.crmLead.update({
      where: { id: leadId },
      data: {
        status: 'CONVERTED',
        convertedAt: new Date(),
        convertedToOppId: opportunity.id,
      },
    });

    // Log activity
    await tx.crmActivity.create({
      data: {
        activityType: 'NOTE',
        subject: `Lead converted to opportunity: ${data.opportunityName}`,
        description: `Lead "${lead.title}" was converted to opportunity "${data.opportunityName}"`,
        userId,
        accountId,
        opportunityId: opportunity.id,
      },
    });

    return opportunity;
  });
}

// ============================================================================
// OPPORTUNITY STAGE CHANGE
// ============================================================================

import { validateStageTransition } from './crm-stage-gate.service';

export async function moveOpportunityStage(
  opportunityId: string,
  stageId: string,
  userId: string,
  lostReason?: string,
  visibleOwnerIds: string[] | null = [userId]
) {
  const result = await prisma.$transaction(async (tx) => {
    const opportunity = await tx.crmOpportunity.findFirst({
      where: applyOwnerScope({ id: opportunityId, deletedAt: null }, visibleOwnerIds),
      include: { stage: true },
    });
    if (!opportunity) throw new AppError('Opportunity not found', 404);

    const newStage = await tx.crmPipelineStage.findUniqueOrThrow({
      where: { id: stageId },
    });

    // Ensure same pipeline
    if (newStage.pipelineId !== opportunity.pipelineId) {
      throw new Error('Stage must belong to the same pipeline');
    }

    // Stage gate validation
    const gateResult = validateStageTransition(opportunity, opportunity.stage as any, newStage as any);
    if (!gateResult.ok) {
      const err: any = new Error(gateResult.reason);
      err.needsApproval = !!gateResult.needsApproval;
      err.gateFailed = true;
      throw err;
    }

    const updateData: Prisma.CrmOpportunityUpdateInput = {
      stage: { connect: { id: stageId } },
      probability: newStage.probability,
    };

    if (newStage.isWonStage) {
      updateData.wonAt = new Date();
      updateData.probability = 100;
    } else if (newStage.isLostStage) {
      updateData.lostAt = new Date();
      updateData.lostReason = lostReason;
      updateData.probability = 0;
    }

    const updated = await tx.crmOpportunity.update({
      where: { id: opportunityId },
      data: updateData,
      include: {
        stage: true,
        account: { select: { id: true, name: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Log activity
    await tx.crmActivity.create({
      data: {
        activityType: 'NOTE',
        subject: `Deal moved to ${newStage.name}`,
        description: `Opportunity "${opportunity.name}" moved from "${opportunity.stage.name}" to "${newStage.name}"`,
        userId,
        accountId: opportunity.accountId,
        opportunityId,
      },
    });

    // Record stage history
    await tx.crmOpportunityStageHistory.create({
      data: {
        opportunityId,
        fromStageName: opportunity.stage.name,
        toStageName: newStage.name,
        movedByUserId: userId,
      },
    });

    return { updated, newStage };
  });

  // Fire-and-forget AI debrief when deal closes
  if (result.newStage.isWonStage || result.newStage.isLostStage) {
    setImmediate(() => {
      generateWinLossDebrief(opportunityId)
        .then(async (debrief) => {
          const content = `**AI Win/Loss Debrief**\n\n${debrief.summary}\n\n**Key Factors:**\n${debrief.keyFactors.map(f => `• ${f}`).join('\n')}\n\n**Lessons Learned:**\n${debrief.lessonsLearned.map(l => `• ${l}`).join('\n')}\n\n**Follow-On Actions:**\n${debrief.followOnActions.map(a => `• ${a}`).join('\n')}`;
          await prisma.crmNote.create({ data: { content, opportunityId, authorId: userId } });
        })
        .catch(err => logger.warn('[CRM] Win/loss debrief failed', { error: err }));
    });
  }

  return result.updated;
}

// ============================================================================
// PIPELINE STATS
// ============================================================================

export async function getPipelineStats(pipelineId: string) {
  const stages = await prisma.crmPipelineStage.findMany({
    where: { pipelineId },
    orderBy: { displayOrder: 'asc' },
    include: {
      opportunities: {
        select: {
          id: true,
          name: true,
          value: true,
          probability: true,
          expectedCloseDate: true,
          owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          account: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
          createdAt: true,
          updatedAt: true,
        },
      },
      _count: { select: { opportunities: true } },
    },
  });

  const totalValue = stages.reduce((sum, stage) => {
    if (stage.isLostStage) return sum;
    return sum + stage.opportunities.reduce((s, o) => s + Number(o.value), 0);
  }, 0);

  return { stages, totalValue };
}

export default {
  getDashboardStats,
  convertLead,
  moveOpportunityStage,
  getPipelineStats,
};
