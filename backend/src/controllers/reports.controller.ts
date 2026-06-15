import { Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { RESOLVED_STATUSES, CLOSED_STATUSES } from '../constants/requestStatuses';

/** Parse optional from/to query params into a Prisma date filter. */
function dateFilter(req: AuthRequest): { createdAt?: { gte?: Date; lte?: Date } } {
    const filter: { createdAt?: { gte?: Date; lte?: Date } } = {};
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    if (from) filter.createdAt = { ...filter.createdAt, gte: new Date(from) };
    if (to) filter.createdAt = { ...filter.createdAt, lte: new Date(to) };
    return Object.keys(filter).length ? filter : {};
}

class ReportsController {
    getSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const df = dateFilter(req);
            const [total, openRequests, resolvedRequests, unassignedRequests, avgResolution] = await Promise.all([
                // Total tickets
                prisma.request.count({ where: { deletedAt: null, ...df } }),

                // Open (not in RESOLVED/CLOSED/REJECTED/COMPLETED/PAYMENT_COMPLETED/REIMBURSEMENT_CLOSED)
                prisma.request.count({
                    where: {
                        deletedAt: null,
                        status: { notIn: CLOSED_STATUSES },
                        ...df,
                    },
                }),

                // Resolved (in RESOLVED/CLOSED/COMPLETED/PAYMENT_COMPLETED)
                prisma.request.count({
                    where: {
                        deletedAt: null,
                        status: { in: RESOLVED_STATUSES },
                        ...df,
                    },
                }),

                // Unassigned (assignedToId null, not resolved/closed/rejected)
                prisma.request.count({
                    where: {
                        deletedAt: null,
                        assignedToId: null,
                        status: { notIn: CLOSED_STATUSES },
                        ...df,
                    },
                }),

                // Avg resolution hours
                prisma.request.findMany({
                    where: {
                        deletedAt: null,
                        resolvedAt: { not: null },
                        ...df,
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

    byStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const df = dateFilter(req);
            const grouped = await prisma.request.groupBy({
                by: ['status'],
                where: { deletedAt: null, ...df },
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

    byServiceDesk = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const df = dateFilter(req);
            const grouped = await prisma.request.groupBy({
                by: ['serviceDeskId'],
                where: { deletedAt: null, ...df },
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

    byPriority = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const df = dateFilter(req);
            const grouped = await prisma.request.groupBy({
                by: ['priority'],
                where: { deletedAt: null, ...df },
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

    agentWorkload = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const df = dateFilter(req);
            const grouped = await prisma.request.groupBy({
                by: ['assignedToId'],
                where: {
                    deletedAt: null,
                    assignedToId: { not: null },
                    status: { notIn: CLOSED_STATUSES },
                    ...df,
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

    slaStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const df = dateFilter(req);
            const now = new Date();
            const openFilter = {
                deletedAt: null,
                status: { notIn: CLOSED_STATUSES },
                ...df,
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
