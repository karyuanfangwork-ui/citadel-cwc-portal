// Create a dynamic mock that returns sensible defaults for any model/method
function createMockModel(methods: string[]) {
  const mock: Record<string, jest.Mock> = {};
  for (const m of methods) {
    mock[m] = jest.fn().mockResolvedValue(
      m === 'count' ? 0 :
      m === 'aggregate' ? { _sum: { value: 0 }, _count: 0 } :
      m === 'groupBy' ? [] :
      m === 'findFirst' ? null :
      m === 'findMany' ? [] :
      m === 'create' ? {} :
      []
    );
  }
  return mock;
}

const mockPrisma = {
  crmAccount: createMockModel(['count']),
  crmContact: createMockModel(['count']),
  crmLead: createMockModel(['count', 'groupBy', 'findMany']),
  crmOpportunity: createMockModel(['count', 'aggregate', 'groupBy', 'findMany']),
  crmActivity: createMockModel(['count', 'findFirst', 'findMany']),
  crmPipeline: createMockModel(['findMany']),
  crmPipelineStage: createMockModel(['findMany']),
  crmQuota: createMockModel(['findFirst']),
  crmTagAssignment: createMockModel(['findMany']),
  crmNote: createMockModel(['create']),
};

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('ioredis', () => {
  const client = {
    on: jest.fn(() => client),
    get: jest.fn(async () => null),
    set: jest.fn(async () => 'OK'),
    setex: jest.fn(async () => 'OK'),
    del: jest.fn(async () => 1),
    keys: jest.fn(async () => []),
    connect: jest.fn(async () => 'OK'),
    quit: jest.fn(async () => 'OK'),
    ping: jest.fn(async () => 'PONG'),
    status: 'ready',
  };
  return jest.fn(() => client);
});

import { getDashboardStats } from '../services/crm.service';

describe('getDashboardStats extended fields', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns monthlyTrend as an array', async () => {
    const stats = await getDashboardStats({ currentUserId: 'admin-1', visibleOwnerIds: null });

    // The monthlyTrend may have 0 or 6 entries depending on whether
    // the service generates placeholder months for empty groupBy results
    expect(Array.isArray(stats.monthlyTrend)).toBe(true);
    if (stats.monthlyTrend.length > 0) {
      expect(stats.monthlyTrend[0]).toMatchObject({
        month: expect.any(String),
        wonCount: expect.any(Number),
        wonValue: expect.any(Number),
      });
    }
  });

  it('returns pipelineByName array', async () => {
    const stats = await getDashboardStats({ currentUserId: 'admin-1', visibleOwnerIds: null });

    expect(Array.isArray(stats.pipelineByName)).toBe(true);
  });

  it('returns upcomingFollowUps array', async () => {
    const stats = await getDashboardStats({ currentUserId: 'admin-1', visibleOwnerIds: null });

    expect(Array.isArray(stats.upcomingFollowUps)).toBe(true);
  });

  it('applies a sales rep owner scope to dashboard lead queries', async () => {
    const stats = await getDashboardStats({ currentUserId: 'rep-1', visibleOwnerIds: ['rep-1'] });

    expect(stats).toBeDefined();
    expect(mockPrisma.crmLead.count).toHaveBeenCalled();
    expect(mockPrisma.crmLead.count.mock.calls.every(([arg]) =>
      arg.where.ownerId?.in?.includes('rep-1')
    )).toBe(true);
    expect(mockPrisma.crmLead.findMany.mock.calls.every(([arg]) =>
      arg.where.ownerId?.in?.includes('rep-1')
    )).toBe(true);
  });

  it('keeps team scope when myDeals is false and narrows it to self when true', async () => {
    await getDashboardStats({
      currentUserId: 'manager-1',
      visibleOwnerIds: ['manager-1', 'rep-1', 'rep-2'],
    });
    expect(mockPrisma.crmLead.count.mock.calls[0][0].where.ownerId.in).toEqual(['manager-1', 'rep-1', 'rep-2']);

    jest.clearAllMocks();
    await getDashboardStats({
      currentUserId: 'manager-1',
      visibleOwnerIds: ['manager-1', 'rep-1', 'rep-2'],
      myDeals: true,
    });
    expect(mockPrisma.crmLead.count.mock.calls[0][0].where.ownerId.in).toEqual(['manager-1']);
  });
});