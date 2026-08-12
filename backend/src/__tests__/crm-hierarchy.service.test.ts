import { validateManagerAssignment } from '../services/crm-hierarchy.service';

const role = (name: string) => ({ role: { name } });

function fakeDb(config: {
  representative?: any;
  manager?: any;
  chain?: Array<{ id: string; managerId: string | null }>;
} = {}) {
  return {
    user: {
      findFirst: jest.fn()
        .mockResolvedValueOnce(config.representative !== undefined ? config.representative : { id: 'rep-1', roles: [role('SALES_REP')] })
        .mockResolvedValueOnce(config.manager !== undefined ? config.manager : { id: 'manager-1', managerId: null, isActive: true, roles: [role('SALES_MANAGER')] }),
      findMany: jest.fn().mockResolvedValue(config.chain ?? [
        { id: 'rep-1', managerId: null },
        { id: 'manager-1', managerId: null },
      ]),
    },
  } as any;
}

describe('validateManagerAssignment', () => {
  it('allows unassignment for a sales representative', async () => {
    await expect(validateManagerAssignment('rep-1', null, 'tenant-1', fakeDb())).resolves.toBeUndefined();
  });

  it('rejects a non-sales-representative target', async () => {
    const db = fakeDb({ representative: { id: 'rep-1', roles: [role('CRM_USER')] } });
    await expect(validateManagerAssignment('rep-1', null, 'tenant-1', db)).rejects.toThrow('SALES_REP');
  });

  it('rejects inactive and non-sales managers', async () => {
    await expect(validateManagerAssignment('rep-1', 'manager-1', 'tenant-1', fakeDb({ manager: { id: 'manager-1', isActive: false, roles: [role('SALES_MANAGER')] } }))).rejects.toThrow('active');
    await expect(validateManagerAssignment('rep-1', 'manager-1', 'tenant-1', fakeDb({ manager: { id: 'manager-1', isActive: true, roles: [role('CRM_USER')] } }))).rejects.toThrow('SALES_MANAGER');
  });

  it('rejects self-reference and cycles', async () => {
    await expect(validateManagerAssignment('rep-1', 'rep-1', 'tenant-1', fakeDb())).rejects.toThrow('themselves');
    await expect(validateManagerAssignment('rep-1', 'manager-1', 'tenant-1', fakeDb({ chain: [
      { id: 'rep-1', managerId: 'manager-1' },
      { id: 'manager-1', managerId: 'rep-1' },
    ] }))).rejects.toThrow('circular');
  });

  it('rejects a manager outside the tenant', async () => {
    const db = fakeDb({ manager: null });
    await expect(validateManagerAssignment('rep-1', 'manager-1', 'tenant-1', db)).rejects.toThrow('tenant');
  });
});
