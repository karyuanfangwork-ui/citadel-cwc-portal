/**
 * P2-2: Lane Service — Unit Tests
 *
 * Tests lane determination, tab visibility, and approval depth.
 */

import { determineLane, getLaneTabs, getRequiredApproverCount } from '../lane.service';

describe('lane.service — P2-2 Processing Lanes', () => {
  // ── determineLane ────────────────────────────────────────────────────────

  describe('determineLane()', () => {
    it('PERSONAL_FAST: individual borrower, amount <= RM150,000', () => {
      const result = determineLane('INDIVIDUAL', '150000', null);
      expect(result.lane).toBe('PERSONAL_FAST');
      expect(result.reason).toMatch(/individual/i);
    });

    it('PERSONAL_FAST: individual borrower, amount = RM1 (minimum)', () => {
      const result = determineLane('INDIVIDUAL', '1', null);
      expect(result.lane).toBe('PERSONAL_FAST');
    });

    it('CORPORATE lane: individual borrower, amount > RM150,000 (falls through, NOT SME)', () => {
      const result = determineLane('INDIVIDUAL', '200000', null);
      expect(result.lane).toBe('CORPORATE');
    });

    it('SME: sole proprietor (always SME lane)', () => {
      const result = determineLane('SOLE_PROPRIETOR', '100000', null);
      expect(result.lane).toBe('SME');
    });

    it('SME: corporate borrower, turnover < RM5,000,000', () => {
      const result = determineLane('CORPORATE', '500000', '3000000');
      expect(result.lane).toBe('SME');
    });

    it('SME: corporate borrower, turnover = RM4,999,999.99 (boundary)', () => {
      const result = determineLane('CORPORATE', '500000', '4999999.99');
      expect(result.lane).toBe('SME');
    });

    it('CORPORATE: corporate borrower, no turnover data (conservative default)', () => {
      const result = determineLane('CORPORATE', '500000', null);
      expect(result.lane).toBe('CORPORATE');
    });

    it('CORPORATE: corporate borrower, turnover >= RM5,000,000', () => {
      const result = determineLane('CORPORATE', '500000', '5000000');
      expect(result.lane).toBe('CORPORATE');
    });

    it('CORPORATE: joint borrower defaults to CORPORATE', () => {
      const result = determineLane('JOINT', '100000', null);
      expect(result.lane).toBe('CORPORATE');
    });

    it('defaults to CORPORATE for null borrower type', () => {
      const result = determineLane(null as any, '100000', null);
      expect(result.lane).toBe('CORPORATE');
    });

    it('PERSONAL_FAST: amount exactly RM150,000 (boundary inclusive)', () => {
      const result = determineLane('INDIVIDUAL', '150000', null);
      expect(result.lane).toBe('PERSONAL_FAST');
    });

    it('CORPORATE: individual borrower, amount just above RM150,000', () => {
      const result = determineLane('INDIVIDUAL', '150001', null);
      expect(result.lane).toBe('CORPORATE');
    });

    it('SME: sole proprietor with high amount still goes SME', () => {
      const result = determineLane('SOLE_PROPRIETOR', '5000000', null);
      expect(result.lane).toBe('SME');
    });
  });

  // ── getRequiredApproverCount ─────────────────────────────────────────────

  describe('getRequiredApproverCount()', () => {
    it('returns 2 for PERSONAL_FAST', () => {
      expect(getRequiredApproverCount('PERSONAL_FAST')).toBe(2);
    });

    it('returns 2 for SME', () => {
      expect(getRequiredApproverCount('SME')).toBe(2);
    });

    it('returns -1 for CORPORATE (use matrix)', () => {
      expect(getRequiredApproverCount('CORPORATE')).toBe(-1);
    });
  });

  // ── getLaneTabs ──────────────────────────────────────────────────────────

  describe('getLaneTabs()', () => {
    const allFlagsEnabled: Record<string, boolean> = {
      'credit:ecl': true,
      'credit:profitability': true,
      'credit:counterparties': true,
      'credit:account_conduct': true,
      'credit:esg': true,
      'credit:advanced_memo': true,
    };
    const noFlagsEnabled: Record<string, boolean> = {};

    it('PERSONAL_FAST returns core tabs only + summary', () => {
      const tabs = getLaneTabs('PERSONAL_FAST', noFlagsEnabled);
      expect(tabs).toContain('loan-request');
      expect(tabs).toContain('borrower-profile');
      expect(tabs).toContain('financials');
      expect(tabs).toContain('credit-checks');
      expect(tabs).toContain('signoff');
      expect(tabs).toContain('documents');
      expect(tabs).toContain('summary');
      // Should NOT contain SME/corporate tabs
      expect(tabs).not.toContain('collateral');
      expect(tabs).not.toContain('parties');
      expect(tabs).not.toContain('approvals');
    });

    it('SME returns core + SME tabs', () => {
      const tabs = getLaneTabs('SME', noFlagsEnabled);
      expect(tabs).toContain('loan-request');
      expect(tabs).toContain('collateral');
      expect(tabs).toContain('security-guarantees');
      expect(tabs).toContain('risk-score');
      // Should NOT contain corporate-only tabs
      expect(tabs).not.toContain('parties');
      expect(tabs).not.toContain('approvals');
      expect(tabs).not.toContain('audit');
    });

    it('CORPORATE returns all tabs (no feature flags)', () => {
      const tabs = getLaneTabs('CORPORATE', noFlagsEnabled);
      expect(tabs).toContain('loan-request');
      expect(tabs).toContain('collateral');
      expect(tabs).toContain('parties');
      expect(tabs).toContain('approvals');
      expect(tabs).toContain('audit');
      // Bank-grade tabs still hidden without flags
      expect(tabs).not.toContain('risk-rating');
      expect(tabs).not.toContain('profitability');
    });

    it('feature flags enable bank-grade tabs in CORPORATE lane', () => {
      const tabs = getLaneTabs('CORPORATE', allFlagsEnabled);
      expect(tabs).toContain('risk-rating');
      expect(tabs).toContain('profitability');
      expect(tabs).toContain('counterparties');
      expect(tabs).toContain('conduct');
      expect(tabs).toContain('forward-looking-risk');
    });

    it('feature flags do not add bank-grade tabs to PERSONAL_FAST', () => {
      const tabs = getLaneTabs('PERSONAL_FAST', allFlagsEnabled);
      // Even with flags, PERSONAL_FAST should still not have corporate tabs
      expect(tabs).not.toContain('parties');
      expect(tabs).not.toContain('audit');
      // But bank-grade flags can add their tabs (e.g. risk-rating)
      expect(tabs).toContain('risk-rating');
    });
  });
});