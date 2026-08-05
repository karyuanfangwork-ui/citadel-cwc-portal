import { IBureauProvider, BureauReport } from './interfaces';

/**
 * No-op Bureau Provider — returns null scores/reports.
 *
 * Used only in dev/CI/test where no real vendor is configured.
 * In production, a real provider MUST be wired and the registry guard
 * (see registry.ts) will throw at boot if this no-op is active while
 * `credit:bureau_checks=true`.
 *
 * Real providers are tracked in:
 *   docs/credit-assessment/27-implementation-plan-2026-05-29.md
 *     Wave 4.3 — CTOS adapter (primary commercial bureau)
 *     Wave 4.5 — AML / sanctions / PEP adapter
 *
 * Citadel CWC is a non-bank SME lender; direct CCRIS access is not
 * available. The eCCRIS substitute is Wave 4.1 (borrower self-upload).
 */
export class NoopBureauProvider implements IBureauProvider {
  async getIndividualReport(_params: { nricPassport: string }): Promise<BureauReport> {
    return {
      score: null,
      rating: null,
      providerRef: `NOOP-BUREAU-${Date.now()}`,
      reportSummary: null,
      retrievedAt: new Date(),
    };
  }

  async getCorporateReport(_params: { registrationNumber: string }): Promise<BureauReport> {
    return {
      score: null,
      rating: null,
      providerRef: `NOOP-BUREAU-CORP-${Date.now()}`,
      reportSummary: null,
      retrievedAt: new Date(),
    };
  }
}