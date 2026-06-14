const mockPrisma = {
  crmAccount: { count: jest.fn().mockResolvedValue(0) },
  crmContact: { count: jest.fn().mockResolvedValue(0) },
  crmLead: {
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
    findMany: jest.fn().mockResolvedValue([]),
  },
  crmOpportunity: {
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: { value: 0 }, _count: 0 }),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  crmActivity: { findMany: jest.fn().mockResolvedValue([]) },
  crmPipeline: { findMany: jest.fn().mockResolvedValue([]) },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import { getDashboardStats } from '../services/crm.service';

describe('getDashboardStats extended fields', () => {
  it('returns monthlyTrend with 6 entries', async () => {
    const stats = await getDashboardStats();

    expect(stats.monthlyTrend).toHaveLength(6);
    expect(stats.monthlyTrend[0]).toMatchObject({
      month: expect.any(String),
      wonCount: expect.any(Number),
      wonValue: expect.any(Number),
    });
  });

  it('returns pipelineByName array', async () => {
    const stats = await getDashboardStats();

    expect(Array.isArray(stats.pipelineByName)).toBe(true);
  });

  it('returns upcomingFollowUps array', async () => {
    const stats = await getDashboardStats();

    expect(Array.isArray(stats.upcomingFollowUps)).toBe(true);
  });
});
