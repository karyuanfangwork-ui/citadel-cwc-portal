/**
 * P2-3: SME Financial Service Tests
 *
 * Tests for:
 * - Financial statement type validation (AUDITED/MANAGEMENT/COMPILED)
 * - SME benchmark thresholds
 * - Dual assessment (owner DSR + business DSCR)
 * - Simplified ratio computation
 * - Lane integration (SME lane shows sme-financials tab)
 */

import { smeFinancialService } from '../smeFinancial.service';
import { determineLane, getLaneTabs } from '../lane.service';

// ── Statement Type Validation ────────────────────────────────────────────────

describe('SME Financial Service — Statement Type Validation', () => {
  it('accepts AUDITED for any yearsTrading/amount', () => {
    const result = smeFinancialService.validateFinancialStatementType('AUDITED', 5, 1_000_000);
    expect(result.acceptable).toBe(true);
    expect(result.reason).toContain('Audited');
  });

  it('accepts MANAGEMENT when yearsTrading < 3', () => {
    const result = smeFinancialService.validateFinancialStatementType('MANAGEMENT', 2, 200_000);
    expect(result.acceptable).toBe(true);
    expect(result.reason).toContain('< 3 years');
  });

  it('rejects MANAGEMENT when yearsTrading >= 3 and amount >= 500k', () => {
    const result = smeFinancialService.validateFinancialStatementType('MANAGEMENT', 3, 500_000);
    expect(result.acceptable).toBe(false);
    expect(result.reason).toContain('Audited accounts required');
  });

  it('accepts COMPILED when audited is not required', () => {
    const result = smeFinancialService.validateFinancialStatementType('COMPILED', 2, 200_000);
    expect(result.acceptable).toBe(true);
    expect(result.reason).toContain('Compiled');
  });

  it('rejects COMPILED when audited accounts are required', () => {
    const result = smeFinancialService.validateFinancialStatementType('COMPILED', 5, 1_000_000);
    expect(result.acceptable).toBe(false);
    // When audited is required, only AUDITED is acceptable
  });

  it('accepts MANAGEMENT when yearsTrading is null (unknown)', () => {
    const result = smeFinancialService.validateFinancialStatementType('MANAGEMENT', null, 200_000);
    expect(result.acceptable).toBe(true);
  });

  it('requires AUDITED when yearsTrading >= 3 and amount >= 500k', () => {
    const result = smeFinancialService.validateFinancialStatementType(null, 3, 500_000);
    expect(result.acceptable).toBe(false);
  });

  it('does not require AUDITED when yearsTrading >= 3 but amount < 500k — but MANAGEMENT still not accepted', () => {
    // MANAGEMENT is not accepted for yearsTrading >= 3 regardless of amount
    const result = smeFinancialService.validateFinancialStatementType('MANAGEMENT', 3, 400_000);
    expect(result.acceptable).toBe(false);
  });

  it('does not require AUDITED when yearsTrading < 3', () => {
    const result = smeFinancialService.validateFinancialStatementType('MANAGEMENT', 2, 1_000_000);
    expect(result.acceptable).toBe(true);
  });
});

// ── requiresAuditedAccounts ───────────────────────────────────────────────────

describe('SME Financial Service — requiresAuditedAccounts', () => {
  it('returns false when yearsTrading is null', () => {
    expect(smeFinancialService.requiresAuditedAccounts(null, 1_000_000)).toBe(false);
  });

  it('returns false when yearsTrading < 3', () => {
    expect(smeFinancialService.requiresAuditedAccounts(2, 1_000_000)).toBe(false);
  });

  it('returns true when yearsTrading >= 3 and amount >= 500k', () => {
    expect(smeFinancialService.requiresAuditedAccounts(3, 500_000)).toBe(true);
    expect(smeFinancialService.requiresAuditedAccounts(5, 2_000_000)).toBe(true);
  });

  it('returns false when yearsTrading >= 3 but amount < 500k', () => {
    expect(smeFinancialService.requiresAuditedAccounts(3, 499_999)).toBe(false);
  });

  it('returns false when amount is null', () => {
    expect(smeFinancialService.requiresAuditedAccounts(3, null)).toBe(false);
  });
});

// ── acceptsManagementAccounts ────────────────────────────────────────────────

describe('SME Financial Service — acceptsManagementAccounts', () => {
  it('accepts management when yearsTrading < 3', () => {
    expect(smeFinancialService.acceptsManagementAccounts(2)).toBe(true);
  });

  it('rejects management when yearsTrading >= 3', () => {
    expect(smeFinancialService.acceptsManagementAccounts(3)).toBe(false);
  });

  it('accepts management when yearsTrading is null (unknown)', () => {
    expect(smeFinancialService.acceptsManagementAccounts(null)).toBe(true);
  });
});

// ── Lane Integration ─────────────────────────────────────────────────────────

describe('P2-3 Lane Integration — SME tab includes sme-financials', () => {
  it('SME lane includes sme-financials tab', () => {
    const tabs = getLaneTabs('SME');
    expect(tabs).toContain('sme-financials');
  });

  it('PERSONAL_FAST lane does NOT include sme-financials tab', () => {
    const tabs = getLaneTabs('PERSONAL_FAST');
    expect(tabs).not.toContain('sme-financials');
  });

  it('CORPORATE lane does NOT include sme-financials tab', () => {
    const tabs = getLaneTabs('CORPORATE');
    expect(tabs).not.toContain('sme-financials');
  });

  it('SME lane has more tabs than PERSONAL_FAST', () => {
    const smeTabs = getLaneTabs('SME');
    const pftabs = getLaneTabs('PERSONAL_FAST');
    expect(smeTabs.length).toBeGreaterThan(pftabs.length);
  });
});

// ── Lane Determination ───────────────────────────────────────────────────────

describe('P2-3 Lane Determination — SOLE_PROPRIETOR → SME', () => {
  it('SOLE_PROPRIETOR always maps to SME lane', () => {
    const result = determineLane('SOLE_PROPRIETOR', 500_000, null);
    expect(result.lane).toBe('SME');
    expect(result.reason).toContain('Sole proprietor');
  });

  it('INDIVIDUAL with amount <= 150k maps to PERSONAL_FAST', () => {
    const result = determineLane('INDIVIDUAL', 30_000, null);
    expect(result.lane).toBe('PERSONAL_FAST');
  });

  it('CORPORATE with turnover < 5M maps to SME', () => {
    const result = determineLane('CORPORATE', 500_000, '3000000');
    expect(result.lane).toBe('SME');
  });

  it('CORPORATE with turnover >= 5M maps to CORPORATE', () => {
    const result = determineLane('CORPORATE', 500_000, '5000000');
    expect(result.lane).toBe('CORPORATE');
  });

  it('CORPORATE with no turnover data defaults to CORPORATE', () => {
    const result = determineLane('CORPORATE', 500_000, null);
    expect(result.lane).toBe('CORPORATE');
  });

  it('JOINT always maps to CORPORATE', () => {
    const result = determineLane('JOINT', 100_000, null);
    expect(result.lane).toBe('CORPORATE');
  });
});