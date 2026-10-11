import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { runWithExecutionScope } from '../../lib/execution-scope';
import { PolicyPrincipal } from '../../security/policy.types';
import { buildDashboardAttentionQuery, buildDashboardSlaMetricsQuery, buildDashboardSlaPageQuery } from '../agent-dashboard-query.service';

const FIXTURE_DATABASE = 'help_center_test';
const runFixture = process.env.AGENT_DASHBOARD_FIXTURE_DB === FIXTURE_DATABASE ? describe : describe.skip;
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const fixtureSize = 10_000;
const now = new Date('2026-10-10T12:00:00.000Z');

interface PlanNode {
  'Node Type': string;
  'Actual Rows'?: number;
  'Shared Hit Blocks'?: number;
  'Shared Read Blocks'?: number;
  'Index Name'?: string;
  Plans?: PlanNode[];
}

async function explainSummary(sql: Prisma.Sql) {
  const rows = await prisma.$queryRaw<{ 'QUERY PLAN': Array<{ 'Execution Time': number; Plan: PlanNode }> }[]>(
    Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
  );
  const root = rows[0]['QUERY PLAN'][0];
  const nodeTypes = new Set<string>();
  const indexes = new Set<string>();
  let sharedHitBlocks = 0;
  let sharedReadBlocks = 0;
  const visit = (node: PlanNode) => {
    nodeTypes.add(node['Node Type']);
    if (node['Index Name']) indexes.add(node['Index Name']);
    sharedHitBlocks += node['Shared Hit Blocks'] ?? 0;
    sharedReadBlocks += node['Shared Read Blocks'] ?? 0;
    node.Plans?.forEach(visit);
  };
  visit(root.Plan);
  return {
    executionMs: root['Execution Time'], rootActualRows: root.Plan['Actual Rows'] ?? 0,
    nodeTypes: [...nodeTypes], indexes: [...indexes], sharedHitBlocks: root.Plan['Shared Hit Blocks'] ?? 0,
 sharedReadBlocks: root.Plan['Shared Read Blocks'] ?? 0,
 };
}

runFixture('agent dashboard 10k-row isolated query-plan acceptance', () => {
  let tenantId: string;
  let userId: string;
  let deskId: string;
  let categoryId: string;
  let requestTypeId: string;
  let principal: PolicyPrincipal;

  beforeAll(async () => {
    const current = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    if (current[0]?.db !== FIXTURE_DATABASE) throw new Error(`Refusing fixture writes outside ${FIXTURE_DATABASE}`);

    const tenant = await prisma.tenant.create({ data: { name: `Dashboard Perf ${suffix}`, slug: `dashboard-perf-${suffix}` } });
    tenantId = tenant.id;
    await runWithExecutionScope({ kind: 'tenant', tenantId }, async () => {
      const user = await prisma.user.create({
        data: { tenantId, email: `dashboard-perf-${suffix}@test.local`, passwordHash: 'fixture-not-for-login', firstName: 'Perf', lastName: 'Agent', agentTeam: `PERF-${suffix.slice(-6).toUpperCase()}`, isActive: true },
      });
      userId = user.id;
      const desk = await prisma.serviceDesk.create({ data: { tenantId, name: `Perf Desk ${suffix}`, code: user.agentTeam!, isActive: true } });
      deskId = desk.id;
      const category = await prisma.serviceCategory.create({ data: { tenantId, serviceDeskId: deskId, name: `Perf Category ${suffix}` } });
      categoryId = category.id;
      const requestType = await prisma.requestType.create({ data: { tenantId, serviceCategoryId: categoryId, name: `Perf Type ${suffix}`, code: `PERF-${suffix}` } });
      requestTypeId = requestType.id;

      const data: Prisma.RequestCreateManyInput[] = Array.from({ length: fixtureSize }, (_, index) => {
        const status = index % 20 === 0 ? 'RESOLVED' : index % 25 === 0 ? 'CANCELLED' : 'IN_PROGRESS';
        const dueOffset = index % 100 === 0 ? -60 * 60_000 : index % 8 === 0 ? 12 * 60 * 60_000 : 48 * 60 * 60_000;
        return {
          id: randomUUID(),
          tenantId, requestTypeId, serviceDeskId: deskId, requesterId: userId,
          requesterEmail: user.email,
          referenceNumber: `PF-${suffix.slice(-6)}-${String(index).padStart(5, '0')}`,
          summary: index === fixtureSize - 1 ? `DISTINCTIVE_PERF_MATCH_${suffix}` : `Performance fixture request ${index}`,
          status, priority: index % 50 === 0 ? 'CRITICAL' : index % 10 === 0 ? 'HIGH' : 'MEDIUM',
          assignedToId: userId, assignedTeam: user.agentTeam, isConfidential: false, tags: [],
          slaDueAt: new Date(now.getTime() + dueOffset),
          createdAt: new Date(now.getTime() - (index % 365) * 86_400_000),
          updatedAt: new Date(now.getTime() - (index % 24) * 3_600_000),
        };
      });
      await prisma.request.createMany({ data });
    });
    principal = { userId, tenantId, roles: ['AGENT'], permissions: [], agentTeam: `PERF-${suffix.slice(-6).toUpperCase()}` };
  }, 180_000);

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
  }, 180_000);

  it('executes full-page, old-search, SLA-metrics, and attention plans on 10,000 tenant-scoped requests', async () => {
    await runWithExecutionScope({ kind: 'tenant', tenantId, actorId: userId }, async () => {
      const pagePlan = await explainSummary(buildDashboardSlaPageQuery(principal, {
        scope: 'team', queue: 'all', page: 1, limit: 100, sort: 'urgency',
      }, now));
      const searchPlan = await explainSummary(buildDashboardSlaPageQuery(principal, {
        scope: 'team', queue: 'all', page: 1, limit: 100, search: `DISTINCTIVE_PERF_MATCH_${suffix}`, sort: 'urgency',
      }, now));
      const metricsPlan = await explainSummary(buildDashboardSlaMetricsQuery(principal, 'team', requestTypeId, now));
      const attentionPlan = await explainSummary(buildDashboardAttentionQuery(principal, 'team', requestTypeId, now));
      const summaries = { page: pagePlan, search: searchPlan, metrics: metricsPlan, attention: attentionPlan };
      console.log('10,000-row EXPLAIN ANALYZE summaries', summaries);
      expect(Object.values(summaries).every((plan) => Number.isFinite(plan.executionMs) && plan.nodeTypes.length > 0)).toBe(true);
      expect(pagePlan.executionMs).toBeGreaterThan(0);
      expect(metricsPlan.executionMs).toBeGreaterThan(0);
      expect(attentionPlan.executionMs).toBeGreaterThan(0);
    });
  }, 180_000);
});
