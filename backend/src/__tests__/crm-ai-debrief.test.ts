import { generateWinLossDebrief } from '../services/crm-ai.service';

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
  const mockOpp = {
    id: 'opp1',
    name: 'Deal A',
    value: 100000,
    wonAt: new Date(),
    lostAt: null,
    lostReason: null,
    stage: { name: 'Closed Won', isWonStage: true, isLostStage: false },
    account: { name: 'Acme Corp' },
    owner: { firstName: 'Alice', lastName: 'Tan' },
    activities: [
      { activityType: 'CALL', subject: 'Discovery call', description: 'Client keen' },
    ],
    notes: [],
  };
  return {
    __esModule: true,
    default: {
      crmOpportunity: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(mockOpp),
      },
    },
  };
});

describe('generateWinLossDebrief', () => {
  it('returns outcome, keyFactors, lessonsLearned, and followOnActions', async () => {
    const { _mockCreate } = jest.requireMock('openai') as any;
    _mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            outcome: 'WON',
            summary: 'Deal closed after 3 touchpoints',
            keyFactors: ['Strong referral', 'Competitive pricing'],
            lessonsLearned: ['Early discovery call set the tone'],
            followOnActions: ['Schedule trust documentation meeting'],
          }),
        },
      }],
    });

    const result = await generateWinLossDebrief('opp1');
    expect(result.outcome).toBe('WON');
    expect(Array.isArray(result.keyFactors)).toBe(true);
    expect(Array.isArray(result.lessonsLearned)).toBe(true);
    expect(Array.isArray(result.followOnActions)).toBe(true);
  });
});