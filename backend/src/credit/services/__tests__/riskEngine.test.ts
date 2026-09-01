jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    riskFactorMatrix: { findMany: jest.fn().mockResolvedValue([]) },
    riskAssessment: { upsert: jest.fn().mockResolvedValue({ id: 'ra-1' }) },
  },
}));

import {
  computeWeightedRisk,
  classifyRiskLevel,
  getActiveFactorWeights,
  saveRiskAssessment,
  RiskFactorInput,
} from '../riskEngine.service';
import prisma from '../../../utils/prisma';

describe('classifyRiskLevel', () => {
  it('classifies LOW for scores below 30', () => {
    expect(classifyRiskLevel(10)).toBe('LOW');
    expect(classifyRiskLevel(29)).toBe('LOW');
  });
  it('classifies MODERATE for 30-49', () => {
    expect(classifyRiskLevel(30)).toBe('MODERATE');
    expect(classifyRiskLevel(49)).toBe('MODERATE');
  });
  it('classifies HIGH for 50+', () => {
    expect(classifyRiskLevel(50)).toBe('HIGH');
    expect(classifyRiskLevel(74)).toBe('HIGH');
    expect(classifyRiskLevel(100)).toBe('HIGH');
  });
});

describe('computeWeightedRisk', () => {
  const weights = { APPLICANT: 25, INDUSTRY: 15, PRODUCT: 15, DOCUMENTATION: 15, BEHAVIOUR: 15, FRAUD: 15 };

  it('computes a weighted score from factor inputs', () => {
    const inputs: RiskFactorInput[] = [
      { factor: 'APPLICANT', score: 20 },
      { factor: 'INDUSTRY', score: 30 },
      { factor: 'FRAUD', score: 10 },
    ];
    const result = computeWeightedRisk(inputs, weights);
    // 20*0.25 + 30*0.15 + 10*0.15 = 5 + 4.5 + 1.5 = 11
    expect(result.weightedScore).toBe(11);
    expect(result.riskLevel).toBe('LOW');
    expect(result.factorScores).toHaveLength(3);
  });

  it('returns PROHIBITED when any factor score >= 90', () => {
    const inputs: RiskFactorInput[] = [
      { factor: 'APPLICANT', score: 10 },
      { factor: 'FRAUD', score: 95, reasonCode: 'SANCTION_MATCH' },
    ];
    const result = computeWeightedRisk(inputs, weights);
    expect(result.riskLevel).toBe('PROHIBITED');
    expect(result.reasonCodes).toContain('SANCTION_MATCH');
  });

  it('collects reason codes from all factors', () => {
    const inputs: RiskFactorInput[] = [
      { factor: 'APPLICANT', score: 40, reasonCode: 'POOR_CREDIT_HISTORY' },
      { factor: 'INDUSTRY', score: 50, reasonCode: 'DECLINING_SECTOR' },
    ];
    const result = computeWeightedRisk(inputs, weights);
    expect(result.reasonCodes).toEqual(['POOR_CREDIT_HISTORY', 'DECLINING_SECTOR']);
  });

  it('uses default weights when none provided', () => {
    const inputs: RiskFactorInput[] = [
      { factor: 'APPLICANT', score: 100 },
    ];
    const result = computeWeightedRisk(inputs);
    // Default APPLICANT weight is 25 → 100 * 0.25 = 25
    expect(result.weightedScore).toBe(25);
  });
});

describe('getActiveFactorWeights', () => {
  it('returns default weights when no matrix is configured', async () => {
    (prisma.riskFactorMatrix.findMany as jest.Mock).mockResolvedValue([]);
    const weights = await getActiveFactorWeights();
    expect(weights.APPLICANT).toBe(25);
    expect(weights.FRAUD).toBe(15);
  });

  it('reads weights from the DB when configured', async () => {
    (prisma.riskFactorMatrix.findMany as jest.Mock).mockResolvedValue([
      { factor: 'APPLICANT', weight: 40 },
      { factor: 'FRAUD', weight: 30 },
    ]);
    const weights = await getActiveFactorWeights();
    expect(weights.APPLICANT).toBe(40);
    expect(weights.FRAUD).toBe(30);
  });
});

describe('CA-P3-004 — canonical factor enforcement', () => {
  it('re-exports the canonical RiskFactorKey rather than redeclaring it', async () => {
    const engine = await import('../riskEngine.service');
    const taxonomy = await import('../riskTaxonomy');
    expect(engine.RISK_FACTOR_KEYS).toBe(taxonomy.RISK_FACTOR_KEYS);
  });

  it('ignores a non-canonical factor row instead of weighting it', async () => {
    (prisma.riskFactorMatrix.findMany as jest.Mock).mockResolvedValue([
      { factor: 'APPLICANT', weight: 40 },
      { factor: 'APPLICNT', weight: 60 },
    ]);
    const weights = await getActiveFactorWeights();
    expect(weights).toEqual({ APPLICANT: 40 });
    expect(weights).not.toHaveProperty('APPLICNT');
  });

  it('still falls back to defaults when no canonical row survives', async () => {
    (prisma.riskFactorMatrix.findMany as jest.Mock).mockResolvedValue([{ factor: 'NONSENSE', weight: 99 }]);
    const weights = await getActiveFactorWeights();
    expect(Object.keys(weights).sort()).toEqual(
      ['APPLICANT', 'BEHAVIOUR', 'DOCUMENTATION', 'FRAUD', 'INDUSTRY', 'PRODUCT'],
    );
  });
});

describe('saveRiskAssessment', () => {
  it('upserts the risk assessment with factor scores and weighted score', async () => {
    // Use a score high enough to get MODERATE (weightedScore >= 30)
    const result = computeWeightedRisk([
      { factor: 'APPLICANT', score: 80 },
      { factor: 'INDUSTRY', score: 80 },
    ]);
    await saveRiskAssessment('app-1', 'PERFORMANCE', result, 'Test description');
    expect(prisma.riskAssessment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { applicationId_riskCategory: { applicationId: 'app-1', riskCategory: 'PERFORMANCE' } },
        create: expect.objectContaining({
          applicationId: 'app-1',
          riskLevel: 'MODERATE',
        }),
      }),
    );
  });
});