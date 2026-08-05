import { scoreLead, predictWinProbability } from '../services/crm-ai.service';

jest.mock('../services/crm-ai.service', () => ({
  scoreLead: jest.fn().mockResolvedValue({ score: 72, reason: 'Good engagement' }),
  predictWinProbability: jest.fn().mockResolvedValue({ probability: 65, confidence: 'medium', reason: 'Mid-stage deal' }),
}));

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    crmLead: {
      create: jest.fn().mockResolvedValue({ id: 'lead-123', title: 'Test Lead' }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    crmOpportunity: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

describe('CRM AI auto-trigger', () => {
  beforeEach(() => jest.clearAllMocks());

  it('scoreLead is callable and returns score + reason', async () => {
    const result = await scoreLead('lead-123');
    expect(result).toEqual({ score: 72, reason: 'Good engagement' });
  });

  it('predictWinProbability is callable and returns probability', async () => {
    const result = await predictWinProbability('opp-456');
    expect(result.probability).toBe(65);
    expect(result.confidence).toBe('medium');
  });
});
