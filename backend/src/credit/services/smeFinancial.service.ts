/**
 * P2-3: SME Financial Assessment Service
 *
 * Provides simplified financial assessment for SME borrowers:
 * - Sole proprietors: dual assessment (owner DSR + business DSCR)
 * - Sdn Bhd with <3 years trading: accept management/compiled accounts
 * - SME-calibrated benchmarks (lower DSCR threshold, 2-year history sufficient)
 */

import prisma from '../../utils/prisma';
import { BorrowerType, SmeFinancialStatementType } from '@prisma/client';
import { getNumberPolicy } from './policyParameter.service';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SmeFinancialRatio {
  key: string;
  label: string;
  value: number | null;
  unit: 'x' | '%' | 'days';
  benchmark: SmeBenchmark;
  status: 'pass' | 'warn' | 'fail';
}

export interface SmeBenchmark {
  passThreshold: number;
  warnThreshold: number;
  direction: 'higher_is_better' | 'lower_is_better';
}

export interface DualAssessment {
  ownerDsr: {
    monthlyGrossIncome: number;
    monthlyNetIncome: number | null;
    totalCommitments: number;
    dsrPercent: number | null;
    netDsrPercent: number | null;
    status: 'pass' | 'warn' | 'fail';
  } | null;
  businessDscr: {
    netIncome: number;
    depreciation: number;
    interest: number;
    principal: number;
    ebitda: number;
    dscr: number | null;
    status: 'pass' | 'warn' | 'fail';
  } | null;
  overallStatus: 'pass' | 'warn' | 'fail';
  smeLane: 'SME';
}

export interface SmeFinancialAssessment {
  borrowerProfileId: string;
  borrowerType: BorrowerType;
  annualTurnover: number | null;
  yearsTrading: number | null;
  smeFinancialStatementType: SmeFinancialStatementType | null;
  sicCode: string | null;
  requiresAudited: boolean;
  acceptsManagement: boolean;
  simplifiedRatios: SmeFinancialRatio[];
  dualAssessment: DualAssessment | null;
}

// ── SME Benchmarks ───────────────────────────────────────────────────────────
// SME-calibrated: lower DSCR threshold (1.1x vs 1.25x corporate)
// 2-year history sufficient (vs 3-year for corporate)

const SME_DSCR_BENCHMARK: SmeBenchmark = {
  passThreshold: 1.1,
  warnThreshold: 1.0,
  direction: 'higher_is_better',
};

const SME_DSR_BENCHMARK: SmeBenchmark = {
  passThreshold: 60,   // 60% DSR is acceptable for SME
  warnThreshold: 70,   // 70% DSR is warning
  direction: 'lower_is_better',
};

const SME_CURRENT_RATIO_BENCHMARK: SmeBenchmark = {
  passThreshold: 1.2,
  warnThreshold: 1.0,
  direction: 'higher_is_better',
};

const SME_GEARING_BENCHMARK: SmeBenchmark = {
  passThreshold: 0.70, // 70% is acceptable for SME (vs 60% corporate)
  warnThreshold: 0.85,
  direction: 'lower_is_better',
};

const SME_ROS_BENCHMARK: SmeBenchmark = {
  passThreshold: 0.03, // 3% net margin acceptable for SME
  warnThreshold: 0.01,
  direction: 'higher_is_better',
};

const SME_DSCR_CORPORATE_BENCHMARK: SmeBenchmark = {
  passThreshold: 1.25,
  warnThreshold: 1.0,
  direction: 'higher_is_better',
};

const SME_DEBT_TO_EQUITY_BENCHMARK: SmeBenchmark = {
  passThreshold: 1.5,
  warnThreshold: 2.0,
  direction: 'lower_is_better',
};

// ── SME Simplified Ratio Set ─────────────────────────────────────────────────
// Fewer ratios than corporate — focus on key credit metrics

const SME_SIMPLIFIED_RATIO_KEYS = [
  'dscr',
  'current_ratio',
  'gearing_ratio',
  'ros',
  'debt_to_equity',
];

// ── Service ───────────────────────────────────────────────────────────────────

