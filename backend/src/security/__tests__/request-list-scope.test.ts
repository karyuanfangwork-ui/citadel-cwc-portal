import { PolicyPrincipal } from '../policy.types';
import { buildRequestListScope } from '../request-list-scope';

describe('buildRequestListScope', () => {
  const flattenAnd = (conditions: Record<string, any>[]): Record<string, any>[] => conditions.flatMap((condition) =>
    Array.isArray(condition.AND) ? flattenAnd(condition.AND) : [condition],
  );

  const agent: PolicyPrincipal = {
    userId: 'agent-1',
    tenantId: 'tenant-1',
    roles: ['AGENT'],
    permissions: [],
    agentTeam: 'IT',
  };

  it('combines tenant/team visibility, confidentiality exceptions, and soft-delete exclusion', () => {
    const where = buildRequestListScope(agent);
    const and = flattenAnd(where.AND as Record<string, any>[]);

    expect(and).toContainEqual({ deletedAt: null });
    expect(and).toContainEqual({ tenantId: 'tenant-1' });
    expect(and).toContainEqual(expect.objectContaining({ OR: expect.arrayContaining([
      { requesterId: 'agent-1' },
      { assignedToId: 'agent-1' },
      { serviceDesk: { code: 'IT' } },
      { assignedTeam: 'IT' },
      { participants: { some: { userId: 'agent-1' } } },
    ]) }));
    expect(and).toContainEqual(expect.objectContaining({ OR: expect.arrayContaining([
      { isConfidential: false },
      { requesterId: 'agent-1' },
      { assignedToId: 'agent-1' },
      { approvals: { some: { approverId: 'agent-1' } } },
      { participants: { some: { userId: 'agent-1' } } },
    ]) }));
  });

  it('does not add a confidentiality restriction for authorized viewers', () => {
    const privileged: PolicyPrincipal = { ...agent, permissions: ['request:confidential'] };
    const where = buildRequestListScope(privileged);
    const and = flattenAnd(where.AND as Record<string, any>[]);

    expect(and).toContainEqual({ deletedAt: null });
    expect(and).toContainEqual({ tenantId: 'tenant-1' });
    expect(and.some((condition) =>
      Array.isArray(condition.OR) && condition.OR.some((entry: Record<string, unknown>) => 'isConfidential' in entry),
    )).toBe(false);
  });

  it('keeps admin visibility tenant-scoped and excludes soft-deleted requests', () => {
    const admin: PolicyPrincipal = { ...agent, roles: ['ADMIN'], permissions: [] };
    const where = buildRequestListScope(admin);
    const and = flattenAnd(where.AND as Record<string, any>[]);

    expect(and).toContainEqual({ deletedAt: null });
    expect(and).toContainEqual({ tenantId: 'tenant-1' });
    expect(and).toHaveLength(2);
  });
});
