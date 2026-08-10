import { logger } from '../utils/logger';
import { notify } from '../services/notification.service';

import prisma from '../utils/prisma';

/**
 * Reassign a request to the first active agent on the specified team.
 *
 * Looks up agents by `agentTeam` (no entityId scoping), sets both
 * `assignedToId` and `assignedTeam`, creates an activity record,
 * and sends a notification to the new assignee.
 *
 * Falls back gracefully: if no agent is found on the team, logs a
 * warning and returns without crashing.
 */
export async function reassignToTeam(
  requestId: string,
  referenceNumber: string,
  team: string,
  /** Optional label for log messages (defaults to team) */
  logPrefix?: string,
): Promise<void> {
  const agent = await prisma.user.findFirst({
    where: {
      agentTeam: team,
      isActive: true,
      roles: { some: { role: { name: { in: ['AGENT', 'ADMIN'] } } } },
    },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { createdAt: 'asc' },
  });

  const prefix = logPrefix || team;

  if (!agent) {
    logger.warn(`[${prefix}] No active ${team} agent found for reassignment of ${referenceNumber}`);
    return;
  }

  const agentName = `${agent.firstName} ${agent.lastName}`;

  const currentRequest = await prisma.request.findUnique({
    where: { id: requestId },
    select: { assignedToId: true, assignedTeam: true },
  });
  const assignmentChanged = currentRequest?.assignedToId !== agent.id
    || (currentRequest?.assignedTeam || '').trim().toUpperCase() !== team.trim().toUpperCase();

  if (!assignmentChanged) {
    logger.info(`[${prefix}] Request ${referenceNumber} is already assigned to ${agentName} (${team}); skipping duplicate notification`);
    return;
  }

  await prisma.request.update({
    where: { id: requestId },
    data: { assignedToId: agent.id, assignedTeam: team },
  });

  await prisma.requestActivity.create({
    data: {
      requestId,
      authorName: 'System',
      activityType: 'ASSIGNMENT',
      message: `Auto-reassigned to ${agentName} (${team} team) — workflow transition`,
      isSystemGenerated: true,
      metadata: { autoAssigned: true, assignedToId: agent.id, assignedTeam: team },
    },
  });

  if (currentRequest?.assignedToId !== agent.id) {
    await notify({
      userId: agent.id,
      eventType: 'REQUEST_ASSIGNED',
      variables: { referenceNumber, assignedToName: agentName },
      relatedRequestId: requestId,
    });
  }

  logger.info(`[${prefix}] Request ${referenceNumber} reassigned to ${agentName} (${team})`);
}