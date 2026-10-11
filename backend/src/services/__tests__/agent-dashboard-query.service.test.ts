import {
  buildDashboardAttentionQuery,
  buildDashboardSlaMetricsQuery,
  buildDashboardSlaPageQuery,
} from '../agent-dashboard-query.service';
import { DashboardQuery } from '../agent-dashboard.service';
import { PolicyPrincipal } from '../../security/policy.types';

const agent: PolicyPrincipal = {
  userId: '00000000-0000-4000-8000-000000000001',
  tenantId: '00000000-0000-4000-8000-000000000010',
  roles: ['AGENT'], permissions: [], agentTeam: 'IT',
};
const now = new Date('2026-10-10T12:00:00.000Z');
const query: DashboardQuery = {
  scope: 'team', queue: 'all', page: 2, limit: 25, sort: 'urgency',
  search: 'laptop issue', requestTypeId: '00000000-0000-4000-8000-000000000020',
  priority: 'HIGH', slaState: 'UNKNOWN',
};

describe('buildDashboardSlaPageQuery', () => {
  it('classifies completed outcomes and excludes ambiguous clock histories in SQL', () => {
    const sql = buildDashboardSlaPageQuery(agent, query, now);
    expect(sql.sql).toContain('clocks.completed_at <= clocks.completed_due_at');
    expect(sql.sql).toContain('clocks.completed_count <> 1');
    expect(sql.sql).toContain('clocks.current_count > 1');
    expect(sql.sql).toContain('r.sla_due_at');
    expect(sql.sql).toContain('LIMIT');
    expect(sql.sql).toContain('OFFSET');
    expect(sql.values).toContain('UNKNOWN');
    expect(sql.values).toContain(agent.tenantId);
    expect(sql.values).toContain(agent.userId);
    expect(sql.values).toContain(query.requestTypeId);
    expect(sql.values).toContain(query.priority);
    expect(sql.values).toContain(query.search);
  });

  it('applies confidential, participant, approver, team, and soft-delete visibility predicates', () => {
    const executive: PolicyPrincipal = { ...agent, roles: ['AGENT', 'CFO'] };
    const sql = buildDashboardSlaPageQuery(executive, query, now).sql;
    expect(sql).toContain('r.deleted_at IS NULL');
    expect(sql).toContain('r.is_confidential = false');
    expect(sql).toContain('request_participants');
    expect(sql).toContain('request_approvals');
    expect(sql).toContain('service_desks');
    expect(sql).toContain('r.assigned_team');
  });

  it('keeps admin accessible scope tenant-bound and rejects non-admin accessible scope', () => {
    const admin: PolicyPrincipal = { ...agent, roles: ['ADMIN'], agentTeam: null };
    const adminQuery = { ...query, scope: 'accessible' as const };
    const sql = buildDashboardSlaPageQuery(admin, adminQuery, now);
    expect(sql.sql).toContain('r.tenant_id');
    expect(sql.sql).not.toContain('r.is_confidential = false');
    expect(() => buildDashboardSlaPageQuery(agent, adminQuery, now)).toThrow('Dashboard scope is not allowed');
  });

  it('uses the same classifier and access predicates for due-soon and breach metrics', () => {
    const sql = buildDashboardSlaMetricsQuery(agent, 'team', query.requestTypeId, now);
    expect(sql.sql).toContain("clocks.completed_at <= clocks.completed_due_at");
    expect(sql.sql).toContain("count(*) FILTER (WHERE (CASE");
    expect(sql.sql).toContain("AS due_soon");
    expect(sql.sql).toContain("AS breached");
    expect(sql.sql).toContain('r.deleted_at IS NULL');
    expect(sql.values).toContain(agent.tenantId);
    expect(sql.values).toContain(query.requestTypeId);
  });

  it('calculates the top-three attention count and IDs in SQL from active classified work', () => {
    const sql = buildDashboardAttentionQuery(agent, 'team', query.requestTypeId, now);
    expect(sql.sql).toContain('WITH attention AS');
    expect(sql.sql).toContain("IN ('BREACHED', 'DUE_SOON')");
    expect(sql.sql).toContain("r.priority::text IN ('CRITICAL', 'HIGH')");
    expect(sql.sql).toContain('LIMIT 3');
    expect(sql.sql).toContain('CASE WHEN sla_state IN');
    expect(sql.sql).toContain('r.deleted_at IS NULL');
    expect(sql.values).toContain(agent.tenantId);
    expect(sql.values).toContain(query.requestTypeId);
  });
});
