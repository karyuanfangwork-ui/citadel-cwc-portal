import { bureauFreshness, computeIncomeDsr, scoreBandFor } from '../borrowerCreditData.service';
import { buildAlerts, computeDocumentCompletion } from '../borrowerSummary.service';

describe('borrower 360 pure helpers', () => {
  it('maps score to band', () => {
    expect(scoreBandFor(785)).toBe('Excellent');
    expect(scoreBandFor(700)).toBe('Good');
    expect(scoreBandFor(620)).toBe('Fair');
    expect(scoreBandFor(500)).toBe('Poor');
  });

  it('computes gross and net DSR from income inputs', () => {
    const result = computeIncomeDsr({
      monthlyGrossIncome: 18500,
      epfMonthlyAmount: 0,
      monthlyTaxDeduction: 0,
      monthlySocsoDeduction: 0,
      hirePurchaseCommitment: 1850,
      creditCardCommitment: 550,
      existingLoanCommitment: 3520,
      otherCommitments: 0,
    });

    expect(Math.round(result.dsrPercent)).toBe(32);
    expect(Math.round(result.netDsrPercent)).toBe(32);
    expect(result.netIncome).toBe(18500);
    expect(result.dsrBasis).toBe('NET');
  });

  it('flags bureau freshness correctly', () => {
    const now = new Date('2026-06-20T00:00:00Z');
    expect(bureauFreshness(new Date('2026-01-01T00:00:00Z'), now).stale).toBe(true);
    expect(bureauFreshness(new Date('2026-06-10T00:00:00Z'), now)).toEqual({ days: 10, stale: false });
    expect(bureauFreshness(null).stale).toBe(true);
  });

  it('builds bureau and missing-doc alerts', () => {
    const alerts = buildAlerts({ bureauStale: true, missingDocs: true });
    expect(alerts.some((alert) => alert.title.toLowerCase().includes('bureau'))).toBe(true);
    expect(alerts[0].actionLabel).toBe('Upload Bureau Report');
    expect(alerts.some((alert) => alert.title.toLowerCase().includes('document'))).toBe(true);
  });

  it('computes checklist completion from required borrower docs', () => {
    const individual = computeDocumentCompletion('INDIVIDUAL', [
      { classification: 'NRIC_PASSPORT', verificationStatus: 'VERIFIED' },
      { classification: 'PAYSLIP', verificationStatus: 'VERIFIED' },
      { classification: 'BANK_STATEMENT', verificationStatus: 'PENDING' },
      { classification: 'OTHER', verificationStatus: 'VERIFIED' },
    ]);

    expect(individual).toEqual(
      expect.objectContaining({
        requiredCount: 3,
        collectedCount: 2,
        completionPct: 67,
      }),
    );

    const corporate = computeDocumentCompletion('CORPORATE', [
      { classification: 'MEMORANDUM_ARTICLES', verificationStatus: 'VERIFIED' },
      { classification: 'SSM_CERT', verificationStatus: 'VERIFIED' },
      { classification: 'BOARD_RESOLUTION', verificationStatus: 'VERIFIED' },
      { classification: 'AUTHORIZED_SIGNATORY', verificationStatus: 'PENDING' },
    ]);

    expect(corporate.requiredCount).toBe(6);
    expect(corporate.collectedCount).toBe(3);
    expect(corporate.outstandingGroups.length).toBe(3);
  });
});
