import { Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';

const RESOLVED_STATUSES = [
    'RESOLVED',
    'CLOSED',
    'COMPLETED',
    'PAYMENT_COMPLETED',
] as const;

const CLOSED_STATUSES = [
    'RESOLVED',
    'CLOSED',
    'REJECTED',
    'COMPLETED',
    'PAYMENT_COMPLETED',
    'REIMBURSEMENT_CLOSED',
] as const;

class ReportsController {
    getSummary = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const [total, openRequests, resolvedRequests, unassignedRequests, avgResolution] = await Promise.all([
                // Total tickets
                prisma.request.count({ where: { deletedAt: null } }),

                // Open (not in RESOLVED/CLOSED/REJECTED/COMPLETED/PAYMENT_COMPLETED/REIMBURSEMENT_CLOSED)
                prisma.request.count({
                    where: {
                        deletedAt: null,
                        status: {
                            notIn: [
                                'RESOLVED',
                                'CLOSED',
                                'REJECTED',
                                'COMPLETED',
                                'PAYMENT_COMPLETED',
                                'REIMBURSEMENT_CLOSED',
                            ],
                        },
                    },
                }),

                // Resolved (in RESOLVED/CLOSED/COMPLETED/PAYMENT_COMPLETED)
                prisma.request.count({
                    where: {
                        deletedAt: null,
                        status: {
                            in: [
                                'RESOLVED',
                                'CLOSED',
                                'COMPLETED',
                                'PAYMENT_COMPLETED',
                            ],
                        },
                    },
                }),

                // Unassigned (assignedToId null, not resolved/closed/rejected)
                prisma.request.count({
                    where: {
                        deletedAt: null,
                        assignedToId: null,
                        status: {
                            notIn: [
                                'RESOLVED',
                                'CLOSED',
                                'REJECTED',
                                'COMPLETED',
                                'PAYMENT_COMPLETED',
                                'REIMBURSEMENT_CLOSED',
                            ],
                        },
                    },
                }),

                // Avg resolution hours
                prisma.request.findMany({
                    where: {
                        deletedAt: null,
                        resolvedAt: { not: null },
                    },
                    select: {
                        createdAt: true,
                        resolvedAt: true,
                    },
                }),
            ]);

            let avgResolutionHours: number | null = null;
            if (avgResolution.length > 0) {
                const totalMs = avgResolution.reduce((sum, r) => {
                    const diff = r.resolvedAt!.getTime() - r.createdAt.getTime();
                    return sum + diff;
                }, 0);
                avgResolutionHours = Math.round((totalMs / avgResolution.length / (1000 * 60 * 60)) * 100) / 100;
            }

            res.json({
                status: 'success',
                data: {
                    total,
                    open: openRequests,
                    resolved: resolvedRequests,
                    unassigned: unassignedRequests,
                    avgResolutionHours,
                },
            });
        } catch (error) {
            next(error);
        }
    };

    byStatus = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const grouped = await prisma.request.groupBy({
                by: ['status'],
                where: { deletedAt: null },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
            });

            const data = grouped.map((g) => ({
                status: g.status,
                count: g._count.id,
            }));

            res.json({ status: 'success', data });
        } catch (error) {
            next(error);
        }
    };

    byServiceDesk = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const grouped = await prisma.request.groupBy({
                by: ['serviceDeskId'],
                where: { deletedAt: null },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
            });

            // Fetch serviceDesk details for non-null ids
            const serviceDeskIds = grouped
                .map((g) => g.serviceDeskId)
                .filter((id): id is string => id !== null);

            const serviceDesks = await prisma.serviceDesk.findMany({
                where: { id: { in: serviceDeskIds } },
                select: { id: true, name: true, code: true },
            });

            const sdMap = new Map(serviceDesks.map((sd) => [sd.id, sd]));

            const data = grouped.map((g) => {
                const sd = g.serviceDeskId ? sdMap.get(g.serviceDeskId) : null;
                return {
                    serviceDeskId: g.serviceDeskId,
                    name: sd?.name ?? null,
                    code: sd?.code ?? null,
                    count: g._count.id,
                };
            });

            res.json({ status: 'success', data });
        } catch (error) {
            next(error);
        }
    };

    byPriority = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const grouped = await prisma.request.groupBy({
                by: ['priority'],
                where: { deletedAt: null },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
            });

            const data = grouped.map((g) => ({
                priority: g.priority,
                count: g._count.id,
            }));

            res.json({ status: 'success', data });
        } catch (error) {
            next(error);
        }
    };

    agentWorkload = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const grouped = await prisma.request.groupBy({
                by: ['assignedToId'],
                where: {
                    deletedAt: null,
                    assignedToId: { not: null },
                    status: { notIn: CLOSED_STATUSES as unknown as any[] },
                },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
            });

            const agentIds = grouped
                .map((g) => g.assignedToId)
                .filter((id): id is string => id !== null);

            const agents = await prisma.user.findMany({
                where: { id: { in: agentIds } },
                select: { id: true, firstName: true, lastName: true, email: true },
            });

            const agentMap = new Map(agents.map((a) => [a.id, a]));

            const data = grouped.map((g) => {
                const agent = g.assignedToId ? agentMap.get(g.assignedToId) : null;
                return {
                    assignedToId: g.assignedToId,
                    firstName: agent?.firstName ?? null,
                    lastName: agent?.lastName ?? null,
                    email: agent?.email ?? null,
                    openTickets: g._count.id,
                };
            });

            res.json({ status: 'success', data });
        } catch (error) {
            next(error);
        }
    };

    slaStatus = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const now = new Date();
            const openFilter = {
                deletedAt: null,
                status: { notIn: CLOSED_STATUSES as unknown as any[] },
            };

            const [withinSla, breached, noSla] = await Promise.all([
                // Within SLA: slaDueAt > now, open
                prisma.request.count({
                    where: { ...openFilter, slaDueAt: { gt: now } },
                }),
                // Breached: slaDueAt <= now, open
                prisma.request.count({
                    where: { ...openFilter, slaDueAt: { lte: now } },
                }),
                // No SLA: slaDueAt null, open
                prisma.request.count({
                    where: { ...openFilter, slaDueAt: null },
                }),
            ]);

            res.json({
                status: 'success',
                data: { withinSla, breached, noSla },
            });
        } catch (error) {
            next(error);
        }
    };
}

export default new ReportsController();
