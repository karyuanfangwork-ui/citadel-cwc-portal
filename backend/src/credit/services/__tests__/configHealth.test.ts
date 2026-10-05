jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditRuleConfig: { count: jest.fn() },
    creditPolicyParameter: { count: jest.fn() },
    ratingBandConfig: { count: jest.fn(), findMany: jest.fn() },
    creditScorecardVersion: { count: jest.fn(), findMany: jest.fn() },
    riskFactorMatrix: { count: jest.fn() },
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import prisma from '../../../utils/prisma';
import { logger } from '../../../utils/logger';
import { checkCreditConfigurationHealth } from '../configHealth.service';

const canonicalBands = [
  { scoreMin: 85, scoreMax: 100, rating: 'AAA', riskCategory: 'LOW' },
  { scoreMin: 78, scoreMax: 84, rating: 'AA', riskCategory: 'LOW' },
  { scoreMin: 70, scoreMax: 77, rating: 'A', riskCategory: 'LOW' },
  { scoreMin: 62, scoreMax: 69, rating: 'BBB', riskCategory: 'MODERATE' },
  { scoreMin: 55, scoreMax: 61, rating: 'BB', riskCategory: 'MODERATE' },
  { scoreMin: 48, scoreMax: 54, rating: 'B', riskCategory: 'MODERATE' },
  { scoreMin: 40, scoreMax: 47, rating: 'CCC', riskCategory: 'HIGH' },
  { scoreMin: 30, scoreMax: 39, rating: 'CC', riskCategory: 'HIGH' },
  { scoreMin: 20, scoreMax: 29, rating: 'C', riskCategory: 'HIGH' },
  { scoreMin: 0, scoreMax: 19, rating: 'D', riskCategory: 'PROHIBITED' },
];

const mockPrisma = prisma as unknown as {
  creditRuleConfig: { count: jest.Mock };
  creditPolicyParameter: { count: jest.Mock };
  ratingBandConfig: { count: jest.Mock; findMany: jest.Mock };
  creditScorecardVersion: { count: jest.Mock; findMany: jest.Mock };
  riskFactorMatrix: { count: jest.Mock };
};
const mockLogger = logger as unknown as {
  error: jest.Mock;
  warn: jest.Mock;
  info: jest.Mock;
};

function setBaselineReads() {
  mockPrisma.creditRuleConfig.count
    .mockResolvedValue(0)
    .mockResolvedValueOnce(11)
    .mockResolvedValueOnce(0);
  mockPrisma.creditPolicyParameter.count.mockResolvedValue(80);
  mockPrisma.ratingBandConfig.count.mockResolvedValue(10);
  mockPrisma.ratingBandConfig.findMany.mockResolvedValue([]);
  mockPrisma.creditScorecardVersion.count.mockResolvedValue(1);
  mockPrisma.creditScorecardVersion.findMany.mockResolvedValue([]);
  mockPrisma.riskFactorMatrix.count.mockResolvedValue(0);
}

