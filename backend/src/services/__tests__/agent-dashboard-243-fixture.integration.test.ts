import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { runWithExecutionScope } from '../../lib/execution-scope';
import { getAgentDashboard } from '../agent-dashboard.service';
import {
  buildDashboardAttentionQuery,
  buildDashboardSlaMetricsQuery,
  buildDashboardSlaPageQuery,
} from '../agent-dashboard-query.service';
import { PolicyPrincipal } from '../../security/policy.types';

const FIXTURE_DATABASE = 'help_center_test';
const runFixture = process.env.AGENT_DASHBOARD_FIXTURE_DB === FIXTURE_DATABASE ? describe : describe.skip;
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const marker = `AGDASH_OLD_BREACH_${suffix}`;
const team = `IT-${suffix.slice(-6).toUpperCase()}`;
const now = new Date();
const HOUR = 60 * 60 * 1000;

async function explainSummary(sql: Prisma.Sql) {
  const rows = await prisma.$queryRaw<{ 'QUERY PLAN': Array<{ 'Execution Time': number; Plan: PlanNode }> }[]>(
    Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
  );
  const root = rows[0]['QUERY PLAN'][0];
  const nodeTypes: string[] = [];
  const indexes: string[] = [];
  const visit = (node: PlanNode) => {
    nodeTypes.push(node['Node Type']);
    if (node['Index Name']) indexes.push(node['Index Name']);
    node.Plans?.forEach(visit);
  };
  visit(root.Plan);
  return { executionMs: root['Execution Time'], nodeTypes: [...new Set(nodeTypes)], indexes: [...new Set(indexes)] };
}
interface PlanNode {
  'Node Type': string;
  'Index Name'?: string;
  Plans?: PlanNode[];
}

