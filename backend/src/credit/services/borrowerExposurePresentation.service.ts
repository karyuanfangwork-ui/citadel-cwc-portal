import prisma from '../../utils/prisma';
import { ApplicationState } from '@prisma/client';
import { toBase } from './fxRate.service';
import { computeBorrowerExposure, EXPOSURE_STATES } from './exposureCompute.service';

export type ExposurePresentationStatus =
  | 'NO_EXPOSURE'
  | 'WITHIN_LIMIT'
  | 'APPROACHING_LIMIT'
  | 'LIMIT_BREACHED'
  | 'LIMIT_NOT_CONFIGURED';

export interface BorrowerExposurePresentation {
  contractVersion: 1;
  borrowerProfileId: string;
  baseCurrency: 'MYR';
  calculatedAt: string;
  includedStates: string[];
  summary: {
    currentExposure: number;
    exposureLimit: number | null;
    availableHeadroom: number | null;
    utilizationPct: number | null;
    status: ExposurePresentationStatus;
  };
  facilities: Array<{
    applicationId: string;
    applicationNumber: string | null;
    applicationState: string;
    facilityType: string;
    originalAmount: number;
    approvedAmount: number | null;
    currency: string;
    baseCurrencyAmount: number;
    undrawnAmount: number | null;
  }>;
  projection: {
    requestedAmount: number | null;
    projectedExposure: number | null;
    projectedUtilizationPct: number | null;
    status: ExposurePresentationStatus | null;
    applicationId: string | null;
  } | null;
  groupExposure: {
    groupId: string;
    groupName: string;
    totalExposure: number;
    borrowerExposure: number;
  } | null;
}

export function getExposureStatus(
  currentExposure: number,
  exposureLimit: number | null,
  utilizationPct: number | null,
): ExposurePresentationStatus {
  if (currentExposure === 0) return 'NO_EXPOSURE';
  if (exposureLimit == null || utilizationPct == null) return 'LIMIT_NOT_CONFIGURED';
  if (utilizationPct > 100) return 'LIMIT_BREACHED';
  // Matches the existing policy-limit default warning threshold of 80%.
  if (utilizationPct >= 80) return 'APPROACHING_LIMIT';
  return 'WITHIN_LIMIT';
}

function asNumber(value: unknown): number | null {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function getBorrowerExposurePresentation(
  borrowerProfileId: string,
): Promise<BorrowerExposurePresentation> {
  const calculatedAt = new Date();
  const [{ totalExposure }, borrower, applications, membership] = await Promise.all([
    computeBorrowerExposure(borrowerProfileId),
    prisma.borrowerProfile.findUnique({
      where: { id: borrowerProfileId },
      select: { exposureLimit: true },
    }),
    prisma.creditApplication.findMany({
      where: { borrowerProfileId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        applicationNo: true,
        state: true,
        requestedAmount: true,
        currency: true,
        facilities: {
          select: { facilityType: true, amount: true, approvedAmount: true },
        },
      },
    }),
    prisma.relatedPartyMember.findFirst({
      where: { borrowerProfileId },
      select: {
        group: {
          select: {
            id: true,
            name: true,
            members: { select: { borrowerProfileId: true } },
          },
        },
      },
    }),
  ]);

  const currentExposure = totalExposure;
  const exposureLimit = asNumber(borrower?.exposureLimit);
  const utilizationPct = exposureLimit && exposureLimit > 0
    ? Math.round((currentExposure / exposureLimit) * 10000) / 100
    : null;
  const qualifyingApplications = applications.filter(app =>
    (EXPOSURE_STATES as ApplicationState[]).includes(app.state),
  );
  const facilities: BorrowerExposurePresentation['facilities'] = [];

  for (const app of qualifyingApplications) {
    for (const facility of app.facilities) {
      const originalAmount = Number(facility.amount);
      const approvedAmount = asNumber(facility.approvedAmount);
      const effectiveAmount = approvedAmount ?? originalAmount;
      facilities.push({
        applicationId: app.id,
        applicationNumber: app.applicationNo,
        applicationState: app.state,
        facilityType: facility.facilityType,
        originalAmount,
        approvedAmount,
        currency: app.currency,
        baseCurrencyAmount: await toBase(effectiveAmount, app.currency),
        undrawnAmount: approvedAmount == null ? null : Math.max(approvedAmount - originalAmount, 0),
      });
    }
  }

  const status = getExposureStatus(currentExposure, exposureLimit, utilizationPct);
  const draft = applications.find(app => app.state === 'DRAFT');
  const draftRequestedAmount = draft ? asNumber(draft.requestedAmount) : null;
  const requestedAmount = draft && draftRequestedAmount != null
    ? await toBase(draftRequestedAmount, draft.currency)
    : null;
  const projectedExposure = requestedAmount == null ? null : currentExposure + requestedAmount;
  const projectedUtilizationPct = projectedExposure != null && exposureLimit && exposureLimit > 0
    ? Math.round((projectedExposure / exposureLimit) * 10000) / 100
    : null;
  const groupExposure = membership?.group
    ? {
        groupId: membership.group.id,
        groupName: membership.group.name,
        totalExposure: (await Promise.all(membership.group.members.map(member => computeBorrowerExposure(member.borrowerProfileId))))
          .reduce((total, result) => total + result.totalExposure, 0),
        borrowerExposure: currentExposure,
      }
    : null;

  return {
    contractVersion: 1,
    borrowerProfileId,
    baseCurrency: 'MYR',
    calculatedAt: calculatedAt.toISOString(),
    includedStates: EXPOSURE_STATES.map(String),
    summary: {
      currentExposure,
      exposureLimit,
      availableHeadroom: exposureLimit == null ? null : Math.max(exposureLimit - currentExposure, 0),
      utilizationPct,
      status,
    },
    facilities,
    projection: draft && requestedAmount != null ? {
      requestedAmount,
      projectedExposure,
      projectedUtilizationPct,
      status: projectedExposure == null ? null : getExposureStatus(projectedExposure, exposureLimit, projectedUtilizationPct),
      applicationId: draft.id,
    } : null,
    groupExposure,
  };
}
