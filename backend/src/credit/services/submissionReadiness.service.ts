/**
 * Submission Readiness Validator — §1.7
 *
 * Hard-gate check that runs BEFORE DRAFT → SUBMITTED transition.
 * Returns a list of blocking issues that must be resolved before submission.
 */

import prisma from '../../utils/prisma';
import { hasStaleCollateralValuations } from '../jobs/collateralInsuranceMonitor.job';
import { hasPendingScoreOverride } from './scoreOverride.service';
import { isBureauCheckFresh, isBureauChecklistComplete } from './bureauCheck.service';

function getRequiredDocuments(borrowerType: string): string[] {
  switch (borrowerType) {
    case 'INDIVIDUAL':
      return ['NRIC_PASSPORT', 'PAYSLIP', 'BANK_STATEMENT'];
    case 'SOLE_PROPRIETOR':
      return ['NRIC_PASSPORT', 'SSM_CERT', 'BANK_STATEMENT'];
    case 'JOINT':
      return ['JV_AGREEMENT', 'AUDITED_FINANCIALS'];
    case 'CORPORATE':
    default:
      return ['SSM_CERT', 'AUDITED_FINANCIALS', 'MOA_AOA'];
  }
}

export interface ReadinessIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ReadinessResult {
  ready: boolean;
  errors: ReadinessIssue[];
  warnings: ReadinessIssue[];
  satisfied: ReadinessIssue[];
}

// Doc classes that can be satisfied by borrower profile data instead of a file upload
const PROFILE_SATISFIABLE: Record<string, (bp: { contact?: { nricPassport?: string | null } | null }) => boolean> = {
  NRIC_PASSPORT: (bp) => !!bp.contact?.nricPassport,
};

export async function validateSubmissionReadiness(applicationId: string): Promise<ReadinessResult> {
  const errors: ReadinessIssue[] = [];
  const warnings: ReadinessIssue[] = [];
  const satisfied: ReadinessIssue[] = [];

  const application = await prisma.creditApplication.findUnique({
    where: { id: applicationId },
    include: {
      borrowerProfile: {
        select: {
          accountId: true,
          contactId: true,
          borrowerType: true,
          contact: { select: { nricPassport: true } },
        },
      },
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
      satisfied: [],
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

  // ---- Check 3: Mandatory documents (per borrower type) ----
  const mandatoryClasses = getRequiredDocuments(application.borrowerProfile.borrowerType as string);
  for (const docClass of mandatoryClasses) {
    const hasDoc = application.documents.some((d) => d.classification === docClass);
    const profileSatisfier = PROFILE_SATISFIABLE[docClass];
    const satisfiedByProfile = profileSatisfier ? profileSatisfier(application.borrowerProfile as any) : false;

    if (!hasDoc && !satisfiedByProfile) {
      errors.push({
        field: 'documents',
        message: `Required document missing: ${docClass.replace(/_/g, ' ')}`,
        severity: 'error',
      });
    } else if (!hasDoc && satisfiedByProfile) {
      satisfied.push({
        field: 'documents',
        message: `NRIC / Passport verified from borrower profile — document upload optional`,
        severity: 'info',
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

  // ---- Check 7: Financials warning (corporate/joint only) ----
  // Retail borrowers (INDIVIDUAL/SOLE_PROPRIETOR) use retail income/DSR instead
  // of financial statements, so this check does not apply to them.
  const isRetailBorrower = ['INDIVIDUAL', 'SOLE_PROPRIETOR'].includes(
    application.borrowerProfile.borrowerType as string
  );
  if (!isRetailBorrower) {
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
  }

  // ---- Check 8: Bureau report freshness (90 days) ----
  const freshnessCheck = await isBureauCheckFresh(applicationId);
  if (!freshnessCheck.fresh) {
    errors.push({
      field: 'bureauChecks',
      message: `Bureau reports are older than 90 days and must be refreshed: ${freshnessCheck.staleProviders.join(', ')}`,
      severity: 'error',
    });
  }

  // ---- Check 9: Bureau checklist completion ----
  const bureauComplete = await isBureauChecklistComplete(applicationId);
  if (!bureauComplete) {
    warnings.push({
      field: 'bureauChecklist',
      message: 'Bureau checklist incomplete — all items should be ticked before submission',
      severity: 'warning',
    });
  }

  // ---- Check 10: Retail DSR warning ----
  if (isRetailBorrower) {
    const retailIncome = await prisma.retailIncome.findUnique({
      where: { applicationId },
      select: { dsrPercent: true },
    });
    if (!retailIncome) {
      warnings.push({
        field: 'retailIncome',
        message: 'Retail income / DSR assessment not completed — required for individual borrowers',
        severity: 'warning',
      });
    } else {
      const dsr = Number(retailIncome.dsrPercent);
      if (dsr > 70) {
        errors.push({
          field: 'retailIncome',
          message: `DSR of ${dsr.toFixed(1)}% exceeds 70% threshold — application is high risk`,
          severity: 'error',
        });
      } else if (dsr > 60) {
        warnings.push({
          field: 'retailIncome',
          message: `DSR of ${dsr.toFixed(1)}% is in the warning band (60-70%)`,
          severity: 'warning',
        });
      }
    }
  }

  return {
    ready: errors.length === 0,
    errors,
    warnings,
    satisfied,
  };
}