runFixture('agent dashboard 243-request isolated database acceptance', () => {
  let tenantId: string;
  let userId: string;
  let deskId: string;
  let categoryId: string;
  let requestTypeId: string;
  let requestIds: string[] = [];
  let principal: PolicyPrincipal;

  beforeAll(async () => {
    const db = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    if (db[0]?.db !== FIXTURE_DATABASE) throw new Error(`Refusing fixture writes outside ${FIXTURE_DATABASE}`);

    const tenant = await prisma.tenant.create({ data: { name: `Dashboard Test ${suffix}`, slug: `dashboard-test-${suffix}` } });
    tenantId = tenant.id;
    await runWithExecutionScope({ kind: 'tenant', tenantId }, async () => {
      const user = await prisma.user.create({
        data: {
          tenantId, email: `dashboard-agent-${suffix}@test.local`, passwordHash: 'fixture-not-for-login',
          firstName: 'Dashboard', lastName: 'Agent', agentTeam: team, isActive: true,
        },
      });
      userId = user.id;
      const desk = await prisma.serviceDesk.create({
        data: { tenantId, name: `Dashboard Test Desk ${suffix}`, code: team, isActive: true },
      });
      deskId = desk.id;
      const category = await prisma.serviceCategory.create({
        data: { tenantId, serviceDeskId: deskId, name: `Dashboard Test Category ${suffix}` },
      });
      categoryId = category.id;
      const requestType = await prisma.requestType.create({
        data: { tenantId, serviceCategoryId: categoryId, name: `Dashboard Test Type ${suffix}`, code: `DASH-${suffix}` },
      });
      requestTypeId = requestType.id;

      const createdAt = new Date(now.getTime() - 60 * 60 * 1000);
      const rows = Array.from({ length: 243 }, (_, index) => {
        const id = randomUUID();
        requestIds.push(id);
        const data: Record<string, unknown> = {
          id, tenantId, requestTypeId, serviceDeskId: deskId, requesterId: userId,
          requesterEmail: user.email, referenceNumber: `AD-${suffix.slice(-6)}-${String(index).padStart(3, '0')}`,
          summary: index === 0 ? marker : `Dashboard fixture request ${index}`,
          status: index === 239 || index === 240 || index === 241 ? 'RESOLVED' : index === 242 ? 'CANCELLED' : 'IN_PROGRESS',
          priority: index === 0 || index === 10 ? 'CRITICAL' : index === 1 || index === 11 ? 'HIGH' : 'MEDIUM',
          assignedToId: userId, assignedTeam: team, isConfidential: false, tags: [],
          createdAt: index === 0 ? new Date('2019-01-01T00:00:00.000Z') : createdAt,
          updatedAt: createdAt,
        };
        if (index === 0) data.slaDueAt = new Date(now.getTime() - 24 * HOUR);
        if (index === 1) data.slaDueAt = new Date(now.getTime() + 2 * HOUR);
        if (index === 2) data.slaDueAt = new Date(now.getTime() + 48 * HOUR);
        if (index === 4) {
          data.slaDueAt = new Date(now.getTime() - 5 * HOUR);
          data.slaPausedAt = new Date(now.getTime() - 30 * 60_000);
        }
        if (index >= 239 && index <= 241) {
          data.createdAt = new Date(now.getTime() - 2 * HOUR);
          data.updatedAt = now;
          data.resolvedAt = new Date(now.getTime() - HOUR);
          data.completedAt = new Date(now.getTime() - HOUR);
        }
        return data;
      });
      await prisma.request.createMany({ data: rows as Prisma.RequestCreateManyInput[] });

      await prisma.slaClock.createMany({
        data: [
          { tenantId, requestId: requestIds[5], kind: 'RESOLUTION', status: 'ACTIVE', dueAt: new Date(now.getTime() + HOUR), idempotencyKey: `dash-${suffix}-ambiguous-a` },
          { tenantId, requestId: requestIds[5], kind: 'RESOLUTION', status: 'ACTIVE', dueAt: new Date(now.getTime() + 2 * HOUR), idempotencyKey: `dash-${suffix}-ambiguous-b` },
          { tenantId, requestId: requestIds[239], kind: 'RESOLUTION', status: 'COMPLETED', dueAt: new Date(now.getTime() - 30 * 60_000), completedAt: new Date(now.getTime() - HOUR), idempotencyKey: `dash-${suffix}-met` },
          { tenantId, requestId: requestIds[240], kind: 'RESOLUTION', status: 'COMPLETED', dueAt: new Date(now.getTime() - 2 * HOUR), completedAt: new Date(now.getTime() - HOUR), idempotencyKey: `dash-${suffix}-missed` },
        ],
      });
    });

    principal = { userId, tenantId, roles: ['AGENT'], permissions: [], agentTeam: team };
  }, 60_000);

  afterAll(async () => {
    if (!tenantId) return;
    await runWithExecutionScope({ kind: 'tenant', tenantId }, async () => {
      await prisma.request.deleteMany({ where: { tenantId } });
      if (requestTypeId) await prisma.requestType.deleteMany({ where: { id: requestTypeId } });
      if (categoryId) await prisma.serviceCategory.deleteMany({ where: { id: categoryId } });
      if (deskId) await prisma.serviceDesk.deleteMany({ where: { id: deskId } });
      if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  }, 60_000);

  it('finds a distinctive old breached ticket beyond the first 200 and reports exact aggregate totals', async () => {
    await runWithExecutionScope({ kind: 'tenant', tenantId, actorId: userId }, async () => {
      const result = await getAgentDashboard(principal, {
        scope: 'mine', queue: 'all', page: 1, limit: 25, sort: 'urgency',
      });
      expect(result.pagination.total).toBe(243);
      expect(result.pagination.totalPages).toBe(10);
      expect(result.queueCounts).toMatchObject({ open: 239, closed: 4, all: 243, unassigned: 0 });
      expect(result.metrics).toMatchObject({ breached: 1, dueSoon: 1 });
      expect(result.attention.total).toBe(4);
      expect(result.attention.tickets.map((ticket) => ticket.id)).toEqual([requestIds[0], requestIds[1], requestIds[10]]);

      const firstPage = await getAgentDashboard(principal, {
        scope: 'mine', queue: 'open', page: 1, limit: 25, sort: 'created-desc',
      });
      expect(firstPage.tickets.some((ticket) => ticket.id === requestIds[0])).toBe(false);

      const oldMatch = await getAgentDashboard(principal, {
        scope: 'mine', queue: 'all', page: 1, limit: 25, sort: 'created-desc', search: marker,
      });
      expect(oldMatch.pagination).toMatchObject({ total: 1, totalPages: 1 });
      expect(oldMatch.tickets.map((ticket) => ticket.id)).toEqual([requestIds[0]]);
      expect(oldMatch.tickets[0].sla.state).toBe('BREACHED');

      const [pagePlan, metricsPlan, attentionPlan] = await Promise.all([
        explainSummary(buildDashboardSlaPageQuery(principal, { scope: 'mine', queue: 'all', page: 1, limit: 100, sort: 'urgency' }, now)),
        explainSummary(buildDashboardSlaMetricsQuery(principal, 'mine', requestTypeId, now)),
        explainSummary(buildDashboardAttentionQuery(principal, 'mine', requestTypeId, now)),
      ]);
      console.log('243-request EXPLAIN ANALYZE summaries', { page: pagePlan, metrics: metricsPlan, attention: attentionPlan });
      expect([pagePlan, metricsPlan, attentionPlan].every((plan) => Number.isFinite(plan.executionMs) && plan.nodeTypes.length > 0)).toBe(true);
    });
  }, 60_000);

  it('preserves stable multi-page results and supported sort variants over the full fixture', async () => {
    await runWithExecutionScope({ kind: 'tenant', tenantId, actorId: userId }, async () => {
      const ids: string[] = [];
      for (const page of [1, 2, 3]) {
        const result = await getAgentDashboard(principal, {
          scope: 'mine', queue: 'all', page, limit: 100, sort: 'created-desc',
        });
        expect(result.pagination.total).toBe(243);
        ids.push(...result.tickets.map((ticket) => ticket.id));
      }
      expect(ids).toHaveLength(243);
      expect(new Set(ids).size).toBe(243);

      const oldest = await getAgentDashboard(principal, {
        scope: 'mine', queue: 'all', page: 1, limit: 25, sort: 'created-asc',
      });
      expect(oldest.tickets[0].id).toBe(requestIds[0]);

      const recentlyUpdated = await getAgentDashboard(principal, {
        scope: 'mine', queue: 'all', page: 1, limit: 25, sort: 'updated-desc',
      });
      expect(new Set(recentlyUpdated.tickets.slice(0, 3).map((ticket) => ticket.id))).toEqual(
        new Set([requestIds[239], requestIds[240], requestIds[241]]),
      );
    });
  }, 60_000);

  it('keeps table-only filters separate from scoped metrics and searches full requester names', async () => {
    await runWithExecutionScope({ kind: 'tenant', tenantId, actorId: userId }, async () => {
      const critical = await getAgentDashboard(principal, {
        scope: 'mine', queue: 'all', page: 1, limit: 25, sort: 'created-desc', priority: 'CRITICAL',
      });
      expect(critical.pagination.total).toBe(2);
      expect(new Set(critical.tickets.map((ticket) => ticket.id))).toEqual(new Set([requestIds[0], requestIds[10]]));
      expect(critical.metrics).toMatchObject({ open: 239, breached: 1, dueSoon: 1 });
      expect(critical.queueCounts.all).toBe(243);

      const byFullRequesterName = await getAgentDashboard(principal, {
        scope: 'mine', queue: 'all', page: 1, limit: 25, sort: 'created-desc', search: 'Dashboard Agent',
      });
      expect(byFullRequesterName.pagination.total).toBe(243);
    });
  }, 60_000);

  it.each([
    ['BREACHED', [0]], ['DUE_SOON', [1]], ['ON_TRACK', [2]], ['PAUSED', [4]],
    ['NO_SLA', [3, ...Array.from({ length: 233 }, (_, i) => i + 6)]],
    ['MET', [239]], ['MISSED', [240]], ['UNKNOWN', [5, 241]], ['NOT_APPLICABLE', [242]],
  ] as const)('filters %s using the canonical database classifier', async (slaState, indexes) => {
    await runWithExecutionScope({ kind: 'tenant', tenantId, actorId: userId }, async () => {
      const allTickets = [];
      let total = 0;
      const pages = Math.max(1, Math.ceil(indexes.length / 100));
      for (let page = 1; page <= pages; page += 1) {
        const result = await getAgentDashboard(principal, {
          scope: 'mine', queue: 'all', page, limit: 100, sort: 'created-desc', slaState,
        });
        total = result.pagination.total;
        allTickets.push(...result.tickets);
      }
      const expectedIds = indexes.map((index) => requestIds[index]);
      expect(total).toBe(expectedIds.length);
      expect(new Set(allTickets.map((ticket) => ticket.id))).toEqual(new Set(expectedIds));
      expect(allTickets.every((ticket) => ticket.sla.state === slaState)).toBe(true);
    });
  }, 60_000);
});
