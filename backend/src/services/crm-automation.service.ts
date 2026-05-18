import prisma from '../utils/prisma';
import { notify } from './notification.service';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// 1. Activity Reminders
//    CrmActivity where scheduledAt is within the next 24 hours and
//    completedAt is null → notify the activity owner
// ---------------------------------------------------------------------------

export async function checkActivityReminders(): Promise<void> {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const activities = await prisma.crmActivity.findMany({
    where: {
      scheduledAt: { gte: now, lte: in24Hours },
      completedAt: null,
    },
    select: {
      id: true,
      subject: true,
      scheduledAt: true,
      userId: true,
      leadId: true,
      opportunityId: true,
      accountId: true,
      contactId: true,
    },
  });

  if (activities.length === 0) {
    logger.info('[CRM][ActivityReminders] No upcoming activities found');
    return;
  }

  logger.info(`[CRM][ActivityReminders] Found ${activities.length} upcoming activities`);

  for (const activity of activities) {
    const scheduledTime = activity.scheduledAt!.toLocaleString();
    try {
      await notify({
        userId: activity.userId,
        eventType: 'crm_activity_reminder',
        variables: {
          activitySubject: activity.subject,
          scheduledTime,
          leadId: activity.leadId ?? '',
          opportunityId: activity.opportunityId ?? '',
          accountId: activity.accountId ?? '',
          contactId: activity.contactId ?? '',
        },
      });
    } catch (err) {
      logger.error(`[CRM][ActivityReminders] Failed to notify user ${activity.userId} for activity ${activity.id}`, { error: err });
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Lead Aging — leads with no activity in the last 7 days
//    CrmLead where status not CONVERTED/LOST and deletedAt is null and
//    no CrmActivity linked in the last 7 days → notify owner + manager
// ---------------------------------------------------------------------------

export async function checkLeadAging(): Promise<void> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Find active leads that are not converted or lost
  const activeLeads = await prisma.crmLead.findMany({
    where: {
      status: { notIn: ['CONVERTED', 'LOST'] },
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      ownerId: true,
      owner: {
        select: { id: true, firstName: true, lastName: true, managerId: true },
      },
    },
  });

  if (activeLeads.length === 0) {
    logger.info('[CRM][LeadAging] No active leads found');
    return;
  }

  // Collect lead IDs
  const leadIds = activeLeads.map((l) => l.id);

  // Find all activities on these leads in the last 7 days, grouped by leadId
  const recentActivities = await prisma.crmActivity.findMany({
    where: {
      leadId: { in: leadIds },
      createdAt: { gte: sevenDaysAgo },
    },
    select: { leadId: true },
  });

  const leadsWithRecentActivity = new Set(recentActivities.map((a) => a.leadId));

  // Filter to leads with NO recent activity
  const staleLeads = activeLeads.filter((l) => !leadsWithRecentActivity.has(l.id));

  if (staleLeads.length === 0) {
    logger.info('[CRM][LeadAging] No stale leads found');
    return;
  }

  logger.info(`[CRM][LeadAging] Found ${staleLeads.length} stale leads`);

  const ownerIds = [...new Set(staleLeads.map((l) => l.ownerId))];
  const alreadyNotifiedToday = await prisma.notification.findMany({
    where: {
      userId: { in: ownerIds },
      subject: { contains: 'inactive' },
      createdAt: { gte: todayStart },
      channel: 'IN_APP',
    },
    select: { userId: true },
  });
  const notifiedSet = new Set(alreadyNotifiedToday.map((n) => n.userId));

  let skipped = 0;
  for (const lead of staleLeads) {
    const ownerName = `${lead.owner.firstName} ${lead.owner.lastName}`;

    if (notifiedSet.has(lead.ownerId)) {
      skipped++;
      continue;
    }

    try {
      await notify({
        userId: lead.ownerId,
        eventType: 'crm_lead_aging',
        variables: {
          leadTitle: lead.title,
          ownerName,
          daysStale: '7',
        },
      });

      notifiedSet.add(lead.ownerId);

      if (lead.owner.managerId) {
        await notify({
          userId: lead.owner.managerId,
          eventType: 'crm_lead_aging_manager',
          variables: {
            leadTitle: lead.title,
            ownerName,
            daysStale: '7',
          },
        });
      }
    } catch (err) {
      logger.error(`[CRM][LeadAging] Failed to notify for lead ${lead.id}`, { error: err });
    }
  }

  if (skipped > 0) {
    logger.info(`[CRM][LeadAging] Skipped ${skipped} leads — owners already notified today`);
  }
}

// ---------------------------------------------------------------------------
// 3. Overdue Follow-Ups
//    CrmLead where followUpDate < now and status not CONVERTED/LOST
//    and deletedAt is null → notify owner
// ---------------------------------------------------------------------------

export async function checkOverdueFollowUps(): Promise<void> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const overdueLeads = await prisma.crmLead.findMany({
    where: {
      followUpDate: { lt: now },
      status: { notIn: ['CONVERTED', 'LOST'] },
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      followUpDate: true,
      ownerId: true,
      owner: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  if (overdueLeads.length === 0) {
    logger.info('[CRM][OverdueFollowUps] No overdue follow-ups found');
    return;
  }

  logger.info(`[CRM][OverdueFollowUps] Found ${overdueLeads.length} overdue follow-ups`);

  const ownerIds = [...new Set(overdueLeads.map((l) => l.ownerId))];
  const alreadyNotifiedToday = await prisma.notification.findMany({
    where: {
      userId: { in: ownerIds },
      subject: { contains: 'Overdue Follow-Up' },
      createdAt: { gte: todayStart },
      channel: 'IN_APP',
    },
    select: { userId: true },
  });
  const notifiedSet = new Set(alreadyNotifiedToday.map((n) => n.userId));

  let skipped = 0;
  for (const lead of overdueLeads) {
    if (notifiedSet.has(lead.ownerId)) {
      skipped++;
      continue;
    }

    const ownerName = `${lead.owner.firstName} ${lead.owner.lastName}`;
    const followUpDate = lead.followUpDate!.toLocaleString();
    try {
      await notify({
        userId: lead.ownerId,
        eventType: 'crm_overdue_followup',
        variables: {
          leadTitle: lead.title,
          followUpDate,
          ownerName,
        },
      });
      notifiedSet.add(lead.ownerId);
    } catch (err) {
      logger.error(`[CRM][OverdueFollowUps] Failed to notify owner for lead ${lead.id}`, { error: err });
    }
  }

  if (skipped > 0) {
    logger.info(`[CRM][OverdueFollowUps] Skipped ${skipped} leads — owners already notified today`);
  }
}

// ---------------------------------------------------------------------------
// 4. Stale Deals
//    CrmOpportunity where expectedCloseDate < now and wonAt is null
//    and lostAt is null and deletedAt is null → notify owner
// ---------------------------------------------------------------------------

export async function checkStaleDeals(): Promise<void> {
  const now = new Date();

  const staleDeals = await prisma.crmOpportunity.findMany({
    where: {
      expectedCloseDate: { lt: now },
      wonAt: null,
      lostAt: null,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      expectedCloseDate: true,
      ownerId: true,
      owner: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  if (staleDeals.length === 0) {
    logger.info('[CRM][StaleDeals] No stale deals found');
    return;
  }

  logger.info(`[CRM][StaleDeals] Found ${staleDeals.length} stale deals`);

  for (const deal of staleDeals) {
    const ownerName = `${deal.owner.firstName} ${deal.owner.lastName}`;
    const expectedCloseDate = deal.expectedCloseDate!.toLocaleDateString();
    try {
      await notify({
        userId: deal.ownerId,
        eventType: 'crm_stale_deal',
        variables: {
          dealName: deal.name,
          expectedCloseDate,
          ownerName,
        },
      });
    } catch (err) {
      logger.error(`[CRM][StaleDeals] Failed to notify owner for deal ${deal.id}`, { error: err });
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Trust Review Dates
//    CrmTrustProduct where nextReviewDate is within 60/30/7 days
//    and status is ACTIVE → notify owner using exclusive date windows
// ---------------------------------------------------------------------------

export async function checkTrustReviewDates(): Promise<void> {
  const now = new Date();

  const thresholds = [
    { days: 60, gte: new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000), lte: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000) },
    { days: 30, gte: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),  lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
    { days: 7,  gte: now,                                                  lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
  ];

  for (const { days: threshold, gte, lte } of thresholds) {
    const trustProducts = await prisma.crmTrustProduct.findMany({
      where: {
        nextReviewDate: { gte, lte },
        status: 'ACTIVE',
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    logger.info(`[CRM][TrustReviewDates] Found ${trustProducts.length} trust products due for review in ${threshold} days`);

    for (const trustProduct of trustProducts) {
      try {
        await notify({
          userId: trustProduct.ownerId,
          eventType: 'crm_trust_review_due',
          variables: {
            trustType: trustProduct.trustType,
            accountName: trustProduct.account?.name ?? '',
            daysUntilReview: String(threshold),
            nextReviewDate: trustProduct.nextReviewDate!.toLocaleDateString(),
          },
        });
      } catch (err) {
        logger.error(`[CRM][TrustReviewDates] Failed to notify owner for trust product ${trustProduct.id}`, { error: err });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 6. KYC Expiration — CrmKycRecord where status is APPROVED and expiresAt < now
//    Sets status to EXPIRED and logs activity
// ---------------------------------------------------------------------------

export async function checkKycExpiration(): Promise<void> {
  const now = new Date();

  const expired = await prisma.crmKycRecord.updateMany({
    where: {
      status: 'APPROVED',
      expiresAt: { lt: now },
    },
    data: {
      status: 'EXPIRED',
    },
  });

  if (expired.count > 0) {
    logger.info(`[CRM][KycExpiration] Marked ${expired.count} KYC record(s) as EXPIRED`);
  } else {
    logger.info('[CRM][KycExpiration] No expired KYC records found');
  }
}

// ---------------------------------------------------------------------------
// 7. Auto-Assign Lead (Round-Robin)
//    Finds the next eligible active CRM user in round-robin order
//    and assigns the lead to them. Returns the updated lead or null
//    if no eligible user is found.
// ---------------------------------------------------------------------------

export async function autoAssignLead(leadId: string): Promise<{ id: string; ownerId: string } | null> {
  try {
    // Fetch active users that have a CRM-related role (CRM_USER, CRM_ADMIN, or ADMIN)
    const eligibleUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        roles: {
          some: {
            role: {
              name: { in: ['CRM_USER', 'CRM_ADMIN', 'ADMIN'] },
            },
          },
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (eligibleUsers.length === 0) {
      logger.warn('[CRM][AutoAssign] No eligible CRM users found for round-robin assignment');
      return null;
    }

    // Find the most recently created lead that has an owner from the eligible pool
    const lastAssignedLead = await prisma.crmLead.findFirst({
      where: {
        ownerId: { in: eligibleUsers.map((u) => u.id) },
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: { ownerId: true },
    });

    // Determine next user in round-robin: the one after the last assigned owner
    let nextIndex = 0;
    if (lastAssignedLead) {
      const lastIndex = eligibleUsers.findIndex((u) => u.id === lastAssignedLead.ownerId);
      nextIndex = (lastIndex + 1) % eligibleUsers.length;
    }

    const assignedUser = eligibleUsers[nextIndex];

    // Update the lead's owner
    const updatedLead = await prisma.crmLead.update({
      where: { id: leadId },
      data: { ownerId: assignedUser.id },
      select: { id: true, ownerId: true },
    });

    logger.info(`[CRM][AutoAssign] Lead ${leadId} auto-assigned to user ${assignedUser.id} (round-robin)`);

    // Notify the assigned user
    try {
      await notify({
        userId: assignedUser.id,
        eventType: 'crm_lead_auto_assigned',
        variables: {
          leadId,
        },
      });
    } catch (notifyErr) {
      logger.error(`[CRM][AutoAssign] Failed to notify user ${assignedUser.id} for lead ${leadId}`, { error: notifyErr });
    }

    return updatedLead;
  } catch (err) {
    logger.error(`[CRM][AutoAssign] Failed to auto-assign lead ${leadId}`, { error: err });
    return null;
  }
}

// ---------------------------------------------------------------------------
// 8. Rep Inactivity Detection
//    Finds sales reps with zero CRM activities today and notifies their managers
// ---------------------------------------------------------------------------

export async function checkRepInactivity(): Promise<void> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Find all active sales reps
  const reps = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: { name: 'SALES_REP' } } },
    },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  if (reps.length === 0) return;

  // Count today's activities per rep
  const activityCounts = await prisma.crmActivity.groupBy({
    by: ['userId'],
    _count: { id: true },
    where: { userId: { in: reps.map(r => r.id) }, createdAt: { gte: todayStart } },
  });
  const actMap = new Map(activityCounts.map(a => [a.userId, a._count.id]));

  // Find managers to notify
  const managers = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: { name: 'SALES_MANAGER' } } },
    },
    select: { id: true },
  });

  const inactiveReps = reps.filter(r => (actMap.get(r.id) || 0) === 0);
  if (inactiveReps.length === 0) return;

  const repNames = inactiveReps.map(r => `${r.firstName} ${r.lastName}`).join(', ');

  // Notify each manager via the notification service
  await Promise.all(
    managers.map(manager =>
      notify({
        userId: manager.id,
        eventType: 'crm_rep_inactivity',
        variables: {
          repNames,
          count: String(inactiveReps.length),
        },
      }).catch(() => {})  // non-fatal
    )
  );

  logger.info(`[CRM] Rep inactivity check: ${inactiveReps.length} inactive rep(s) notified to ${managers.length} manager(s)`);
}