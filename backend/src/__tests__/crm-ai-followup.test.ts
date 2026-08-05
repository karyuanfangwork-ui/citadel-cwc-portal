import { analyzeActivityNote } from '../services/crm-ai.service';

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

jest.mock('../utils/prisma', () => {
  const mockActivity = {
    id: 'act1',
    activityType: 'CALL',
    subject: 'Discovery call',
    description: 'Client interested, follow up next week',
    lead: { id: 'lead1', title: 'Test Lead', status: 'CONTACTED' },
    opportunity: null,
  };
  return {
    __esModule: true,
    default: {
      crmActivity: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(mockActivity),
      },
    },
  };
});

describe('analyzeActivityNote — suggestedFollowUpDays', () => {
  it('returns suggestedFollowUpDays when AI includes it', async () => {
    const { _mockCreate } = jest.requireMock('openai') as any;
    _mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            sentiment: 'positive',
            nextAction: 'Follow up in 5 days with proposal',
            suggestedStatusChange: null,
            keyFacts: ['client interested'],
            suggestedFollowUpDays: 5,
          }),
        },
      }],
    });

    const result = await analyzeActivityNote('act1');
    expect(result.suggestedFollowUpDays).toBe(5);
  });

  it('returns null suggestedFollowUpDays when not warranted', async () => {
    const { _mockCreate } = jest.requireMock('openai') as any;
    _mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            sentiment: 'neutral',
            nextAction: 'No specific action needed',
            suggestedStatusChange: null,
            keyFacts: [],
            suggestedFollowUpDays: null,
          }),
        },
      }],
    });

    const result = await analyzeActivityNote('act1');
    expect(result.suggestedFollowUpDays).toBeNull();
  });
});