import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { CLOSED_STATUSES, RESOLVED_STATUSES } from '../constants/requestStatuses';
import { PolicyPrincipal } from '../security/policy.types';
import { buildRequestListScope } from '../security/request-list-scope';
import { classifyDashboardSla, DashboardSlaState } from './agent-dashboard-sla.service';
import { buildDashboardAttentionQuery, buildDashboardSlaMetricsQuery, buildDashboardSlaPageQuery } from './agent-dashboard-query.service';

export type DashboardScope = 'mine' | 'team' | 'accessible';
export type DashboardQueue = 'open' | 'closed' | 'all' | 'unassigned';
export type DashboardSort = 'urgency' | 'created-desc' | 'created-asc' | 'updated-desc';
export type DashboardPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export interface DashboardQuery {
  scope: DashboardScope; queue: DashboardQueue; page: number; limit: 25 | 50 | 100;
  search?: string; requestTypeId?: string; priority?: DashboardPriority; slaState?: DashboardSlaState; sort: DashboardSort;
}
export interface DashboardTicket {
  id: string; reference: string; summary: string; priority: string; status: string; isTerminal: boolean;
  createdAt: string; updatedAt: string; requester: { id: string; name: string } | null;
  assignee: { id: string; name: string } | null; assignedTeam: string | null;
  requestType: { id: string; name: string } | null;
  sla: { state: DashboardSlaState; dueAt: string | null; remainingMs: number | null; completedAt: string | null; evidence: 'resolution-clock' | 'legacy-request' | 'none' };
}
export interface AgentDashboardResponse {
  asOf: string; scope: DashboardScope; scopeLabel: string; availableScopes: DashboardScope[];
  metrics: { open: number; dueSoon: number; breached: number; avgResolutionHours: number | null; resolutionSampleSize: number; resolutionWindow: { from: string; to: string } };
  queueCounts: { open: number; closed: number; all: number; unassigned: number };
  requestTypes: { id: string; name: string }[]; attention: { total: number; tickets: DashboardTicket[] };
  tickets: DashboardTicket[]; pagination: { page: number; limit: number; total: number; totalPages: number };
}

