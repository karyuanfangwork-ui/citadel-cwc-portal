import prisma from '../utils/prisma';
import { logger } from '../utils/logger';

type AssignmentStrategy = 'ROUND_ROBIN' | 'LEAST_LOADED' | 'RANDOM' | 'FIXED_AGENT';

interface AutoAssignResult {
    success: boolean;
    assignedToId: string | null;
    assignedTeam: string | null;
    agentName: string | null;
    strategy: AssignmentStrategy | null;
    reason?: string;
}

/**
 * Auto-assign a newly created request to an available agent based on
 * the ServiceDesk's configuration (autoAssignTeam + assignmentStrategy).
 *
 * Fixed-agent mode: When assignmentStrategy is FIXED_AGENT and autoAssignUserId
 * is set, always assign to that specific user. Validates the target is still
 * active and eligible. Fails safely (leaves unassigned) if the fixed target
 * is invalid — does NOT silently fall back to a different user.
 *
 * Team strategies: Round Robin, Least Loaded, Random continue unchanged.
 * This is designed to be called AFTER request creation, as a non-blocking
 * enhancement. If auto-assignment fails, the request remains unassigned
 * and can still be manually assigned later.
 */
export async function autoAssignRequest(requestId: string): Promise<AutoAssignResult> {
    try {
        // Fetch the request with its service desk config
        const request = await prisma.request.findUnique({
            where: { id: requestId },
            select: {
                id: true,
                referenceNumber: true,
                serviceDeskId: true,
                assignedToId: true,
                serviceDesk: {
                    select: {
                        id: true,
                        autoAssignTeam: true,
                        assignmentStrategy: true,
                        lastAssignedIndex: true,
                        autoAssignUserId: true,
                        autoAssignUser: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                agentTeam: true,
                                isActive: true,
                                roles: { select: { role: { select: { name: true } } } },
                            },
                        },
                    },
                },
            },
        });

        if (!request) {
            logger.warn(`[AutoAssign] Request ${requestId} not found`);
            return { success: false, assignedToId: null, assignedTeam: null, agentName: null, strategy: null, reason: 'REQUEST_NOT_FOUND' };
        }

        // Already assigned (e.g. by workflow rules) — skip
        if (request.assignedToId) {
            logger.info(`[AutoAssign] Request ${request.referenceNumber} already assigned, skipping`);
            return { success: false, assignedToId: null, assignedTeam: null, agentName: null, strategy: null, reason: 'ALREADY_ASSIGNED' };
        }

        const desk = request.serviceDesk;
        if (!desk) {
            logger.warn(`[AutoAssign] Request ${request.referenceNumber} has no service desk`);
            return { success: false, assignedToId: null, assignedTeam: null, agentName: null, strategy: null, reason: 'NO_SERVICE_DESK' };
        }

        // No auto-assign configured for this desk
        if (!desk.autoAssignTeam || desk.autoAssignTeam === 'NONE') {
            logger.info(`[AutoAssign] No team configured for service desk, skipping request ${request.referenceNumber}`);
            return { success: false, assignedToId: null, assignedTeam: null, agentName: null, strategy: null, reason: 'NO_TEAM_CONFIGURED' };
        }

        const strategy = (desk.assignmentStrategy as AssignmentStrategy) || 'ROUND_ROBIN';

        // ── Fixed-agent assignment: takes precedence over team strategy ──
        if (strategy === 'FIXED_AGENT') {
            if (!desk.autoAssignUserId) {
                logger.warn(`[AutoAssign] FIXED_AGENT strategy on desk ${desk.id} but no autoAssignUserId configured`);
                return { success: false, assignedToId: null, assignedTeam: null, agentName: null, strategy: 'FIXED_AGENT', reason: 'NO_FIXED_AGENT_CONFIGURED' };
            }

            const fixedUser = desk.autoAssignUser;

            // Validate: user exists, is active, has AGENT/ADMIN role, belongs to the right team
            if (!fixedUser) {
                logger.warn(`[AutoAssign] Fixed agent ${desk.autoAssignUserId} not found for request ${request.referenceNumber}`);
                return { success: false, assignedToId: null, assignedTeam: null, agentName: null, strategy: 'FIXED_AGENT', reason: 'INVALID_FIXED_AGENT' };
            }

            if (!fixedUser.isActive) {
                logger.warn(`[AutoAssign] Fixed agent ${fixedUser.firstName} ${fixedUser.lastName} (${desk.autoAssignUserId}) is inactive for request ${request.referenceNumber}`);
                return { success: false, assignedToId: null, assignedTeam: null, agentName: null, strategy: 'FIXED_AGENT', reason: 'FIXED_AGENT_INACTIVE' };
            }

            const hasAgentRole = fixedUser.roles.some(r => ['AGENT', 'ADMIN'].includes(r.role.name));
            if (!hasAgentRole) {
                logger.warn(`[AutoAssign] Fixed agent ${fixedUser.firstName} ${fixedUser.lastName} (${desk.autoAssignUserId}) lacks AGENT/ADMIN role for request ${request.referenceNumber}`);
                return { success: false, assignedToId: null, assignedTeam: null, agentName: null, strategy: 'FIXED_AGENT', reason: 'FIXED_AGENT_INELIGIBLE_ROLE' };
            }

            const normalizedUserTeam = (fixedUser.agentTeam || '').trim().toUpperCase();
            const normalizedDeskTeam = desk.autoAssignTeam.trim().toUpperCase();
            if (normalizedUserTeam !== normalizedDeskTeam) {
                logger.warn(`[AutoAssign] Fixed agent ${fixedUser.firstName} ${fixedUser.lastName} (${desk.autoAssignUserId}) team "${fixedUser.agentTeam}" does not match desk team "${desk.autoAssignTeam}" for request ${request.referenceNumber}`);
                return { success: false, assignedToId: null, assignedTeam: null, agentName: null, strategy: 'FIXED_AGENT', reason: 'FIXED_AGENT_TEAM_MISMATCH' };
            }

            // Assign to the fixed user (no transaction needed — we don't update lastAssignedIndex)
            await prisma.request.update({
                where: { id: requestId },
                data: {
                    assignedToId: fixedUser.id,
                    assignedTeam: desk.autoAssignTeam,
                },
            });

            const agentName = `${fixedUser.firstName} ${fixedUser.lastName}`;
            logger.info(
                `[AutoAssign] Request ${request.referenceNumber} auto-assigned to ${agentName} (${fixedUser.id}) via FIXED_AGENT strategy`
            );

            return {
                success: true,
                assignedToId: fixedUser.id,
                assignedTeam: desk.autoAssignTeam,
                agentName,
                strategy: 'FIXED_AGENT',
            };
        }

        // ── Team-based strategies: find eligible agents ──
        // Prisma string equality is case-sensitive, so filter the bounded active
        // roster in application code to preserve existing Finance/FINANCE data.
        const allActiveAgents = await prisma.user.findMany({
            where: {
                isActive: true,
                roles: {
                    some: {
                        role: {
                            name: { in: ['AGENT', 'ADMIN'] },
                        },
                    },
                },
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                agentTeam: true,
            },
            orderBy: { createdAt: 'asc' }, // Stable ordering for round-robin
        });
        const normalizedDeskTeam = desk.autoAssignTeam.trim().toUpperCase();
        const eligibleAgents = allActiveAgents.filter((agent) =>
            (agent.agentTeam || '').trim().toUpperCase() === normalizedDeskTeam
        );

        if (eligibleAgents.length === 0) {
            logger.warn(`[AutoAssign] No eligible agents found for team "${desk.autoAssignTeam}" on request ${request.referenceNumber}`);
            return { success: false, assignedToId: null, assignedTeam: null, agentName: null, strategy: null, reason: 'NO_ELIGIBLE_AGENTS' };
        }

        // Select agent based on strategy
        let selectedAgent: typeof eligibleAgents[0];
        let updatedLastAssignedIndex: number;

        switch (strategy) {
            case 'ROUND_ROBIN': {
                const nextIndex = (desk.lastAssignedIndex + 1) % eligibleAgents.length;
                selectedAgent = eligibleAgents[nextIndex];
                updatedLastAssignedIndex = nextIndex;
                break;
            }

            case 'LEAST_LOADED': {
                // Count open (non-resolved) requests per eligible agent
                const agentIds = eligibleAgents.map((a) => a.id);

                const openCounts: { assigned_to_id: string; count: bigint }[] =
                    await prisma.$queryRaw`
                        SELECT assigned_to_id, COUNT(*)::bigint as count
                        FROM requests
                        WHERE assigned_to_id = ANY(${agentIds}::uuid[])
                          AND status::text != ALL(ARRAY['RESOLVED', 'COMPLETED', 'CANCELLED']::text[])
                        GROUP BY assigned_to_id
                    `;

                const countMap = new Map<string, number>();
                for (const row of openCounts) {
                    countMap.set(row.assigned_to_id, Number(row.count));
                }

                // Sort by open count (ascending), then by creation order for tie-breaking
                const sorted = [...eligibleAgents].sort((a, b) => {
                    const ca = countMap.get(a.id) || 0;
                    const cb = countMap.get(b.id) || 0;
                    return ca - cb;
                });

                selectedAgent = sorted[0];
                updatedLastAssignedIndex = eligibleAgents.indexOf(selectedAgent);
                break;
            }

            case 'RANDOM': {
                const randomIndex = Math.floor(Math.random() * eligibleAgents.length);
                selectedAgent = eligibleAgents[randomIndex];
                updatedLastAssignedIndex = randomIndex;
                break;
            }

            default: {
                // Fallback to round-robin
                const nextIndex = (desk.lastAssignedIndex + 1) % eligibleAgents.length;
                selectedAgent = eligibleAgents[nextIndex];
                updatedLastAssignedIndex = nextIndex;
            }
        }

        // Update the request with the assigned agent
        await prisma.$transaction([
            prisma.request.update({
                where: { id: requestId },
                data: {
                    assignedToId: selectedAgent.id,
                    assignedTeam: desk.autoAssignTeam,
                },
            }),
            // Update the service desk's round-robin index
            prisma.serviceDesk.update({
                where: { id: desk.id },
                data: { lastAssignedIndex: updatedLastAssignedIndex },
            }),
        ]);

        const agentName = `${selectedAgent.firstName} ${selectedAgent.lastName}`;

        logger.info(
            `[AutoAssign] Request ${request.referenceNumber} auto-assigned to ${agentName} (${selectedAgent.id}) via ${strategy} strategy`
        );

        return {
            success: true,
            assignedToId: selectedAgent.id,
            assignedTeam: desk.autoAssignTeam,
            agentName,
            strategy,
        };
    } catch (error: any) {
        logger.error(`[AutoAssign] Error auto-assigning request ${requestId}: ${error.message}`);
        return { success: false, assignedToId: null, assignedTeam: null, agentName: null, strategy: null, reason: `ERROR: ${error.message}` };
    }
}