class SmeFinancialService {
  /**
   * Get full SME financial assessment for a borrower profile.
   * For SOLE_PROPRIETOR: includes dual assessment (owner DSR + business DSCR).
   * For CORPORATE SME: simplified ratios only.
   */
  async getSmeAssessment(borrowerProfileId: string): Promise<SmeFinancialAssessment> {
    const profile = await prisma.borrowerProfile.findUnique({
      where: { id: borrowerProfileId },
      select: {
        id: true,
        borrowerType: true,
        annualTurnover: true,
        yearsTrading: true,
        smeFinancialStatementType: true,
        sicCode: true,
      },
    });

    if (!profile) {
      throw new Error(`Borrower profile ${borrowerProfileId} not found`);
    }

    const annualTurnover = profile.annualTurnover ? Number(profile.annualTurnover) : null;
    const yearsTrading = profile.yearsTrading;
    const smeFinancialStatementType = profile.smeFinancialStatementType;
    const sicCode = profile.sicCode;

    // Determine financial statement type requirements
    const requiresAudited = await this.requiresAuditedAccountsConfigured(yearsTrading, annualTurnover);
    const acceptsManagement = this.acceptsManagementAccounts(yearsTrading);

    // Get simplified ratios from financial statements
    const simplifiedRatios = await this.computeSimplifiedRatios(borrowerProfileId);

    // Compute dual assessment for sole proprietors
    let dualAssessment: DualAssessment | null = null;
    if (profile.borrowerType === 'SOLE_PROPRIETOR') {
      dualAssessment = await this.computeDualAssessment(borrowerProfileId);
    }

    return {
      borrowerProfileId: profile.id,
      borrowerType: profile.borrowerType,
      annualTurnover,
      yearsTrading,
      smeFinancialStatementType,
      sicCode,
      requiresAudited,
      acceptsManagement,
      simplifiedRatios,
      dualAssessment,
    };
  }

  /**
   * Determine whether the borrower requires audited financial statements.
   * Rule: audited required when yearsTrading >= 3 AND amount >= RM500k
   */
  requiresAuditedAccounts(
    yearsTrading: number | null,
    annualAmount: number | null,
  ): boolean {
    if (yearsTrading === null) return false; // No data → accept management
    if (yearsTrading < 3) return false;      // < 3 years → accept management
    // >= 3 years trading AND amount >= 500k → audited required
    return annualAmount !== null && annualAmount >= 500_000;
  }

  async requiresAuditedAccountsConfigured(
    yearsTrading: number | null,
    annualAmount: number | null,
  ): Promise<boolean> {
    const [yearsTradingMin, amountMin] = await Promise.all([
      getNumberPolicy('sme.audited_accounts.years_trading_min', 3),
      getNumberPolicy('sme.audited_accounts.amount_min', 500_000),
    ]);

    if (yearsTrading === null) return false;
    if (yearsTrading < yearsTradingMin) return false;
    return annualAmount !== null && annualAmount >= amountMin;
  }

  /**
   * Compute simplified ratios for an SME borrower.
   * Uses the corporate financial statement data but applies SME-calibrated benchmarks.
   */
  async computeSimplifiedRatios(borrowerProfileId: string): Promise<SmeFinancialRatio[]> {
    // Fetch the most recent financial statements (BS and PL)
    const statements = await prisma.financialStatement.findMany({
      where: {
        borrowerProfileId,
        deletedAt: null,
        statementType: { in: ['BS', 'PL'] },
        status: { in: ['REVIEWED', 'APPROVED'] },
      },
      orderBy: { fiscalYearEnd: 'desc' },
      take: 2, // Most recent year
      include: {
        lineItems: { orderBy: { displayOrder: 'asc' } },
        ratios: true,
      },
    });

    if (statements.length === 0) {
      return this.getDefaultSimplifiedRatios();
    }

    // Get the latest ratios from the most recent statement
    const latestStatement = statements[0];
    const ratios = latestStatement.ratios;

    const ratioMap = new Map(ratios.map(r => [r.ratioKey, Number(r.value)]));

    return Promise.all(SME_SIMPLIFIED_RATIO_KEYS.map(async (rk) => {
      const value = ratioMap.get(rk) ?? null;
      const benchmark = await this.getSmeBenchmark(rk);
      const status = this.evaluateRatio(rk, value, benchmark);
      return {
        key: rk,
        label: this.getRatioLabel(rk),
        value,
        unit: this.getRatioUnit(rk),
        benchmark,
        status,
      };
    }));
  }

