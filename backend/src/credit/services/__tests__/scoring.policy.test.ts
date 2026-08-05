jest.mock('../policyParameter.service', () => ({
  getNumberPolicy: jest.fn(async (_key: string, fallback: number) => fallback),
}));

import { getNumberPolicy } from '../policyParameter.service';
import {
  computeDsrCashflowScore,
  computeFinancialPerformanceScore,
  getScoringThresholds,
} from '../scoring.service';

const mockedGetNumberPolicy = getNumberPolicy as jest.Mock;

describe('scoring policy thresholds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetNumberPolicy.mockImplementation(async (_key: string, fallback: number) => fallback);
  });

  it('loads scoring thresholds from policy parameters with existing defaults', async () => {
    const thresholds = await getScoringThresholds();

    expect(mockedGetNumberPolicy).toHaveBeenCalledWith('scoring.financial_performance.ros.good', 0.15);
    expect(mockedGetNumberPolicy).toHaveBeenCalledWith('scoring.retail_dsr.warn_max', 70);
    expect(thresholds.financialPerformance.ros.good).toBe(0.15);
    expect(thresholds.retailDsr.warnMax).toBe(70);
  });

  it('lets configured financial-performance thresholds change factor scores', async () => {
    mockedGetNumberPolicy.mockImplementation(async (key: string, fallback: number) =>
      key === 'scoring.financial_performance.ros.good' ? 0.30 : fallback,
    );
    const thresholds = await getScoringThresholds();

    const defaultScore = computeFinancialPerformanceScore({ ros: 0.15 });
    const configuredScore = computeFinancialPerformanceScore({ ros: 0.15 }, thresholds.financialPerformance);

    expect(defaultScore).toBe(100);
    expect(configuredScore).toBe(50);
  });

  it('lets configured retail DSR curve change cashflow score', async () => {
    mockedGetNumberPolicy.mockImplementation(async (key: string, fallback: number) =>
      key === 'scoring.retail_dsr.pass_max' ? 50 : fallback,
    );
    const thresholds = await getScoringThresholds();

    const defaultScore = computeDsrCashflowScore(55);
    const configuredScore = computeDsrCashflowScore(55, thresholds.retailDsr);

    expect(defaultScore).toBeCloseTo(81.67, 2);
    expect(configuredScore).toBe(65);
  });
});
