import { generateManagerBriefing } from '../services/crm-ai.service';

jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
    _mockCreate: mockCreate,
  };
});

jest.mock('../config', () => ({
  config: { openai: { apiKey: 'test-key' }, nodeEnv: 'test' },
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    crmOpportunity: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'opp1', name: 'Deal A', value: 50000, stage: { name: 'Proposal', isLostStage: false, isWonStage: false }, owner: { firstName: 'Alice', lastName: 'Tan' }, updatedAt: new Date(Date.now() - 10 * 86400000) },
      ]),
    },
    crmActivity: {
      groupBy: jest.fn().mockResolvedValue([
        { userId: 'u1', _count: { id: 3 } },
      ]),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'u1', firstName: 'Alice', lastName: 'Tan' },
        { id: 'u2', firstName: 'Bob', lastName: 'Lee' },
      ]),
    },
  })),
}));

describe('generateManagerBriefing', () => {
  it('returns headline, atRiskDeals, repActivityGaps, and recommendations', async () => {
    const { _mockCreate } = jest.requireMock('openai');
    _mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            headline: 'Pipeline needs attention: 1 stale deal',
            atRiskDeals: ['Deal A — 10 days no update (Alice Tan)'],
            repActivityGaps: ['Bob Lee — 0 activities logged this week'],
            recommendations: ['Follow up on Deal A immediately'],
          }),
        },
      }],
    });

    const result = await generateManagerBriefing();
    expect(result.headline).toContain('Pipeline');
    expect(Array.isArray(result.atRiskDeals)).toBe(true);
    expect(Array.isArray(result.repActivityGaps)).toBe(true);
    expect(Array.isArray(result.recommendations)).toBe(true);
  });
});