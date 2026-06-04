import { groupForecastByCategory, getForecastAccuracy } from '../services/crm-forecast.service';

// ── groupForecastByCategory ──────────────────────────────────────

describe('groupForecastByCategory', () => {
  const mockOpps = [
    { id: '1', value: 100n, probability: 30, forecastCategory: 'PIPELINE' },
    { id: '2', value: 200n, probability: 60, forecastCategory: 'BEST_CASE' },
    { id: '3', value: 300n, probability: 90, forecastCategory: 'COMMIT' },
    { id: '4', value: 50n,  probability: 10, forecastCategory: 'OMITTED' },
    { id: '5', value: 150n, probability: 60, forecastCategory: 'BEST_CASE' }, // alias
    { id: '6', value: 400n, probability: 50, forecastCategory: 'PIPELINE' },
  ];

  it('groups weighted value by forecast category', () => {
    const result = groupForecastByCategory(mockOpps as any);
    expect(result.PIPELINE.totalValue).toBe(500);   // 100 + 400
    expect(result.PIPELINE.weightedValue).toBe(230); // 100*0.3 + 400*0.5 = 30 + 200
    expect(result.PIPELINE.dealCount).toBe(2);

    expect(result.BEST_CASE.totalValue).toBe(350);   // 200 + 150
    expect(result.COMMIT.totalValue).toBe(300);
    expect(result.OMITTED.totalValue).toBe(50);
  });

  it('returns zero for categories with no deals', () => {
    const result = groupForecastByCategory([] as any);
    expect(result.PIPELINE.totalValue).toBe(0);
    expect(result.COMMIT.dealCount).toBe(0);
  });

  it('handles BEST_CASE as alias for BEST_CASE category', () => {
    const result = groupForecastByCategory(mockOpps as any);
    expect(result.BEST_CASE.dealCount).toBe(2); // both BEST_CASE and BEST_CASE alias
  });
});

// ── getForecastAccuracy ────────────────────────────────────────

describe('getForecastAccuracy', () => {
  it('returns 100% when commit equals actual won', () => {
    const result = getForecastAccuracy(10000, 10000);
    expect(result.accuracyPct).toBe(100);
    expect(result.commitTotal).toBe(10000);
    expect(result.actualWonTotal).toBe(10000);
  });

  it('returns 0% when commit > 0 but actual won = 0', () => {
    const result = getForecastAccuracy(5000, 0);
    expect(result.accuracyPct).toBe(0);
  });

  it('caps at 100% when actual won exceeds commit', () => {
    const result = getForecastAccuracy(5000, 8000);
    expect(result.accuracyPct).toBe(100);
  });

  it('returns 0% when both commit and actual won are zero', () => {
    const result = getForecastAccuracy(0, 0);
    expect(result.accuracyPct).toBe(0);
  });

  it('returns partial accuracy', () => {
    const result = getForecastAccuracy(10000, 7500);
    expect(result.accuracyPct).toBe(75);
  });

  it('rounds to nearest integer', () => {
    const result = getForecastAccuracy(10000, 3333);
    expect(result.accuracyPct).toBe(33);
  });
});