  /**
   * Compute dual assessment for SOLE_PROPRIETOR:
   * - Owner DSR from RetailIncome (personal commitments)
   * - Business DSCR from financial statements (business ratios)
   */
  async computeDualAssessment(borrowerProfileId: string): Promise<DualAssessment> {
    // ── Owner DSR from RetailIncome ──
    let ownerDsr: DualAssessment['ownerDsr'] = null;

    // Find the application linked to this borrower profile
    const application = await prisma.creditApplication.findFirst({
      where: { borrowerProfileId },
      select: { id: true },
    });

    if (application) {
      const retailIncome = await prisma.retailIncome.findUnique({
        where: { applicationId: application.id },
      });

      if (retailIncome) {
        const monthlyGross = Number(retailIncome.monthlyGrossIncome);
        const totalCommitments =
          Number(retailIncome.hirePurchaseCommitment) +
          Number(retailIncome.creditCardCommitment) +
          Number(retailIncome.existingLoanCommitment) +
          Number(retailIncome.otherCommitments);

        const dsrPercent = monthlyGross > 0
          ? (totalCommitments / monthlyGross) * 100
          : null;

        const monthlyNet = retailIncome.monthlyNetIncome
          ? Number(retailIncome.monthlyNetIncome)
          : null;
        const netDsrPercent = monthlyNet && monthlyNet > 0
          ? (totalCommitments / monthlyNet) * 100
          : null;

        const dsrStatus = this.evaluateDsr(dsrPercent, await this.getSmeBenchmark('dsr'));

        ownerDsr = {
          monthlyGrossIncome: monthlyGross,
          monthlyNetIncome: monthlyNet,
          totalCommitments,
          dsrPercent,
          netDsrPercent,
          status: dsrStatus,
        };
      }
    }

    // ── Business DSCR from financial statements ──
    let businessDscr: DualAssessment['businessDscr'] = null;

    const plStatement = await prisma.financialStatement.findFirst({
      where: {
        borrowerProfileId,
        deletedAt: null,
        statementType: 'PL',
        status: { in: ['REVIEWED', 'APPROVED'] },
      },
      orderBy: { fiscalYearEnd: 'desc' },
      include: {
        lineItems: { orderBy: { displayOrder: 'asc' } },
      },
    });

    if (plStatement) {
      const lineItemMap = new Map(
        plStatement.lineItems.map(li => [li.lineKey, Number(li.amount)]),
      );

      const netIncome = lineItemMap.get('net_income') ?? 0;
      const depreciation = lineItemMap.get('depreciation') ?? 0;
      const interest = lineItemMap.get('interest') ?? 0;
      const principal = lineItemMap.get('principal') ?? 0;
      const ebitda = netIncome + depreciation + interest;

      const dscr = (interest + principal) > 0
        ? ebitda / (interest + principal)
        : null;

      const dscrStatus = this.evaluateDscr(dscr, await this.getSmeBenchmark('dscr'));

      businessDscr = {
        netIncome,
        depreciation,
        interest,
        principal,
        ebitda,
        dscr,
        status: dscrStatus,
      };
    }

    // Overall status: worst of owner DSR and business DSCR
    const overallStatus = this.evaluateOverallStatus(ownerDsr?.status, businessDscr?.status);

    return {
      ownerDsr,
      businessDscr,
      overallStatus,
      smeLane: 'SME',
    };
  }

  /**
   * Determine whether management accounts are accepted.
   * Rule: management accounts accepted when yearsTrading < 3
   * Note: even when audited is not required (amount < 500k), management
   * accounts are only accepted if yearsTrading < 3 per regulatory guidance.
   */
  acceptsManagementAccounts(yearsTrading: number | null): boolean {
    if (yearsTrading === null) return true; // No data → accept management
    return yearsTrading < 3;
  }