describe('checkCreditConfigurationHealth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.creditRuleConfig.count.mockResolvedValue(1);
    mockPrisma.creditPolicyParameter.count.mockResolvedValue(1);
    mockPrisma.ratingBandConfig.count.mockResolvedValue(0);
    mockPrisma.ratingBandConfig.findMany.mockResolvedValue([]);
    mockPrisma.creditScorecardVersion.count.mockResolvedValue(0);
    mockPrisma.creditScorecardVersion.findMany.mockResolvedValue([]);
    mockPrisma.riskFactorMatrix.count.mockResolvedValue(1);
  });

  it('reports missing scoring configuration as blocking and defaults/legacy gaps as warnings', async () => {
    setBaselineReads();

    const result = await checkCreditConfigurationHealth();

    expect(result.ready).toBe(false);
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'required-field-rules', status: 'WARNING', severity: 'WARNING', observed: 0 }),
      expect.objectContaining({ name: 'rating-bands', status: 'BLOCKED', severity: 'BLOCKING', observed: 0 }),
      expect.objectContaining({ name: 'scorecard-version', status: 'BLOCKED', severity: 'BLOCKING', observed: 0 }),
      expect.objectContaining({ name: 'legacy-risk-factor-taxonomy', status: 'WARNING', severity: 'WARNING' }),
    ]));
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.objectContaining({ check: 'legacy-risk-factor-taxonomy' }));
    expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({ check: 'rating-bands', severity: 'BLOCKING' }));
  });

  it('marks readiness green when required scoring prerequisites are valid, while retaining a legacy warning', async () => {
    mockPrisma.creditRuleConfig.count
      .mockResolvedValue(0)
      .mockResolvedValueOnce(11)
      .mockResolvedValueOnce(4);
    mockPrisma.creditPolicyParameter.count.mockResolvedValue(80);
    mockPrisma.ratingBandConfig.count.mockResolvedValue(10);
    mockPrisma.ratingBandConfig.findMany.mockResolvedValue(canonicalBands);
    mockPrisma.creditScorecardVersion.count.mockResolvedValue(1);
    mockPrisma.creditScorecardVersion.findMany.mockResolvedValue([{ scorecardId: 'scorecard-1' }]);
    mockPrisma.riskFactorMatrix.count.mockResolvedValue(0);

    const result = await checkCreditConfigurationHealth();

    expect(result.ready).toBe(true);
    expect(result.checks.find((check) => check.name === 'rating-bands')).toMatchObject({
      ok: true,
      status: 'READY',
      observed: 10,
    });
    expect(result.checks.find((check) => check.name === 'scorecard-version')).toMatchObject({
      ok: true,
      status: 'READY',
      observed: 1,
    });
    expect(result.checks.find((check) => check.name === 'legacy-risk-factor-taxonomy')).toMatchObject({
      ok: false,
      status: 'WARNING',
    });
  });

  it('blocks an incomplete active rating-band set', async () => {
    mockPrisma.creditRuleConfig.count.mockResolvedValue(1);
    mockPrisma.creditPolicyParameter.count.mockResolvedValue(1);
    mockPrisma.ratingBandConfig.findMany.mockResolvedValue(canonicalBands.slice(0, 2));
    mockPrisma.creditScorecardVersion.findMany.mockResolvedValue([{ scorecardId: 'scorecard-1' }]);
    mockPrisma.riskFactorMatrix.count.mockResolvedValue(1);

    const result = await checkCreditConfigurationHealth();

    expect(result.ready).toBe(false);
    expect(result.checks.find((check) => check.name === 'rating-bands')).toMatchObject({
      status: 'BLOCKED',
      severity: 'BLOCKING',
      observed: 2,
    });
  });

  it('blocks an active band set with a non-canonical rating-category mapping', async () => {
    mockPrisma.creditRuleConfig.count.mockResolvedValue(1);
    mockPrisma.creditPolicyParameter.count.mockResolvedValue(1);
    mockPrisma.ratingBandConfig.findMany.mockResolvedValue([
      ...canonicalBands.slice(0, -1),
      { ...canonicalBands[canonicalBands.length - 1], riskCategory: 'HIGH' },
    ]);
    mockPrisma.creditScorecardVersion.findMany.mockResolvedValue([{ scorecardId: 'scorecard-1' }]);

    const result = await checkCreditConfigurationHealth();

    expect(result.ready).toBe(false);
    expect(result.checks.find((check) => check.name === 'rating-bands')).toMatchObject({
      status: 'BLOCKED',
      severity: 'BLOCKING',
    });
    expect(result.checks.find((check) => check.name === 'rating-bands')?.detail).toContain('rating D must use risk category PROHIBITED');
  });

  it('blocks ambiguous active scorecards', async () => {
    mockPrisma.creditRuleConfig.count.mockResolvedValue(1);
    mockPrisma.creditPolicyParameter.count.mockResolvedValue(1);
    mockPrisma.ratingBandConfig.findMany.mockResolvedValue(canonicalBands);
    mockPrisma.creditScorecardVersion.findMany.mockResolvedValue([
      { scorecardId: 'scorecard-1' },
      { scorecardId: 'scorecard-2' },
    ]);
    mockPrisma.riskFactorMatrix.count.mockResolvedValue(1);

    const result = await checkCreditConfigurationHealth();

    expect(result.ready).toBe(false);
    expect(result.checks.find((check) => check.name === 'scorecard-version')).toMatchObject({
      status: 'BLOCKED',
      severity: 'BLOCKING',
      observed: 2,
    });
  });
});
