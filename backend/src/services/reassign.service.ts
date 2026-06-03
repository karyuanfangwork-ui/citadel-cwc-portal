import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { notify } from '../services/notification.service';

const prisma = new PrismaClient();

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

  await notify({
    userId: agent.id,
    eventType: 'REQUEST_ASSIGNED',
    variables: { referenceNumber, assignedToName: agentName },
    relatedRequestId: requestId,
  });

  logger.info(`[${prefix}] Request ${referenceNumber} reassigned to ${agentName} (${team})`);
}