  /**
   * Validate whether a given financial statement type is acceptable for the borrower.
   * Returns { acceptable: boolean; reason: string }.
   */
  validateFinancialStatementType(
    smeFinancialStatementType: SmeFinancialStatementType | null,
    yearsTrading: number | null,
    annualAmount: number | null,
  ): { acceptable: boolean; reason: string } {
    const requiresAudited = this.requiresAuditedAccounts(yearsTrading, annualAmount);

    if (requiresAudited) {
      if (smeFinancialStatementType !== 'AUDITED') {
        return {
          acceptable: false,
          reason: `Audited accounts required (yearsTrading >= 3 and amount >= RM500k). Got: ${smeFinancialStatementType ?? 'not specified'}`,
        };
      }
      return { acceptable: true, reason: 'Audited accounts provided — requirement met' };
    }

    // Not required to be audited — check if MANAGEMENT is acceptable
    if (smeFinancialStatementType === 'MANAGEMENT') {
      if (this.acceptsManagementAccounts(yearsTrading)) {
        return { acceptable: true, reason: 'Management accounts accepted (< 3 years trading)' };
      }
      return {
        acceptable: false,
        reason: 'Management accounts not accepted for >= 3 years trading without audited accounts',
      };
    }

    if (smeFinancialStatementType === 'COMPILED') {
      return { acceptable: true, reason: 'Compiled accounts accepted for SME' };
    }

    if (smeFinancialStatementType === 'AUDITED') {
      return { acceptable: true, reason: 'Audited accounts always acceptable' };
    }

    return { acceptable: true, reason: 'No specific requirement' };
  }

