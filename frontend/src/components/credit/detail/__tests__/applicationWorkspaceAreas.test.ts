import { describe, expect, it } from 'vitest';
import { ALL_TABS } from '../../../../../pages/credit/creditUtils';
import {
  APPLICATION_WORKSPACE_AREAS,
  getVisibleWorkspaceLocalTabs,
  getWorkspaceArea,
  resolveWorkspaceAreaFromTab,
  resolveWorkspaceLocationFromQuery,
  resolveWorkspaceLocationFromTab,
} from '../applicationWorkspaceAreas';

describe('application workspace area metadata', () => {
  it('exposes the canonical local tabs for the three core working areas', () => {
    expect(getWorkspaceArea('application-parties').localTabs.map(tab => tab.label)).toEqual([
      'Application', 'Facilities', 'Borrower', 'Related Parties',
    ]);
    expect(getWorkspaceArea('financials').localTabs.map(tab => tab.label)).toEqual([
      'Income', 'Statements', 'Spreading', 'Ratios & Trends', 'Repayment Capacity',
    ]);
    expect(getWorkspaceArea('risk-compliance').localTabs.map(tab => tab.label)).toEqual([
      'Bureau & KYC', 'Risk Rating', 'Collateral & Guarantees', 'Compliance / Exceptions',
    ]);
  });

  it('filters local tabs by borrower type and lane without using readiness', () => {
    expect(getVisibleWorkspaceLocalTabs('financials', 'INDIVIDUAL', 'PERSONAL_FAST', {} ).map(tab => tab.id))
      .toEqual(['income', 'repayment-capacity']);
    expect(getVisibleWorkspaceLocalTabs('financials', 'SOLE_PROPRIETOR', 'SME', {}).map(tab => tab.id))
      .toEqual(['statements', 'spreading', 'ratios-trends', 'repayment-capacity']);
    expect(getVisibleWorkspaceLocalTabs('financials', 'CORPORATE', 'CORPORATE', {}).map(tab => tab.id))
      .toEqual(['statements', 'spreading', 'ratios-trends', 'repayment-capacity']);
    expect(getVisibleWorkspaceLocalTabs('application-parties', 'INDIVIDUAL', 'PERSONAL_FAST', {}).map(tab => tab.id))
      .toEqual(['application', 'facilities', 'borrower']);
  });
  it('exposes six primary areas followed by Documents and Activity & Audit utilities', () => {
    expect(APPLICATION_WORKSPACE_AREAS.map(area => area.id)).toEqual([
      'overview',
      'application-parties',
      'financials',
      'risk-compliance',
      'assessment-recommendation',
      'decision-completion',
      'documents',
      'activity-audit',
    ]);

    expect(APPLICATION_WORKSPACE_AREAS.slice(0, 6).every(area => area.type === 'primary')).toBe(true);
    expect(APPLICATION_WORKSPACE_AREAS.slice(6).every(area => area.type === 'utility')).toBe(true);
  });

  it.each([
    ['overview', 'overview'],
    ['loan-request', 'application-parties'],
    ['facilities', 'application-parties'],
    ['customer-profile', 'application-parties'],
    ['financials', 'financials'],
    ['sme-financials', 'financials'],
    ['risk-assessment', 'risk-compliance'],
    ['risk-score', 'risk-compliance'],
    ['risk-rating', 'risk-compliance'],
    ['approvals', 'decision-completion'],
    ['documents', 'documents'],
    ['audit', 'activity-audit'],
  ] as const)('resolves %s to %s', (tab, expectedArea) => {
    expect(resolveWorkspaceAreaFromTab(tab)).toBe(expectedArea);
  });

  it('preserves the canonical renderer tab while retaining legacy source information', () => {
    expect(resolveWorkspaceLocationFromTab('loan-request')).toEqual({
      area: 'application-parties',
      tab: 'application-details',
      localTab: 'application',
      legacyTab: 'loan-request',
    });
  });

  it('resolves every existing legacy tab ID without falling out of the workspace', () => {
    for (const tab of ALL_TABS) {
      expect(APPLICATION_WORKSPACE_AREAS.some(area => area.id === resolveWorkspaceLocationFromTab(tab).area)).toBe(true);
    }
  });

  it('falls back to Overview for an unknown tab', () => {
    expect(resolveWorkspaceLocationFromTab('not-a-real-tab')).toEqual({
      area: 'overview',
      tab: 'overview',
    });
  });

  it('uses the canonical area query to disambiguate shared legacy renderer tabs', () => {
    expect(resolveWorkspaceLocationFromQuery('approvals', 'assessment-recommendation')).toEqual({
      area: 'assessment-recommendation',
      tab: 'approvals',
      localTab: 'recommendation',
    });
  });

  it.each([
    ['approvals', 'assessment-recommendation', 'recommendation'],
    ['ca-memo', 'assessment-recommendation', 'ca-memo'],
    ['risk-assessment', 'assessment-recommendation', 'deviations-mitigants'],
    ['signoff', 'decision-completion', 'approvals'],
    ['conditions', 'decision-completion', 'conditions-offer'],
    ['summary', 'decision-completion', 'conditions-offer'],
    ['disbursement', 'decision-completion', 'completion'],
    ['audit', 'decision-completion', 'decision-history'],
  ] as const)('maps Phase 4 alias %s to %s/%s', (tab, area, localTab) => {
    expect(resolveWorkspaceLocationFromQuery(tab, area)).toMatchObject({ area, localTab });
  });

  it('exposes canonical Phase 4 local destinations', () => {
    expect(getWorkspaceArea('assessment-recommendation').localTabs.map(tab => tab.id)).toEqual([
      'assessment', 'deviations-mitigants', 'recommendation', 'ca-memo',
    ]);
    expect(getWorkspaceArea('decision-completion').localTabs.map(tab => tab.id)).toEqual([
      'approvals', 'decision-history', 'conditions-offer', 'completion',
    ]);
  });
});
