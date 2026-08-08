import { Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { policyService } from '../security/policy.service';
import { principalFromAuth } from '../security/resource-scope.service';
import { RESOLVED_STATUSES, CLOSED_STATUSES } from '../constants/requestStatuses';
import { activeSlaAtRiskWhere, activeSlaBreachWhere, withinSlaWhere } from '../utils/slaPredicates';

/** Parse optional from/to query params into a Prisma date filter. */
function dateFilter(req: AuthRequest): { createdAt?: { gte?: Date; lte?: Date } } {
    const filter: { createdAt?: { gte?: Date; lte?: Date } } = {};
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    if (from) filter.createdAt = { ...filter.createdAt, gte: new Date(from) };
    if (to) filter.createdAt = { ...filter.createdAt, lte: new Date(to) };
    return Object.keys(filter).length ? filter : {};
}

/** Merge policy visibility conditions into a Prisma where clause. */
function mergeVisible(base: any, visible: Record<string, any>): any {
    if (visible.AND || visible.OR) {
        return {
            ...base,
            AND: [
                ...(Array.isArray(base.AND) ? base.AND : base.AND ? [base.AND] : []),
                visible,
            ],
        };
    }
    return base;
}

class ReportsController {
    getSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            // P02-11: Scope all report queries to principal's visible requests
            const principal = principalFromAuth(req.user!);
            const visible = policyService.buildVisibleWhere(principal, 'request');
            const df = dateFilter(req);

            const baseWhere = mergeVisible({ deletedAt: null, ...df }, visible);

            const [total, openRequests, resolvedRequests, unassignedRequests, avgResolution] = await Promise.all([
                // Total tickets (scoped)
                prisma.request.count({ where: baseWhere }),

                // Open
                prisma.request.count({
                    where: { ...baseWhere, status: { notIn: CLOSED_STATUSES } },
                }),

                // Resolved
                prisma.request.count({
                    where: { ...baseWhere, status: { in: RESOLVED_STATUSES } },
                }),

                // Unassigned
                prisma.request.count({
                    where: { ...baseWhere, assignedToId: null, status: { notIn: CLOSED_STATUSES } },
                }),

                // Avg resolution hours
                prisma.request.findMany({
                    where: { ...baseWhere, resolvedAt: { not: null } },
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
            const principal = principalFromAuth(req.user!);
            const visible = policyService.buildVisibleWhere(principal, 'request');
            const df = dateFilter(req);
            const baseWhere = mergeVisible({ deletedAt: null, ...df }, visible);

            const grouped = await prisma.request.groupBy({
                by: ['status'],
                where: baseWhere,
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
            const principal = principalFromAuth(req.user!);
            const visible = policyService.buildVisibleWhere(principal, 'request');
            const df = dateFilter(req);
            const baseWhere = mergeVisible({ deletedAt: null, ...df }, visible);

            const grouped = await prisma.request.groupBy({
                by: ['serviceDeskId'],
                where: baseWhere,
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
            const principal = principalFromAuth(req.user!);
            const visible = policyService.buildVisibleWhere(principal, 'request');
            const df = dateFilter(req);
            const baseWhere = mergeVisible({ deletedAt: null, ...df }, visible);

            const grouped = await prisma.request.groupBy({
                by: ['priority'],
                where: baseWhere,
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

    byAssignee = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const principal = principalFromAuth(req.user!);
            const visible = policyService.buildVisibleWhere(principal, 'request');
            const df = dateFilter(req);
            const baseWhere = mergeVisible({ deletedAt: null, ...df }, visible);

            const grouped = await prisma.request.groupBy({
                by: ['assignedToId'],
                where: baseWhere,
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
            });

            // Fetch user details for non-null ids
            const assigneeIds = grouped
                .map((g) => g.assignedToId)
                .filter((id): id is string => id !== null);

            const users = await prisma.user.findMany({
                where: { id: { in: assigneeIds } },
                select: { id: true, firstName: true, lastName: true, email: true },
            });

            const userMap = new Map(users.map((u) => [u.id, u]));

            const data = grouped.map((g) => {
                const user = g.assignedToId ? userMap.get(g.assignedToId) : null;
                return {
                    assignedToId: g.assignedToId,
                    name: user ? `${user.firstName} ${user.lastName}` : 'Unassigned',
                    email: user?.email ?? null,
                    count: g._count.id,
                };
            });

            res.json({ status: 'success', data });
        } catch (error) {
            next(error);
        }
    };

    byCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const principal = principalFromAuth(req.user!);
            const visible = policyService.buildVisibleWhere(principal, 'request');
            const df = dateFilter(req);
            const baseWhere = mergeVisible({ deletedAt: null, ...df }, visible);

            const grouped = await prisma.request.groupBy({
                by: ['requestTypeId'],
                where: baseWhere,
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
            });

            // Fetch request type details
            const typeIds = grouped
                .map((g) => g.requestTypeId)
                .filter((id): id is string => id !== null);

            const requestTypes = await prisma.requestType.findMany({
                where: { id: { in: typeIds } },
                select: { id: true, name: true },
            });

            const typeMap = new Map(requestTypes.map((t) => [t.id, t]));

            const data = grouped.map((g) => ({
                requestTypeId: g.requestTypeId,
                name: g.requestTypeId ? typeMap.get(g.requestTypeId)?.name ?? 'Unknown' : 'Uncategorized',
                count: g._count.id,
            }));

            res.json({ status: 'success', data });
        } catch (error) {
            next(error);
        }
    };

    slaPerformance = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const principal = principalFromAuth(req.user!);
            const visible = policyService.buildVisibleWhere(principal, 'request');
            const df = dateFilter(req);
            const baseWhere = mergeVisible({ deletedAt: null, ...df }, visible);
            const now = new Date();

            // SLA metrics scoped to visible requests
            const [total, breached, atRisk, withinSla] = await Promise.all([
                prisma.request.count({ where: baseWhere }),
                prisma.request.count({
                    where: { AND: [baseWhere, activeSlaBreachWhere(now)], status: { notIn: CLOSED_STATUSES } },
                }),
                prisma.request.count({
                    where: {
                        AND: [baseWhere, activeSlaAtRiskWhere(now)],
                        status: { notIn: CLOSED_STATUSES },
                    },
                }),
                prisma.request.count({
                    where: {
                        AND: [baseWhere, withinSlaWhere(now)],
                        status: { notIn: CLOSED_STATUSES },
                    },
                }),
            ]);

            res.json({
                status: 'success',
                data: {
                    total,
                    breached,
                    atRisk,
                    withinSla,
                },
            });
        } catch (error) {
            next(error);
        }
    };
    // Alias for route compatibility
    agentWorkload = this.byAssignee;
    slaStatus = this.slaPerformance;
}

export const reportsController = new ReportsController();