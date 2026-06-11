import { computeNetDsr, getNetDsrStatus, computeDsr, getDsrStatus } from '../credit/services/retailIncome.service';

// ── computeNetDsr ─────────────────────────────────────────────────────────

describe('P1-3: Net-income DSR', () => {
  describe('computeNetDsr', () => {
    it('should compute net-DSR with EPF + tax + SOCSO deductions', () => {
      const result = computeNetDsr({
        monthlyGrossIncome: 10000,
        hirePurchaseCommitment: 1500,
        creditCardCommitment: 500,
        existingLoanCommitment: 0,
        otherCommitments: 0,
        proposedInstalment: 1000,
        epfMonthlyAmount: 1100,   // 11% EPF
        monthlyTaxDeduction: 150, // MTD
        monthlySocsoDeduction: 50, // SOCSO + EIS
      });

      // Net income = 10000 - 1100 - 150 - 50 = 8700
      // Total commitments = 1500 + 500 + 0 + 0 + 1000 = 3000
      // Gross DSR = 3000/10000 * 100 = 30%
      // Net DSR = 3000/8700 * 100 = 34.48%
      expect(result.netIncome).toBe(8700);
      expect(result.grossDsrPercent).toBeCloseTo(30, 1);
      expect(result.netDsrPercent).toBeCloseTo(34.48, 1);
      expect(result.dsrBasis).toBe('NET');
      expect(result.dsrStatus).toBe('pass'); // 34.48% ≤ 50%
    });

    it('should return warning status when net-DSR is 50-60%', () => {
      const result = computeNetDsr({
        monthlyGrossIncome: 10000,
        hirePurchaseCommitment: 3000,
        creditCardCommitment: 1000,
        existingLoanCommitment: 0,
        otherCommitments: 0,
        proposedInstalment: 1000,
        epfMonthlyAmount: 1100,
        monthlyTaxDeduction: 150,
        monthlySocsoDeduction: 50,
      });

      // Net income = 8700, commitments = 5000
      // Net DSR = 5000/8700 * 100 = 57.47%
      expect(result.dsrStatus).toBe('warning'); // 50 < 57.47 ≤ 60
      expect(result.netDsrPercent).toBeCloseTo(57.47, 1);
    });

    it('should return fail status when net-DSR exceeds 60%', () => {
      const result = computeNetDsr({
        monthlyGrossIncome: 5000,
        hirePurchaseCommitment: 2000,
        creditCardCommitment: 1000,
        existingLoanCommitment: 500,
        otherCommitments: 0,
        proposedInstalment: 500,
        epfMonthlyAmount: 550,  // 11% EPF
        monthlyTaxDeduction: 100,
        monthlySocsoDeduction: 25,
      });

      // Net income = 5000 - 550 - 100 - 25 = 4325
      // Commitments = 4000
      // Net DSR = 4000/4325 * 100 = 92.49%
      expect(result.dsrStatus).toBe('fail'); // >60%
      expect(result.netDsrPercent).toBeGreaterThan(60);
    });

    it('should fall back to GROSS basis when net income is zero or negative', () => {
      const result = computeNetDsr({
        monthlyGrossIncome: 3000,
        hirePurchaseCommitment: 500,
        creditCardCommitment: 0,
        existingLoanCommitment: 0,
        otherCommitments: 0,
        proposedInstalment: 800,
        epfMonthlyAmount: 2000,  // Deductions exceed income
        monthlyTaxDeduction: 1500,
        monthlySocsoDeduction: 500,
      });

      // Net income = 3000 - 2000 - 1500 - 500 = -1000 (negative)
      // Net DSR = 9999 (infinite)
      expect(result.netIncome).toBeLessThan(0);
      expect(result.dsrBasis).toBe('GROSS'); // Fallback to gross
      expect(result.netDsrPercent).toBe(9999); // Infinite DSR
      expect(result.dsrStatus).toBe('fail');
    });

    it('should handle zero deductions (pure gross-DSR scenario)', () => {
      const result = computeNetDsr({
        monthlyGrossIncome: 8000,
        hirePurchaseCommitment: 2000,
        creditCardCommitment: 0,
        existingLoanCommitment: 0,
        otherCommitments: 0,
        proposedInstalment: 1000,
        epfMonthlyAmount: 0,
        monthlyTaxDeduction: 0,
        monthlySocsoDeduction: 0,
      });

      // Net income = 8000 (no deductions)
      // Net DSR = 3000/8000 * 100 = 37.5%
      expect(result.netIncome).toBe(8000);
      expect(result.netDsrPercent).toBeCloseTo(37.5, 1);
      expect(result.dsrStatus).toBe('pass');
    });

    it('should produce net-DSR always >= gross-DSR (since net income <= gross)', () => {
      const result = computeNetDsr({
        monthlyGrossIncome: 10000,
        hirePurchaseCommitment: 2000,
        creditCardCommitment: 0,
        existingLoanCommitment: 0,
        otherCommitments: 0,
        proposedInstalment: 1000,
        epfMonthlyAmount: 1100,
        monthlyTaxDeduction: 300,
        monthlySocsoDeduction: 50,
      });

      // Gross DSR = 3000/10000 = 30%
      // Net DSR = 3000/8550 = 35.09%
      expect(result.netDsrPercent).toBeGreaterThanOrEqual(result.grossDsrPercent);
    });
  });

  // ── getNetDsrStatus ──────────────────────────────────────────────────────

  describe('getNetDsrStatus', () => {
    it('should return pass for net-DSR ≤50%', () => {
      expect(getNetDsrStatus(30)).toBe('pass');
      expect(getNetDsrStatus(50)).toBe('pass');
      expect(getNetDsrStatus(49.9)).toBe('pass');
    });

    it('should return warning for net-DSR 50-60%', () => {
      expect(getNetDsrStatus(55)).toBe('warning');
      expect(getNetDsrStatus(60)).toBe('warning');
      expect(getNetDsrStatus(50.01)).toBe('warning');
    });

    it('should return fail for net-DSR >60%', () => {
      expect(getNetDsrStatus(60.01)).toBe('fail');
      expect(getNetDsrStatus(80)).toBe('fail');
      expect(getNetDsrStatus(100)).toBe('fail');
    });
  });

  // ── Backward compat: gross DSR unchanged ──────────────────────────────────

  describe('computeDsr (gross, backward compat)', () => {
    it('should still compute gross DSR correctly', () => {
      const grossDsr = computeDsr({
        monthlyGrossIncome: 10000,
        hirePurchaseCommitment: 2000,
        creditCardCommitment: 500,
        existingLoanCommitment: 0,
        otherCommitments: 0,
        proposedInstalment: 1000,
      });
      // Total = 3500, DSR = 35%
      expect(grossDsr).toBeCloseTo(35, 1);
    });
  });

  describe('getDsrStatus (gross, backward compat)', () => {
    it('should still use gross thresholds (60/70)', () => {
      expect(getDsrStatus(50)).toBe('pass');
      expect(getDsrStatus(60)).toBe('pass');
      expect(getDsrStatus(65)).toBe('warning');
      expect(getDsrStatus(70)).toBe('warning');
      expect(getDsrStatus(71)).toBe('fail');
    });
  });

  // ── Malaysia realistic scenario ────────────────────────────────────────────

  describe('Malaysia realistic salary scenario', () => {
    it('should compute correct net-DSR for a typical RM5,000 salary', () => {
      // Typical Malaysian salary scenario
      const result = computeNetDsr({
        monthlyGrossIncome: 5000,
        hirePurchaseCommitment: 800,   // Car loan
        creditCardCommitment: 300,     // Minimum payment
        existingLoanCommitment: 0,
        otherCommitments: 0,
        proposedInstalment: 600,       // New personal loan
        epfMonthlyAmount: 550,         // 11% employee EPF
        monthlyTaxDeduction: 50,       // MTD (low bracket)
        monthlySocsoDeduction: 20,    // SOCSO + EIS
      });

      // Net income = 5000 - 550 - 50 - 20 = 4380
      // Commitments = 800 + 300 + 0 + 0 + 600 = 1700
      // Gross DSR = 1700/5000 * 100 = 34%
      // Net DSR = 1700/4380 * 100 = 38.82%
      expect(result.netIncome).toBe(4380);
      expect(result.grossDsrPercent).toBeCloseTo(34, 1);
      expect(result.netDsrPercent).toBeCloseTo(38.82, 1);
      expect(result.dsrStatus).toBe('pass'); // 38.82% ≤ 50%
      expect(result.dsrBasis).toBe('NET');
    });
  });
});