const CLOSED = CLOSED_STATUSES.map(String);
const POSITIVE = RESOLVED_STATUSES.map(String);
const DAY_MS = 86_400_000;
const SELECT = {
  id: true, referenceNumber: true, summary: true, priority: true, status: true, createdAt: true, updatedAt: true,
  slaDueAt: true, slaPausedAt: true, slaPauseDurationMs: true,
  requester: { select: { id: true, firstName: true, lastName: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  assignedTeam: true, requestType: { select: { id: true, name: true } },
  slaClocks: {
    where: { kind: 'RESOLUTION' as const, status: { in: ['ACTIVE', 'PAUSED', 'BREACHED', 'COMPLETED'] as const } },
    orderBy: { updatedAt: 'desc' as const },
    select: { dueAt: true, status: true, pausedAt: true, completedAt: true },
  },
} satisfies Prisma.RequestSelect;
type SelectedRequest = Prisma.RequestGetPayload<{ select: typeof SELECT }>;

function and(...parts: Prisma.RequestWhereInput[]): Prisma.RequestWhereInput { return { AND: parts }; }
function scopeWhere(principal: PolicyPrincipal, scope: DashboardScope): Prisma.RequestWhereInput {
  if (scope === 'accessible') return {};
  if (scope === 'mine') return { assignedToId: principal.userId };
  if (!principal.roles.includes('AGENT') || !principal.agentTeam) throw new Error('My team scope is unavailable');
  const team = principal.agentTeam.trim().toUpperCase();
  return { OR: [{ assignedToId: principal.userId }, { serviceDesk: { code: team } }, { assignedTeam: team }] };
}
function availableScopes(principal: PolicyPrincipal): DashboardScope[] {
  return ['mine', ...(principal.roles.includes('AGENT') && principal.agentTeam ? ['team' as const] : []), ...(principal.roles.includes('ADMIN') ? ['accessible' as const] : [])];
}
function queueWhere(queue: DashboardQueue): Prisma.RequestWhereInput {
  if (queue === 'open' || queue === 'unassigned') return { status: { notIn: CLOSED } };
  if (queue === 'closed') return { status: { in: CLOSED } };
  return {};
}
function filters(query: DashboardQuery): Prisma.RequestWhereInput[] {
  const out: Prisma.RequestWhereInput[] = [];
  if (query.requestTypeId) out.push({ requestTypeId: query.requestTypeId });
  if (query.priority) out.push({ priority: query.priority });
  if (query.search) {
    const nameTerms = query.search.trim().split(/\s+/);
    out.push({ OR: [
      { referenceNumber: { contains: query.search, mode: 'insensitive' } },
      { summary: { contains: query.search, mode: 'insensitive' } },
      { requester: { is: { firstName: { contains: query.search, mode: 'insensitive' } } } },
      { requester: { is: { lastName: { contains: query.search, mode: 'insensitive' } } } },
      ...(nameTerms.length > 1 ? [{ AND: [
        { requester: { is: { firstName: { contains: nameTerms[0], mode: 'insensitive' as const } } } },
        { requester: { is: { lastName: { contains: nameTerms.slice(1).join(' '), mode: 'insensitive' as const } } } },
      ] }] : []),
      { requestType: { is: { name: { contains: query.search, mode: 'insensitive' } } } },
    ] });
  }
  if (query.queue === 'unassigned') out.push({ assignedToId: null });
  return out;
}
function order(query: DashboardQuery): Prisma.RequestOrderByWithRelationInput[] {
  if (query.queue === 'closed' && query.sort === 'urgency') return [{ updatedAt: 'desc' }, { id: 'asc' }];
  if (query.sort === 'created-asc') return [{ createdAt: 'asc' }, { id: 'asc' }];
  if (query.sort === 'updated-desc') return [{ updatedAt: 'desc' }, { id: 'asc' }];
  if (query.sort === 'created-desc') return [{ createdAt: 'desc' }, { id: 'asc' }];
  return [
    { slaPausedAt: { sort: 'asc', nulls: 'first' } },
    { slaDueAt: { sort: 'asc', nulls: 'last' } },
    { priority: 'desc' },
    { createdAt: 'asc' },
    { id: 'asc' },
  ];
}
function toTicket(r: SelectedRequest, now: Date): DashboardTicket {
  const terminal = CLOSED.includes(r.status);
  const currentClocks = r.slaClocks.filter((clock) => clock.status !== 'COMPLETED');
  const completedClocks = r.slaClocks.filter((clock) => clock.status === 'COMPLETED');
  const ambiguous = terminal
    ? currentClocks.length > 0 || completedClocks.length > 1
    : currentClocks.length > 1;
  const clock = terminal
    ? (completedClocks.length === 1 && currentClocks.length === 0 ? completedClocks[0] : null)
    : currentClocks.length === 1 ? currentClocks[0] : null;
  const sla = classifyDashboardSla({
    isTerminal: terminal, isPositiveResolution: POSITIVE.includes(r.status),
    legacyDueAt: r.slaDueAt, legacyPausedAt: r.slaPausedAt,
    resolutionClock: clock ? { dueAt: clock.dueAt, status: clock.status, pausedAt: clock.pausedAt, completedAt: clock.completedAt } : null,
    ambiguousResolutionClock: ambiguous,
  }, now);
  return {
    id: r.id, reference: r.referenceNumber, summary: r.summary, priority: r.priority, status: r.status, isTerminal: terminal,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    requester: r.requester ? { id: r.requester.id, name: `${r.requester.firstName} ${r.requester.lastName}`.trim() } : null,
    assignee: r.assignedTo ? { id: r.assignedTo.id, name: `${r.assignedTo.firstName} ${r.assignedTo.lastName}`.trim() } : null,
    assignedTeam: r.assignedTeam, requestType: r.requestType,
    sla: { state: sla.state, dueAt: sla.dueAt?.toISOString() ?? null, remainingMs: sla.remainingMs, completedAt: sla.completedAt?.toISOString() ?? null, evidence: sla.evidence },
  };
}

function resolutionAverageQuery(principal: PolicyPrincipal, scope: DashboardScope, requestTypeId: string | undefined, from: Date, to: Date) {
  const where: Prisma.Sql[] = [
    Prisma.sql`r.deleted_at IS NULL`,
    Prisma.sql`r.status IN (${Prisma.join(POSITIVE)})`,
    Prisma.sql`r.resolved_at >= ${from}`,
    Prisma.sql`r.resolved_at <= ${to}`,
    Prisma.sql`r.resolved_at > r.created_at`,
  ];
  if (principal.tenantId) where.push(Prisma.sql`r.tenant_id = ${principal.tenantId}::uuid`);

  if (!principal.roles.includes('ADMIN')) {
    const visible: Prisma.Sql[] = [
      Prisma.sql`r.requester_id = ${principal.userId}::uuid`,
      Prisma.sql`r.assigned_to_id = ${principal.userId}::uuid`,
      Prisma.sql`EXISTS (SELECT 1 FROM request_participants p WHERE p.request_id = r.id AND p.user_id = ${principal.userId}::uuid)`,
    ];
    if (principal.agentTeam) {
      const team = principal.agentTeam.trim().toUpperCase();
      visible.push(Prisma.sql`upper(r.assigned_team) = ${team}`);
      visible.push(Prisma.sql`EXISTS (SELECT 1 FROM service_desks sd WHERE sd.id = r.service_desk_id AND upper(sd.code) = ${team})`);
    }
    if (principal.roles.some((role) => ['CEO', 'CTO', 'CFO', 'GROUP_DCEO'].includes(role))) {
      visible.push(Prisma.sql`EXISTS (SELECT 1 FROM request_approvals a WHERE a.request_id = r.id AND a.approver_id = ${principal.userId}::uuid)`);
    }
    where.push(Prisma.sql`(${Prisma.join(visible, ' OR ')})`);
    if (!principal.permissions.includes('request:confidential')) {
      where.push(Prisma.sql`(r.is_confidential = false OR r.requester_id = ${principal.userId}::uuid OR r.assigned_to_id = ${principal.userId}::uuid OR EXISTS (SELECT 1 FROM request_approvals ca WHERE ca.request_id = r.id AND ca.approver_id = ${principal.userId}::uuid) OR EXISTS (SELECT 1 FROM request_participants cp WHERE cp.request_id = r.id AND cp.user_id = ${principal.userId}::uuid))`);
    }
  }
  if (scope === 'mine') where.push(Prisma.sql`r.assigned_to_id = ${principal.userId}::uuid`);
  if (scope === 'team') {
    const team = principal.agentTeam?.trim().toUpperCase();
    if (!team) throw new Error('My team scope is unavailable');
    where.push(Prisma.sql`(r.assigned_to_id = ${principal.userId}::uuid OR upper(r.assigned_team) = ${team} OR EXISTS (SELECT 1 FROM service_desks sd WHERE sd.id = r.service_desk_id AND upper(sd.code) = ${team}))`);
  }
  if (requestTypeId) where.push(Prisma.sql`r.request_type_id = ${requestTypeId}::uuid`);

  return Prisma.sql`SELECT AVG(EXTRACT(EPOCH FROM (r.resolved_at - r.created_at)) / 3600.0)::float8 AS average_hours, COUNT(*)::int AS sample_size FROM requests r WHERE ${Prisma.join(where, ' AND ')}`;
}

export async function getAgentDashboard(principal: PolicyPrincipal, query: DashboardQuery): Promise<AgentDashboardResponse> {
  const now = new Date();
  const scopes = availableScopes(principal);
  if (!scopes.includes(query.scope)) throw new Error('Dashboard scope is not allowed');
  if (query.queue === 'unassigned' && query.scope === 'mine') throw new Error('Unassigned queue is not allowed in My work scope');

  const base = buildRequestListScope(principal);
  const selectedScope = scopeWhere(principal, query.scope);
  const requestType = query.requestTypeId ? { requestTypeId: query.requestTypeId } : {};
  const common = and(base, selectedScope, requestType);
  const active = and(common, { status: { notIn: CLOSED } });
  const closed = and(common, { status: { in: CLOSED } });
  const tableFilters = filters(query);
  const tableWhere = and(common, queueWhere(query.queue), ...tableFilters);
  const from = new Date(now.getTime() - 30 * DAY_MS);

  return prisma.$transaction(async (tx) => {
    const sqlPage = query.slaState || query.sort === 'urgency'
      ? (await tx.$queryRaw<{ ids: string[]; total: number }[]>(buildDashboardSlaPageQuery(principal, query, now)))[0] ?? { ids: [], total: 0 }
      : null;
    const [openCount, closedCount, allCount, unassignedCount, slaMetricsRows, avgRows, types, attentionRows, total] = await Promise.all([
      tx.request.count({ where: active }),
      tx.request.count({ where: closed }),
      tx.request.count({ where: common }),
      tx.request.count({ where: and(active, { assignedToId: null }) }),
      tx.$queryRaw<{ due_soon: number; breached: number }[]>(buildDashboardSlaMetricsQuery(principal, query.scope, query.requestTypeId, now)),
      tx.$queryRaw<{ average_hours: number | null; sample_size: number }[]>(resolutionAverageQuery(principal, query.scope, query.requestTypeId, from, now)),
      tx.request.findMany({ where: and(base, selectedScope, { requestTypeId: { not: null } }), distinct: ['requestTypeId'], orderBy: { requestType: { name: 'asc' } }, select: { requestType: { select: { id: true, name: true } } } }),
      tx.$queryRaw<{ total: number; ids: string[] }[]>(buildDashboardAttentionQuery(principal, query.scope, query.requestTypeId, now)),
      sqlPage ? Promise.resolve(sqlPage.total) : tx.request.count({ where: tableWhere }),
    ]);
    let rows: SelectedRequest[];
    if (sqlPage) {
      const ids = sqlPage.ids ?? [];
      const fetched = ids.length ? await tx.request.findMany({ where: { id: { in: ids } }, select: SELECT }) : [];
      const byId = new Map(fetched.map((row) => [row.id, row]));
      rows = ids.flatMap((id) => {
        const row = byId.get(id);
        return row ? [row] : [];
      });
    } else {
      rows = await tx.request.findMany({ where: tableWhere, orderBy: order(query), skip: (query.page - 1) * query.limit, take: query.limit, select: SELECT });
    }
    const aggregate = avgRows[0];
    const averageHours = aggregate?.sample_size ? aggregate.average_hours : null;
    const sampleSize = aggregate?.sample_size ?? 0;
    const attentionSummary = attentionRows[0] ?? { total: 0, ids: [] as string[] };
    const attentionFetched = attentionSummary.ids.length
      ? await tx.request.findMany({ where: { id: { in: attentionSummary.ids } }, select: SELECT })
      : [];
    const attentionById = new Map(attentionFetched.map((row) => [row.id, row]));
    const attention = attentionSummary.ids.flatMap((id) => {
      const row = attentionById.get(id);
      return row ? [toTicket(row, now)] : [];
    });
    const slaMetrics = slaMetricsRows[0] ?? { due_soon: 0, breached: 0 };
    return {
      asOf: now.toISOString(), scope: query.scope,
      scopeLabel: query.scope === 'mine' ? 'My work' : query.scope === 'team' ? `My team · ${principal.agentTeam}` : 'All accessible work',
      availableScopes: scopes,
      metrics: { open: openCount, dueSoon: slaMetrics.due_soon, breached: slaMetrics.breached, avgResolutionHours: averageHours, resolutionSampleSize: sampleSize, resolutionWindow: { from: from.toISOString(), to: now.toISOString() } },
      queueCounts: { open: openCount, closed: closedCount, all: allCount, unassigned: unassignedCount },
      requestTypes: types.flatMap((r) => r.requestType ? [r.requestType] : []),
      attention: { total: attentionSummary.total, tickets: attention },
      tickets: rows.map((r) => toTicket(r, now)),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