  async validateFinancialStatementTypeConfigured(
    smeFinancialStatementType: SmeFinancialStatementType | null,
    yearsTrading: number | null,
    annualAmount: number | null,
  ): Promise<{ acceptable: boolean; reason: string }> {
    const [requiresAudited, yearsTradingMin, amountMin] = await Promise.all([
      this.requiresAuditedAccountsConfigured(yearsTrading, annualAmount),
      getNumberPolicy('sme.audited_accounts.years_trading_min', 3),
      getNumberPolicy('sme.audited_accounts.amount_min', 500_000),
    ]);

    if (requiresAudited) {
      if (smeFinancialStatementType !== 'AUDITED') {
        return {
          acceptable: false,
          reason: `Audited accounts required (yearsTrading >= ${yearsTradingMin} and amount >= RM${amountMin}). Got: ${smeFinancialStatementType ?? 'not specified'}`,
        };
      }
      return { acceptable: true, reason: 'Audited accounts provided — requirement met' };
    }

    if (smeFinancialStatementType === 'MANAGEMENT') {
      if (yearsTrading === null || yearsTrading < yearsTradingMin) {
        return { acceptable: true, reason: `Management accounts accepted (< ${yearsTradingMin} years trading)` };
      }
      return {
        acceptable: false,
        reason: `Management accounts not accepted for >= ${yearsTradingMin} years trading without audited accounts`,
      };
    }

    if (smeFinancialStatementType === 'COMPILED') {
      return { acceptable: true, reason: 'Compiled accounts accepted for SME' };
    }

    if (smeFinancialStatementType === 'AUDITED') {
      return { acceptable: true, reason: 'Audited accounts always acceptable' };
    }

    return { acceptable: true, reason: 'No specific requirement' };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async getSmeBenchmark(ratioKey: string): Promise<SmeBenchmark> {
    const withPolicy = async (
      base: SmeBenchmark,
      passKey: string,
      warnKey: string,
    ): Promise<SmeBenchmark> => ({
      ...base,
      passThreshold: await getNumberPolicy(passKey, base.passThreshold),
      warnThreshold: await getNumberPolicy(warnKey, base.warnThreshold),
    });

    switch (ratioKey) {
      case 'dscr':
        return withPolicy(SME_DSCR_BENCHMARK, 'sme.dscr.pass_min', 'sme.dscr.warn_min');
      case 'dsr':
        return withPolicy(SME_DSR_BENCHMARK, 'sme.dsr.pass_max', 'sme.dsr.warn_max');
      case 'current_ratio':
        return withPolicy(SME_CURRENT_RATIO_BENCHMARK, 'sme.current_ratio.pass_min', 'sme.current_ratio.warn_min');
      case 'gearing_ratio':
        return withPolicy(SME_GEARING_BENCHMARK, 'sme.gearing.pass_max', 'sme.gearing.warn_max');
      case 'ros':
        return withPolicy(SME_ROS_BENCHMARK, 'sme.ros.pass_min', 'sme.ros.warn_min');
      case 'debt_to_equity':
        return withPolicy(SME_DEBT_TO_EQUITY_BENCHMARK, 'sme.debt_to_equity.pass_max', 'sme.debt_to_equity.warn_max');
      default:
        return withPolicy(SME_DSCR_CORPORATE_BENCHMARK, 'sme.dscr.pass_min', 'sme.dscr.warn_min');
    }
  }

  private evaluateRatio(
    _ratioKey: string,
    value: number | null,
    benchmark: SmeBenchmark,
  ): 'pass' | 'warn' | 'fail' {
    if (value === null) return 'fail';

    if (benchmark.direction === 'higher_is_better') {
      if (value >= benchmark.passThreshold) return 'pass';
      if (value >= benchmark.warnThreshold) return 'warn';
      return 'fail';
    } else {
      // lower_is_better
      if (value <= benchmark.passThreshold) return 'pass';
      if (value <= benchmark.warnThreshold) return 'warn';
      return 'fail';
    }
  }

  private evaluateDsr(dsrPercent: number | null, benchmark: SmeBenchmark): 'pass' | 'warn' | 'fail' {
    if (dsrPercent === null) return 'fail';
    if (dsrPercent <= benchmark.passThreshold) return 'pass';
    if (dsrPercent <= benchmark.warnThreshold) return 'warn';
    return 'fail';
  }

  private evaluateDscr(dscr: number | null, benchmark: SmeBenchmark): 'pass' | 'warn' | 'fail' {
    if (dscr === null) return 'fail';
    if (dscr >= benchmark.passThreshold) return 'pass';
    if (dscr >= benchmark.warnThreshold) return 'warn';
    return 'fail';
  }

  private evaluateOverallStatus(
    ownerDsrStatus?: 'pass' | 'warn' | 'fail' | null,
    businessDscrStatus?: 'pass' | 'warn' | 'fail' | null,
  ): 'pass' | 'warn' | 'fail' {
    const statusOrder: Record<string, number> = { pass: 0, warn: 1, fail: 2 };

    const statuses = [ownerDsrStatus, businessDscrStatus]
      .filter((s): s is 'pass' | 'warn' | 'fail' => s != null);

    if (statuses.length === 0) return 'fail';

    const worst = statuses.reduce((max, s) =>
      statusOrder[s] > statusOrder[max] ? s : max, statuses[0]);

    return worst;
  }

  private getRatioLabel(key: string): string {
    const labels: Record<string, string> = {
      dscr: 'Debt Service Coverage Ratio',
      current_ratio: 'Current Ratio',
      gearing_ratio: 'Gearing Ratio',
      ros: 'Net Margin (Return on Sales)',
      debt_to_equity: 'Debt/Equity',
    };
    return labels[key] ?? key;
  }

  private getRatioUnit(key: string): 'x' | '%' | 'days' {
    if (key === 'ros' || key === 'gearing_ratio') return '%';
    return 'x';
  }

  private getDefaultSimplifiedRatios(): SmeFinancialRatio[] {
    const fallbackBenchmarks: Record<string, SmeBenchmark> = {
      dscr: SME_DSCR_BENCHMARK,
      current_ratio: SME_CURRENT_RATIO_BENCHMARK,
      gearing_ratio: SME_GEARING_BENCHMARK,
      ros: SME_ROS_BENCHMARK,
      debt_to_equity: SME_DEBT_TO_EQUITY_BENCHMARK,
    };

    return SME_SIMPLIFIED_RATIO_KEYS.map(key => ({
      key,
      label: this.getRatioLabel(key),
      value: null,
      unit: this.getRatioUnit(key),
      benchmark: fallbackBenchmarks[key] ?? SME_DSCR_CORPORATE_BENCHMARK,
      status: 'fail' as const,
    }));
  }
}

export const smeFinancialService = new SmeFinancialService();