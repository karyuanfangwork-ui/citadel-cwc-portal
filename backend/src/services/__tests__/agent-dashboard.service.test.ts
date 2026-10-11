const txMock = {
  request: { count: jest.fn(), findMany: jest.fn() },
  $queryRaw: jest.fn(),
};
const prismaMock = {
  $transaction: jest.fn(async (callback: (tx: typeof txMock) => unknown) => callback(txMock)),
};

jest.mock('../../utils/prisma', () => ({ __esModule: true, default: prismaMock }));

import { getAgentDashboard, DashboardQuery } from '../agent-dashboard.service';
import { PolicyPrincipal } from '../../security/policy.types';

const agent: PolicyPrincipal = {
  userId: '00000000-0000-4000-8000-000000000001',
  tenantId: '00000000-0000-4000-8000-000000000010',
  roles: ['AGENT'], permissions: [], agentTeam: 'IT',
};
const query: DashboardQuery = {
  scope: 'mine', queue: 'open', page: 1, limit: 25, sort: 'urgency',
  requestTypeId: '00000000-0000-4000-8000-000000000020',
};

beforeEach(() => {
  jest.clearAllMocks();
  txMock.request.count.mockResolvedValue(0);
  txMock.request.findMany.mockResolvedValue([]);
  txMock.$queryRaw.mockImplementation((sql: { sql?: string }) => Promise.resolve(
    sql.sql?.includes('WITH matched AS')
      ? [{ ids: [agent.userId], total: 1, active_total: 1 }]
      : sql.sql?.includes('WITH attention AS')
        ? [{ total: 0, ids: [] }]
        : sql.sql?.includes('AS due_soon')
          ? [{ due_soon: 0, breached: 0 }]
          : [{ average_hours: null, sample_size: 0 }],
  ));
});

describe('getAgentDashboard query composition', () => {
  it('applies the shared visibility predicate to cards, totals, options, and rows', async () => {
    await getAgentDashboard(agent, query);
    const countWheres = txMock.request.count.mock.calls.map(([arg]) => arg.where);
    expect(countWheres.length).toBeGreaterThanOrEqual(4);
    for (const where of countWheres) {
      expect(JSON.stringify(where)).toContain('deletedAt');
      expect(JSON.stringify(where)).toContain(agent.tenantId);
    }
    const optionQuery = txMock.request.findMany.mock.calls.find(([arg]) => arg.distinct)?.[0];
    expect(JSON.stringify(optionQuery?.where)).toContain('deletedAt');
    expect(optionQuery?.where.requestTypeId).toBeUndefined();
    const dashboardSql = txMock.$queryRaw.mock.calls.find(([sql]) => sql?.sql?.includes('WITH matched AS'))?.[0];
    expect(dashboardSql?.sql).toContain('r.deleted_at IS NULL');
    expect(dashboardSql?.sql).toContain('r.tenant_id');
    expect(dashboardSql?.values).toContain(query.requestTypeId);
    const pageQuery = txMock.request.findMany.mock.calls.find(([arg]) => arg.where?.id?.in)?.[0];
    expect(pageQuery?.where.id.in).toEqual([agent.userId]);
  });

  it('returns null average and real pagination totals instead of inferred page counts', async () => {
    txMock.$queryRaw.mockImplementation((sql: { sql?: string }) => Promise.resolve(
      sql.sql?.includes('WITH matched AS')
        ? [{ ids: [], total: 253, active_total: 243 }]
        : sql.sql?.includes('WITH attention AS')
          ? [{ total: 0, ids: [] }]
          : sql.sql?.includes('AS due_soon')
            ? [{ due_soon: 0, breached: 0 }]
            : [{ average_hours: null, sample_size: 0 }],
    ));
    txMock.request.count
      .mockResolvedValueOnce(243).mockResolvedValueOnce(10).mockResolvedValueOnce(253)
      .mockResolvedValueOnce(3).mockResolvedValueOnce(2).mockResolvedValueOnce(1)
      .mockResolvedValueOnce(5).mockResolvedValueOnce(253);
    const data = await getAgentDashboard(agent, query);
    expect(data.metrics.avgResolutionHours).toBeNull();
    expect(data.metrics.resolutionSampleSize).toBe(0);
    expect(data.queueCounts).toEqual({ open: 243, closed: 10, all: 253, unassigned: 3 });
    expect(data.pagination).toMatchObject({ total: 253, totalPages: 11 });
    expect(data.availableScopes).toEqual(['mine', 'team']);
  });

  it('applies active SLA-state filters through the SQL classifier and paginates on the database', async () => {
    await getAgentDashboard(agent, { ...query, slaState: 'BREACHED' });
    const sql = txMock.$queryRaw.mock.calls[0][0];
    expect(sql.sql).toContain('clocks.current_due_at <=');
    expect(sql.sql).toContain('r.sla_due_at');
    expect(sql.sql).toContain('LIMIT');
    expect(sql.sql).toContain('OFFSET');
  });

  it('supports historical SLA states and uses the SQL result for page IDs and exact total', async () => {
    txMock.request.findMany.mockResolvedValueOnce([]);
    const data = await getAgentDashboard(agent, { ...query, slaState: 'MET' });

    expect(txMock.request.count).toHaveBeenCalled();
    expect(txMock.$queryRaw.mock.calls[0][0].sql).toContain('clocks.completed_at <= clocks.completed_due_at');
    expect(data.pagination).toMatchObject({ total: 1, totalPages: 1 });
    expect(txMock.request.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [agent.userId] } } }));
  });

  it('filters NOT_APPLICABLE using the same SQL outcome classifier', async () => {
    await getAgentDashboard(agent, { ...query, queue: 'closed', slaState: 'NOT_APPLICABLE' });
    const sql = txMock.$queryRaw.mock.calls[0][0];
    expect(sql.sql).toContain("THEN 'NOT_APPLICABLE'");
    expect(sql.values).toContain('REJECTED');
    expect(sql.values).toContain('CANCELLED');
  });

  it('keeps closed rows after active rows in the All urgency queue across page boundaries', async () => {
    txMock.request.count
      .mockResolvedValueOnce(27).mockResolvedValueOnce(10).mockResolvedValueOnce(37)
      .mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0).mockResolvedValueOnce(37).mockResolvedValueOnce(27);
    await getAgentDashboard(agent, { ...query, queue: 'all', page: 2, sort: 'urgency', requestTypeId: undefined });

    const sql = txMock.$queryRaw.mock.calls.find(([statement]) => statement?.sql?.includes('WITH matched AS'))?.[0];
    expect(sql.sql).toContain('CASE WHEN m.is_terminal THEN 1 ELSE 0 END ASC');
    expect(sql.sql).toContain('LIMIT');
    expect(sql.sql).toContain('OFFSET');
    expect(sql.values).toContain(25);
  });

  it('rejects admin-only scope for a non-admin before querying', async () => {
    await expect(getAgentDashboard(agent, { ...query, scope: 'accessible' })).rejects.toThrow('Dashboard scope is not allowed');
    expect(txMock.request.count).not.toHaveBeenCalled();
  });
});
