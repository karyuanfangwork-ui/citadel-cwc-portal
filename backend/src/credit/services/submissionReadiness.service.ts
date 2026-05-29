/**
 * Submission Readiness Validator — §1.7
 *
 * Hard-gate check that runs BEFORE DRAFT → SUBMITTED transition.
 * Returns a list of blocking issues that must be resolved before submission.
 */

import prisma from '../../utils/prisma';
import { hasStaleCollateralValuations } from '../jobs/collateralInsuranceMonitor.job';
import { hasPendingScoreOverride } from './scoreOverride.service';

export interface ReadinessIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ReadinessResult {
  ready: boolean;
  errors: ReadinessIssue[];
  warnings: ReadinessIssue[];
}

export async function validateSubmissionReadiness(applicationId: string): Promise<ReadinessResult> {
  const errors: ReadinessIssue[] = [];
  const warnings: ReadinessIssue[] = [];

  const application = await prisma.creditApplication.findUnique({
    where: { id: applicationId },
    include: {
      borrowerProfile: true,
      facilities: { select: { id: true, facilityType: true, amount: true } },
      documents: { select: { id: true, classification: true } },
      parties: { select: { id: true, role: true, borrowerProfileId: true } },
    },
  });

  if (!application) {
    return {
      ready: false,
      errors: [{ field: 'application', message: 'Application not found', severity: 'error' }],
      warnings: [],
    };
  }

  // ---- Check 1: At least one facility ----
  if (application.facilities.length === 0) {
    errors.push({
      field: 'facilities',
      message: 'At least one credit facility is required before submission',
      severity: 'error',
    });
  }

  // ---- Check 2: Borrower profile must be linked ----
  const bp = application.borrowerProfile;
  if (!bp.accountId && !bp.contactId) {
    errors.push({
      field: 'borrowerProfile',
      message: 'Borrower profile must be linked to an account or contact',
      severity: 'error',
    });
  }

  // ---- Check 3: Mandatory documents ----
  const mandatoryClasses = ['NRIC_PASSPORT', 'AUDITED_FINANCIALS'];
  for (const docClass of mandatoryClasses) {
    const hasDoc = application.documents.some((d) => d.classification === docClass);
    if (!hasDoc) {
      errors.push({
        field: 'documents',
        message: `Required document missing: ${docClass.replace('_', ' ')}`,
        severity: 'error',
      });
    }
  }

  // ---- Check 4: No pending score overrides ----
  const hasPendingOverride = await hasPendingScoreOverride(applicationId);
  if (hasPendingOverride) {
    errors.push({
      field: 'scoreOverride',
      message: 'Cannot submit: pending score override requires second approval',
      severity: 'error',
    });
  }

  // ---- Check 5: No stale collateral valuations ----
  const collateralCheck = await hasStaleCollateralValuations(applicationId);
  if (collateralCheck.blocked) {
    errors.push({
      field: 'collateral',
      message: `${collateralCheck.staleCollaterals.length} collateral(s) with stale valuations (>12 months)`,
      severity: 'error',
    });
  }

  // ---- Check 6: Guarantor completeness ----
  const guarantors = application.parties.filter((p) =>
    ['GUARANTOR', 'CO_BORROWER'].includes(p.role),
  );
  for (const g of guarantors) {
    if (!g.borrowerProfileId) {
      errors.push({
        field: 'parties',
        message: `Guarantor/co-borrower (role: ${g.role}) is missing a linked profile`,
        severity: 'error',
      });
    }
  }

  // ---- Check 7: Financials warning ----
  const financialCount = await prisma.financialStatement.count({
    where: { borrowerProfileId: application.borrowerProfileId },
  });
  if (financialCount === 0) {
    warnings.push({
      field: 'financials',
      message: 'No financial statements uploaded — review may be delayed',
      severity: 'warning',
    });
  }

  return {
    ready: errors.length === 0,
    errors,
    warnings,
  };
}