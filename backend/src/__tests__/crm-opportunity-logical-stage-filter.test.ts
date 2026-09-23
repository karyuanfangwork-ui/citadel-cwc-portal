import { jest } from '@jest/globals';

const mockPrisma = {
  crmPipeline: { findMany: jest.fn() },
  crmOpportunity: { findMany: jest.fn(), count: jest.fn() },
};

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

import { crmController } from '../controllers/crm.controller';

describe('CRM opportunity logical-stage filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.crmPipeline.findMany.mockResolvedValue([
      { stages: [{ id: 'stage-a-negotiation', name: 'Negotiation' }] },
      { stages: [{ id: 'stage-b-negotiation', name: ' negotiation ' }] },
      { stages: [{ id: 'stage-b-proposal', name: 'Proposal' }] },
    ]);
    mockPrisma.crmOpportunity.findMany.mockResolvedValue([]);
    mockPrisma.crmOpportunity.count.mockResolvedValue(0);
  });

  it('resolves a logical stage across active pipelines before paginating opportunities', async () => {
    const body = await new Promise<any>((resolve, reject) => {
      crmController.listOpportunities(
        {
          query: { page: '1', limit: '20', stageName: 'NEGOTIATION' },
          user: { id: 'admin-1', roles: ['ADMIN'], permissions: [], email: 'admin@test.local' },
        } as any,
        { json: resolve } as any,
        reject,
      );
    });

    expect(mockPrisma.crmPipeline.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { stages: { select: { id: true, name: true } } },
    });
    expect(mockPrisma.crmOpportunity.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ stageId: { in: ['stage-a-negotiation', 'stage-b-negotiation'] } }),
      skip: 0,
      take: 20,
    }));
    expect(mockPrisma.crmOpportunity.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ stageId: { in: ['stage-a-negotiation', 'stage-b-negotiation'] } }),
    }));
    expect(body.data.pagination).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
  });
});
