const count = jest.fn();
const findMany = jest.fn();

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: { workflowTransition: { count, findMany } },
}));

import { getValidNextStatuses, isValidTransition } from '../../utils/workflowTransitions';

describe('scoped workflow transition resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    count.mockImplementation(async (args?: { where?: Record<string, unknown> }) => {
      const where = args?.where ?? {};
      if (where.workflowTypeId === 'workflow-a' && where.tenantId === 'tenant-a') return 1;
      return 0;
    });
    findMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.workflowTypeId === 'workflow-a' && where.tenantId === 'tenant-a') return [{ toStatus: 'SCOPED_TARGET' }];
      if (where.workflowTypeId === null && where.tenantId === null) return [{ toStatus: 'GLOBAL_TARGET' }];
      return [];
    });
  });

  it('does not leak a workflow-scoped transition to a sibling workflow', async () => {
    await expect(isValidTransition('OPEN', 'SCOPED_TARGET', { tenantId: 'tenant-a', workflowTypeId: 'workflow-b' })).resolves.toBe(false);
    expect(count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ workflowTypeId: 'workflow-b' }) }));
  });

  it('prefers the most specific workflow and tenant scope', async () => {
    await expect(isValidTransition('OPEN', 'SCOPED_TARGET', { tenantId: 'tenant-a', workflowTypeId: 'workflow-a' })).resolves.toBe(true);
    await expect(getValidNextStatuses('OPEN', { tenantId: 'tenant-a', workflowTypeId: 'workflow-a' })).resolves.toEqual(['SCOPED_TARGET']);
  });

  it('uses the global row only after scoped rows have no match', async () => {
    findMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => where.workflowTypeId === null && where.tenantId === null ? [{ toStatus: 'GLOBAL_TARGET' }] : []);
    await expect(getValidNextStatuses('OPEN', { tenantId: 'tenant-a', workflowTypeId: 'workflow-a' })).resolves.toEqual(['GLOBAL_TARGET']);
  });
});
