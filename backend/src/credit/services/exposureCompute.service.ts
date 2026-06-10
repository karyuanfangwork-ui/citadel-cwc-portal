import prisma from '../../utils/prisma';
import { ApplicationState } from '@prisma/client';

// ---------------------------------------------------------------------------
// Exposure States — the set of application states whose facilities count
// toward a borrower's total exposure.  This single list is the authoritative
// definition; every consumer must call computeBorrowerExposure() so that the
// persisted BorrowerProfile.totalExposure and any live readout can never
// diverge.
// ---------------------------------------------------------------------------

export const EXPOSURE_STATES: ApplicationState[] = [
  'APPROVED' as ApplicationState,
  'OFFER' as ApplicationState,
  'ACCEPTED' as ApplicationState,
  'DISBURSED' as ApplicationState,
  'ACTIVE' as ApplicationState,
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the total exposure for a borrower profile by summing
 * `approvedAmount ?? amount` across all facilities belonging to credit
 * applications whose state is in EXPOSURE_STATES.
 *
 * Mirrors the include-path and field logic from the existing
 * GET /borrowers/:borrowerProfileId/exposure route
 * (financial.service.ts → getExposure) and the related-party-group
 * currency-breakdown aggregation (relatedPartyGroup.service.ts →
 * getGroupExposure), but widens the qualifying states from
 * [ACTIVE, DISBURSED] to [APPROVED, OFFER, ACCEPTED, DISBURSED, ACTIVE]
 * to match the policyLimit.service.ts ACTIVE_STATES convention.
 */
export async function computeBorrowerExposure(
  borrowerProfileId: string,
): Promise<{ totalExposure: number }> {
  const applications = await prisma.creditApplication.findMany({
    where: {
      borrowerProfileId,
      state: { in: EXPOSURE_STATES },
      deletedAt: null,
    },
    include: {
      facilities: {
        select: {
          id: true,
          facilityType: true,
          amount: true,
          approvedAmount: true,
        },
      },
    },
  });

  let totalExposure = 0;
  for (const app of applications) {
    for (const fac of app.facilities) {
      // approvedAmount ?? amount — same convention as policyLimit.service.ts:126
      const effectiveAmount = fac.approvedAmount
        ? Number(fac.approvedAmount)
        : Number(fac.amount);
      totalExposure += effectiveAmount;
    }
  }

  return { totalExposure };
}

/**
 * Compute the borrower's exposure (via computeBorrowerExposure) and persist
 * the result to BorrowerProfile.totalExposure.
 *
 * Call this after any state transition that enters or leaves EXPOSURE_STATES
 * so that the denormalised column stays in sync with the canonical computation.
 *
 * Returns the freshly-computed totalExposure.
 */
export async function refreshBorrowerExposure(
  borrowerProfileId: string,
): Promise<number> {
  const { totalExposure } = await computeBorrowerExposure(borrowerProfileId);

  await prisma.borrowerProfile.update({
    where: { id: borrowerProfileId },
    data: { totalExposure },
  });

  return totalExposure;
}