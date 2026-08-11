import { buildGroups, chooseCanonical, identityKey } from '../scripts/merge-crm-duplicate-accounts';

function account(id: string, name: string, score: number, createdAt: string) {
  return {
    id,
    name,
    email: null,
    createdAt: new Date(createdAt),
    owner: { email: 'owner@test.local' },
    _count: {
      contacts: score,
      leads: 0,
      opportunities: 0,
      activities: 0,
      notes: 0,
      linkedRequests: 0,
      trustProducts: 0,
      contactAccountRoles: 0,
    },
  } as any;
}

describe('CRM duplicate account merge planning', () => {
  it('groups names case-insensitively without grouping unrelated records', () => {
    const groups = buildGroups([
      account('a', 'Example Client', 0, '2026-06-16T06:15:00Z'),
      account('b', ' example client ', 1, '2026-06-16T06:16:00Z'),
      account('c', 'Other Client', 0, '2026-06-16T06:15:00Z'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].map(row => row.id)).toEqual(['a', 'b']);
  });

  it('chooses the record with the richest history as canonical', () => {
    const selected = chooseCanonical([
      account('older', 'Client', 0, '2026-06-16T06:15:00Z'),
      account('richer', 'Client', 3, '2026-06-16T06:16:00Z'),
    ]);

    expect(selected.id).toBe('richer');
  });

  it('uses normalized email, then phone, then name for contact identity', () => {
    expect(identityKey({ email: 'Person@Example.com', phone: null, firstName: 'A', lastName: 'B' })).toBe('email:personexamplecom');
    expect(identityKey({ email: null, phone: '+60 12-345', firstName: 'A', lastName: 'B' })).toBe('phone:6012345');
    expect(identityKey({ email: null, phone: null, firstName: 'A', lastName: 'B' })).toBe('name:ab');
  });
});