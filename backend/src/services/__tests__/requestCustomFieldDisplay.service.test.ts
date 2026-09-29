import prisma from '../../utils/prisma';
import { resolveCustomFieldDisplayValues } from '../requestCustomFieldDisplay.service';

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    user: { findMany: jest.fn() },
  },
}));

const mockUserFindMany = prisma.user.findMany as jest.Mock;

describe('resolveCustomFieldDisplayValues', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves CEO picker IDs to tenant-scoped names, including inactive historical approvers', async () => {
    mockUserFindMany.mockResolvedValue([{
      id: 'approver-1',
      firstName: 'Emily',
      lastName: 'Chow',
      isActive: false,
      executiveRole: null,
      roles: [{ role: { name: 'CEO' } }],
    }]);

    const display = await resolveCustomFieldDisplayValues({
      tenantId: 'tenant-1',
      customFields: { approverField: 'approver-1' },
      formConfig: [{ id: 'approverField', type: 'ceo-select', label: 'Approver' }],
    });

    expect(mockUserFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', id: { in: ['approver-1'] } },
      select: expect.objectContaining({ isActive: true, roles: expect.any(Object) }),
    }));
    expect(display).toEqual({ approverField: 'Emily Chow — CEO (inactive)' });
    expect(display.approverField).not.toContain('email');
  });

  it('does not resolve values for users outside the request tenant', async () => {
    mockUserFindMany.mockResolvedValue([]);

    const display = await resolveCustomFieldDisplayValues({
      tenantId: 'tenant-1',
      customFields: { approverField: 'other-tenant-user' },
      formConfig: [{ id: 'approverField', type: 'ceo-select', label: 'Approver' }],
    });

    expect(display).toEqual({ approverField: 'Unavailable approver' });
    expect(mockUserFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', id: { in: ['other-tenant-user'] } },
    }));
  });
});
