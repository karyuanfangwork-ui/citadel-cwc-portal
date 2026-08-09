import { ICbsProvider, CbsHandoffResult } from './interfaces';

/**
 * Placeholder CBS Provider — logs disbursement events and returns accepted.
 * Replace with real implementation when CBS API spec is available.
 *
 * LOS-021: All identifiers are prefixed with SIMULATED- and carry a simulated
 * flag so staff cannot mistake a placeholder booking for a real one.
 */
export class PlaceholderCbsProvider implements ICbsProvider {
  async bookFacility(_params: {
    applicationId: string;
    facilityType: string;
    amount: number;
    currency: string;
    tenorMonths: number;
    rate: number;
    borrowerId: string;
  }): Promise<CbsHandoffResult> {
    return {
      accepted: true,
      reference: `SIMULATED-CBS-${Date.now()}`,
      message: 'Placeholder CBS: facility booking not actually processed (SIMULATED)',
      simulated: true,
      bookedAt: new Date(),
    };
  }

  async getFacilityStatus(_params: { cbsReference: string }): Promise<{ status: string; outstandingBalance?: number; simulated?: boolean }> {
    return {
      status: 'ACTIVE',
      outstandingBalance: 0,
      simulated: true,
    };
  }
}