import { ICbsProvider, CbsHandoffResult } from './interfaces';

/**
 * Placeholder CBS Provider — logs disbursement events and returns accepted.
 * Replace with real implementation when CBS API spec is available.
 */
export class PlaceholderCbsProvider implements ICbsProvider {
  async bookFacility(): Promise<CbsHandoffResult> {
    return {
      accepted: true,
      reference: `STUB-CBS-${Date.now()}`,
      message: 'Placeholder CBS: facility booking not actually processed',
    };
  }

  async getFacilityStatus(_params: { cbsReference: string }): Promise<{ status: string; outstandingBalance?: number }> {
    return {
      status: 'ACTIVE',
      outstandingBalance: 0,
    };
  }
}