import { assertOwnerVisible, buildVisibleOwnerWhere } from '../services/crm-access.service';

describe('crm-access.service', () => {
  it('allows admins when visible owners is null', () => {
    expect(() => assertOwnerVisible(null, 'someone-else')).not.toThrow();
  });

  it('allows visible owner ids', () => {
    expect(() => assertOwnerVisible(['u-me', 'u-report'], 'u-report')).not.toThrow();
  });

  it('allows unassigned records (ownerId null) for scoped users', () => {
    expect(() => assertOwnerVisible(['u-me'], null)).not.toThrow();
  });

  it('denies invisible owner ids', () => {
    expect(() => assertOwnerVisible(['u-me'], 'u-other')).toThrow('CRM record not found');
  });

  it('builds unrestricted where clause for admins', () => {
    expect(buildVisibleOwnerWhere({ deletedAt: null }, null)).toEqual({ deletedAt: null });
  });

  it('builds owner-restricted where clause that still matches unassigned records', () => {
    expect(buildVisibleOwnerWhere({ deletedAt: null }, ['u-me'])).toEqual({
      deletedAt: null,
      OR: [{ ownerId: { in: ['u-me'] } }, { ownerId: null }],
    });
  });
});
