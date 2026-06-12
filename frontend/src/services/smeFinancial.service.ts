/**
 * P2-3: SME Financial Assessment — Frontend API client
 *
 * Provides typed access to /api/v1/credit/sme/* endpoints.
 */

import apiClient from './api';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SmeBenchmark {
  passThreshold: number;
  warnThreshold: number;
  direction: 'higher_is_better' | 'lower_is_better';
}

export interface SmeFinancialRatio {
  key: string;
  label: string;
  value: number | null;
  unit: 'x' | '%' | 'days';
  benchmark: SmeBenchmark;
  status: 'pass' | 'warn' | 'fail';
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
  borrowerType: string;
  annualTurnover: number | null;
  yearsTrading: number | null;
  smeFinancialStatementType: 'AUDITED' | 'MANAGEMENT' | 'COMPILED' | null;
  sicCode: string | null;
  requiresAudited: boolean;
  acceptsManagement: boolean;
  simplifiedRatios: SmeFinancialRatio[];
  dualAssessment: DualAssessment | null;
}

export interface StatementTypeValidation {
  acceptable: boolean;
  reason: string;
}

// ── API Client ────────────────────────────────────────────────────────────────

const smeFinancialApi = {
  /**
   * GET /credit/sme/assessment/:borrowerProfileId
   */
  async getAssessment(borrowerProfileId: string): Promise<SmeFinancialAssessment> {
    const res = await apiClient.get(`/credit/sme/assessment/${borrowerProfileId}`);
    return res.data.data;
  },

  /**
   * GET /credit/sme/dual-assessment/:borrowerProfileId
   */
  async getDualAssessment(borrowerProfileId: string): Promise<DualAssessment> {
    const res = await apiClient.get(`/credit/sme/dual-assessment/${borrowerProfileId}`);
    return res.data.data;
  },

  /**
   * POST /credit/sme/validate-statement-type
   */
  async validateStatementType(params: {
    smeFinancialStatementType?: string | null;
    yearsTrading?: number | null;
    annualAmount?: number | null;
  }): Promise<StatementTypeValidation> {
    const res = await apiClient.post('/credit/sme/validate-statement-type', params);
    return res.data.data;
  },

  /**
   * POST /credit/sme/recommend-statement-type/:borrowerProfileId
   */
  async recommendStatementType(borrowerProfileId: string): Promise<StatementTypeValidation> {
    const res = await apiClient.post(`/credit/sme/recommend-statement-type/${borrowerProfileId}`);
    return res.data.data;
  },
};

export default smeFinancialApi;