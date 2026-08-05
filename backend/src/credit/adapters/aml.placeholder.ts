import { IAmlProvider, ScreeningResult } from './interfaces';

/**
 * Placeholder AML Provider — returns CLEAR for all screening requests.
 * Replace with real implementation (Refinitiv/Dow Jones/LSEG) when vendor is procured.
 * All screening requests are logged for audit trail via the caller.
 */
export class PlaceholderAmlProvider implements IAmlProvider {
  async screenIndividual(): Promise<ScreeningResult> {
    return {
      status: 'CLEAR',
      hits: [],
      providerRef: `MOCK-AML-${Date.now()}`,
      screenedAt: new Date(),
    };
  }

  async screenCorporate(): Promise<ScreeningResult> {
    return {
      status: 'CLEAR',
      hits: [],
      providerRef: `MOCK-AML-CORP-${Date.now()}`,
      screenedAt: new Date(),
    };
  }

  async rescreen(): Promise<ScreeningResult> {
    return {
      status: 'CLEAR',
      hits: [],
      providerRef: `MOCK-AML-RE-${Date.now()}`,
      screenedAt: new Date(),
    };
  }
}