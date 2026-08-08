import { applyRmScope } from '../rmScope.middleware';

function run(user: any, query: Record<string, unknown> = {}) {
  const req: any = { user, query };
  const next = jest.fn();
  applyRmScope()(req, {} as any, next);
  return { req, next };
}

describe('applyRmScope', () => {
  it('leaves the filter undefined for a bypass role', () => {
    const { req } = run({ id: 'a', roles: ['CREDIT_ADMIN'], permissions: [] });
    expect(req.rmScopeFilter).toBeUndefined();
  });

  it('leaves the filter undefined for credit:admin permission', () => {
    const { req } = run({ id: 'a', roles: [], permissions: ['credit:admin'] });
    expect(req.rmScopeFilter).toBeUndefined();
  });

  it('scopes an RM to their own assignments', () => {
    const { req } = run({ id: 'rm-1', roles: ['CREDIT_RM'], permissions: ['credit:read'] });
    expect(req.rmScopeFilter).toEqual({
      OR: [{ assignedRmId: 'rm-1' }, { assignedAnalystId: 'rm-1' }],
    });
  });

  it('LOS-004: borrowerProfileId must not widen the scope', () => {
    const { req } = run(
      { id: 'rm-1', roles: ['CREDIT_RM'], permissions: ['credit:read'] },
      { borrowerProfileId: '11111111-1111-4111-8111-111111111111' },
    );
    expect(req.rmScopeFilter).toEqual({
      OR: [{ assignedRmId: 'rm-1' }, { assignedAnalystId: 'rm-1' }],
    });
  });

  it('rejects an unauthenticated caller with 401', () => {
    const { next } = run(undefined);
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });
});