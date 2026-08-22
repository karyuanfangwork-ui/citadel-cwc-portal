import { describe, expect, it } from 'vitest';
import { SubmissionReadinessResult } from '../../../../services/credit.service';
import { buildApplicationReadinessViewModel } from '../applicationReadinessViewModel';

const readiness = (overrides: Partial<SubmissionReadinessResult> = {}): SubmissionReadinessResult => ({
  ready: false,
  errors: [],
  warnings: [],
  satisfied: [],
  ...overrides,
});

describe('buildApplicationReadinessViewModel', () => {
  it('routes a retail income blocker to Financials → Income', () => {
    const viewModel = buildApplicationReadinessViewModel({
      applicationState: 'DRAFT',
      readiness: readiness({ errors: [{ field: 'retailIncome', message: 'Retail income and DSR assessment is required before submission', severity: 'error', target: 'retailIncome', tab: 'financial-profile' }] }),
    });
    expect(viewModel.status).toBe('blocked');
    expect(viewModel.blockers[0]).toMatchObject({ title: 'Complete Retail Income / DSR', targetArea: 'financials', targetLocalTab: 'income', sourceField: 'retailIncome' });
    expect(viewModel.nextAction).toMatchObject({ title: 'Complete Retail Income / DSR', targetArea: 'financials', targetTab: 'income' });
  });

  it('routes required documents to the Documents utility', () => {
    const viewModel = buildApplicationReadinessViewModel({
      applicationState: 'DRAFT',
      readiness: readiness({ errors: [{ field: 'documents', message: 'Required document missing: PAYSLIP', severity: 'error' }] }),
    });
    expect(viewModel.blockers[0]).toMatchObject({ title: 'Upload Payslip', utility: 'documents', targetArea: 'documents', targetLocalTab: 'documents' });
  });

  it('preserves the server order when selecting the first blocker', () => {
    const viewModel = buildApplicationReadinessViewModel({
      applicationState: 'DRAFT',
      readiness: readiness({ errors: [{ field: 'facilities', message: 'Facility is required', severity: 'error', tab: 'facilities' }, { field: 'bureauChecks', message: 'Bureau verification is incomplete', severity: 'error', tab: 'credit-bureau' }] }),
    });
    expect(viewModel.nextAction?.title).toBe('Complete Facilities');
  });

  it('does not repeat a warning when the same field is already a blocker', () => {
    const viewModel = buildApplicationReadinessViewModel({
      applicationState: 'DRAFT',
      readiness: readiness({
        errors: [{ field: 'retailIncome', message: 'Retail income is required', severity: 'error' }],
        warnings: [{ field: 'retailIncome', message: 'Retail income is incomplete', severity: 'warning' }],
      }),
    });
    expect(viewModel.blockers).toHaveLength(1);
    expect(viewModel.warnings).toHaveLength(0);
    expect(viewModel.totalCount).toBe(1);
  });

  it('routes bureau blockers to the Bureau & KYC local tab', () => {
    const viewModel = buildApplicationReadinessViewModel({ applicationState: 'CREDIT_ASSESSMENT', readiness: readiness({ errors: [{ field: 'bureauChecks', message: 'Bureau verification is incomplete', severity: 'error' }] }) });
    expect(viewModel.nextAction).toMatchObject({ targetArea: 'risk-compliance', targetTab: 'bureau-kyc' });
  });

  it('routes the server recommendation blocker to Assessment & Recommendation', () => {
    const viewModel = buildApplicationReadinessViewModel({
      applicationState: 'CREDIT_ASSESSMENT',
      readiness: readiness({ errors: [{ field: 'recommendation', message: 'A submitted recommendation is required', severity: 'error' }] }),
    });
    expect(viewModel.nextAction).toMatchObject({
      targetArea: 'assessment-recommendation',
      targetTab: 'recommendation',
    });
  });

  it('maps core readiness fields to canonical local destinations', () => {
    const viewModel = buildApplicationReadinessViewModel({
      applicationState: 'DRAFT',
      readiness: readiness({ errors: [
        { field: 'retailIncome', message: 'Income required', severity: 'error' },
        { field: 'financials', message: 'Statements required', severity: 'error' },
        { field: 'dscr', message: 'DSCR required', severity: 'error' },
        { field: 'facilities', message: 'Facilities required', severity: 'error' },
        { field: 'bureauChecks', message: 'Bureau required', severity: 'error' },
        { field: 'riskRating', message: 'Rating required', severity: 'error' },
        { field: 'collateral', message: 'Collateral required', severity: 'error' },
        { field: 'fatcaCrs', message: 'FATCA required', severity: 'error' },
      ] }),
    });
    expect(viewModel.blockers.map(item => [item.sourceField, item.targetArea, item.targetLocalTab])).toEqual([
      ['retailIncome', 'financials', 'income'], ['financials', 'financials', 'statements'], ['dscr', 'financials', 'repayment-capacity'],
      ['facilities', 'application-parties', 'facilities'], ['bureauChecks', 'risk-compliance', 'bureau-kyc'], ['riskRating', 'risk-compliance', 'risk-rating'],
      ['collateral', 'risk-compliance', 'collateral-guarantees'], ['fatcaCrs', 'risk-compliance', 'compliance'],
    ]);
  });

  it('does not claim readiness while the authoritative response is unavailable', () => {
    const viewModel = buildApplicationReadinessViewModel({ applicationState: 'DRAFT', readiness: null, readinessError: 'Readiness request failed' });
    expect(viewModel.status).toBe('unavailable');
    expect(viewModel.nextAction).toBeUndefined();
    expect(viewModel.blockers).toHaveLength(0);
  });

  it('represents a warning-only response as ready with warnings', () => {
    const viewModel = buildApplicationReadinessViewModel({ applicationState: 'DRAFT', readiness: readiness({ ready: true, warnings: [{ field: 'fatcaCrs', message: 'FATCA/CRS declaration is pending', severity: 'warning', tab: 'credit-checks-risk' }], satisfied: [{ field: 'application', message: 'Application complete', severity: 'info' }] }) });
    expect(viewModel.status).toBe('warning');
    expect(viewModel.completedCount).toBe(1);
    expect(viewModel.totalCount).toBe(2);
    expect(viewModel.nextAction).toBeUndefined();
  });
});
