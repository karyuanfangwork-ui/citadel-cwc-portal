import { IBureauProvider, BureauReport } from './interfaces';

/**
 * Placeholder Credit Bureau Provider — returns null scores/reports.
 * Replace with real implementation (CTOS/CCRIS/RAM Credit Info) when vendor is procured.
 */
export class PlaceholderBureauProvider implements IBureauProvider {
  async getIndividualReport(): Promise<BureauReport> {
    return {
      score: null,
      rating: null,
      providerRef: `MOCK-BUREAU-${Date.now()}`,
      reportSummary: null,
      retrievedAt: new Date(),
    };
  }

  async getCorporateReport(): Promise<BureauReport> {
    return {
      score: null,
      rating: null,
      providerRef: `MOCK-BUREAU-CORP-${Date.now()}`,
      reportSummary: null,
      retrievedAt: new Date(),
    };
  }
}