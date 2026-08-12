import { resolveVisibleOwnerIds, applyOwnerScope, applyUserScope } from '../services/crm-scope.service';

const baseUser = (over: Partial<any> = {}) => ({
  id: 'u-me',
  roles: [] as string[],
  permissions: ['crm:read'],
  ...over,
});

describe('resolveVisibleOwnerIds', () => {
  it('returns null (no restriction) for crm:admin', async () => {
    const ids = await resolveVisibleOwnerIds(baseUser({ permissions: ['crm:admin'] }));
    expect(ids).toBeNull();
  });

  it('returns null for ADMIN role', async () => {
    const ids = await resolveVisibleOwnerIds(baseUser({ roles: ['ADMIN'] }));
    expect(ids).toBeNull();
  });

  it('returns only self for a plain crm:read user', async () => {
    const ids = await resolveVisibleOwnerIds(baseUser());
    expect(ids).toEqual(['u-me']);
  });

  it('returns self + reports + territory members for crm:read:team', async () => {
    const deps = {
      getReportIds: jest.fn().mockResolvedValue(['u-rep1', 'u-rep2']),
      getTerritoryPeerIds: jest.fn().mockResolvedValue(['u-rep2', 'u-terr3']),
    };
    const ids = await resolveVisibleOwnerIds(
      baseUser({ permissions: ['crm:read', 'crm:read:team'] }),
      deps,
    );
    expect(new Set(ids)).toEqual(new Set(['u-me', 'u-rep1', 'u-rep2', 'u-terr3']));
  });

  it('deduplicates self when reports include self', async () => {
    const deps = {
      getReportIds: jest.fn().mockResolvedValue(['u-me', 'u-rep1']),
      getTerritoryPeerIds: jest.fn().mockResolvedValue([]),
    };
    const ids = await resolveVisibleOwnerIds(
      baseUser({ permissions: ['crm:read', 'crm:read:team'] }),
      deps,
    );
    const countSelf = ids!.filter((id) => id === 'u-me').length;
    expect(countSelf).toBe(1);
  });
});

describe('applyOwnerScope', () => {
  it('adds no ownerId filter when ids is null (admin)', () => {
    expect(applyOwnerScope({ deletedAt: null }, null)).toEqual({ deletedAt: null });
  });

  it('adds ownerId in-filter when ids provided', () => {
    expect(applyOwnerScope({ deletedAt: null }, ['a', 'b'])).toEqual({
      deletedAt: null,
      ownerId: { in: ['a', 'b'] },
    });
  });
});

describe('applyUserScope', () => {
  it('adds an ID filter for non-admin owner lookups', () => {
    expect(applyUserScope({ isActive: true }, ['u-me', 'u-report'])).toEqual({
      isActive: true,
      id: { in: ['u-me', 'u-report'] },
    });
  });

  it('leaves admin owner lookups unrestricted', () => {
    expect(applyUserScope({ isActive: true }, null)).toEqual({ isActive: true });
  });
});
