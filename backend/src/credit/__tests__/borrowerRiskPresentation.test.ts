import {
  buildBorrowerRiskPresentation,
  type BorrowerRiskPresentationInput,
} from '../services/borrowerRiskPresentation.service';

const baseInput = (): BorrowerRiskPresentationInput => ({
  riskRun: {
    effectiveRiskRating: 'D',
    baseRiskRating: 'B',
    totalScore: 32.5,
    scorecardVersion: 4,
    runAt: '2026-08-21T10:00:00.000Z',
    missingInputs: ['bureau_score'],
    reasonCodes: [],
    bureauCapsApplied: [],
    factorScores: {
      financial_performance: { score: 75, weight: 20, weightedScore: 15 },
      cashflow: { score: 50, weight: 30, weightedScore: 15 },
    },
  },
  bureau: { stale: false, uploadedAt: '2026-08-20T10:00:00.000Z' },
  applicationReadiness: { ready: true, blockers: [] },
  docCompletionPct: 100,
  compliancePass: true,
  kycVerified: true,
});

describe('borrower risk presentation', () => {
  it('maps bureau_score to a human remediation action and incomplete status', () => {
    const result = buildBorrowerRiskPresentation(baseInput());

    expect(result.ratingStatus).toBe('INCOMPLETE');
    expect(result.effectiveRating).toBe('D');
    expect(result.missingInputs).toEqual([
      expect.objectContaining({
        code: 'bureau_score',
        title: 'Bureau score missing',
        target: 'bureau',
        actionLabel: 'Upload bureau report',
      }),
    ]);
    expect(result.assessmentImpact).toBe('INCOMPLETE');
    expect(result.applicationImpact).toBe('ALLOWED');
  });

  it('returns an explicit not-calculated state when no risk run exists', () => {
    const result = buildBorrowerRiskPresentation({
      ...baseInput(),
      riskRun: null,
    });

    expect(result.ratingStatus).toBe('NOT_CALCULATED');
    expect(result.effectiveRating).toBeNull();
    expect(result.nextAction).toEqual(expect.objectContaining({ target: 'risk' }));
  });

  it('only marks a run decision-ready when all governed prerequisites are current', () => {
    const result = buildBorrowerRiskPresentation({
      ...baseInput(),
      riskRun: { ...baseInput().riskRun!, missingInputs: [] },
    });

    expect(result.ratingStatus).toBe('DECISION_READY');
    expect(result.assessmentImpact).toBe('READY');
  });

  it('marks a stale bureau input incomplete even when the run has no raw missing keys', () => {
    const result = buildBorrowerRiskPresentation({
      ...baseInput(),
      riskRun: { ...baseInput().riskRun!, missingInputs: [] },
      bureau: { stale: true, uploadedAt: '2026-07-01T10:00:00.000Z' },
    });

    expect(result.ratingStatus).toBe('INCOMPLETE');
    expect(result.missingInputs).toEqual([
      expect.objectContaining({ code: 'bureau_report', target: 'bureau' }),
    ]);
  });

  it('normalizes persisted factor scores for calculation explainability', () => {
    const result = buildBorrowerRiskPresentation(baseInput());

    expect(result.factorScores).toEqual([
      { factorKey: 'financial_performance', score: 75, weight: 20, weightedScore: 15 },
      { factorKey: 'cashflow', score: 50, weight: 30, weightedScore: 15 },
    ]);
  });
});