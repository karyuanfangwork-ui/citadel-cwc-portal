/**
 * Submission Readiness Validator — §1.7
 *
 * Hard-gate check that runs BEFORE DRAFT → SUBMITTED transition.
 * Returns a list of blocking issues that must be resolved before submission.
 */

import prisma from '../../utils/prisma';
import { hasStaleCollateralValuations } from '../jobs/collateralInsuranceMonitor.job';
import { hasPendingScoreOverride } from './scoreOverride.service';
import { getBureauFreshnessDays, isBureauCheckFresh, isBureauChecklistComplete, isBureauChecklistVerified } from './bureauCheck.service';
import { fatcaCrsService } from './fatcaCrs.service';
import { checkRequiredFields } from './creditFieldCheck.service';
import { collateralService } from './collateral.service';
import { smeFinancialService } from './smeFinancial.service';
import { getNumberPolicy } from './policyParameter.service';
import { resolveRequiredDocuments, RuleScope } from './creditRuleEngine.service';

/**
 * @deprecated Use resolveRequiredDocuments() from creditRuleEngine.service instead.
 * This function is kept only as a synchronous fallback for contexts where
 * the async rule engine cannot be called (e.g., test mocks).
 * P1.3: This hardcoded function will be removed once all callers are migrated.
 */
export function getRequiredDocumentsFallback(borrowerType: string): string[] {
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

type ReadinessStage = 'submission' | 'committee';

interface ReadinessOptions {
  /**
   * submission: DRAFT -> SUBMITTED intake gate. Requires mandatory document presence.
   * committee: CREDIT_ASSESSMENT -> COMMITTEE_REVIEW gate. Requires verification and assessment controls.
   */
  stage?: ReadinessStage;
}

// Doc classes that can be satisfied by borrower profile data instead of a file upload
const PROFILE_SATISFIABLE: Record<string, (bp: { nricPassport?: string | null }) => boolean> = {
  NRIC_PASSPORT: (bp) => !!bp.nricPassport,
};

async function hasApprovedDeviation(applicationId: string, keyword: string): Promise<boolean> {
  const deviations = await prisma.deviationApproval.findMany({
    where: { applicationId, status: 'APPROVED' },
    select: { policyRule: true },
  });
  return deviations.some((d) => (d.policyRule ?? '').toUpperCase().includes(keyword));
}

export async function validateSubmissionReadiness(
  applicationId: string,
  options: ReadinessOptions = {},
): Promise<ReadinessResult> {
  const errors: ReadinessIssue[] = [];
  const warnings: ReadinessIssue[] = [];
  const satisfied: ReadinessIssue[] = [];
  const stage = options.stage ?? 'committee';

  const application = await prisma.creditApplication.findUnique({
    where: { id: applicationId },
    include: {
      borrowerProfile: {
        select: {
          accountId: true,
          contactId: true,
          borrowerType: true,
          amlRiskTier: true,
          exposureLimit: true,
          totalExposure: true,
          nricPassport: true,
        },
      },
      facilities: { select: { id: true, facilityType: true, amount: true } },
      documents: {
        where: { deletedAt: null },
        select: {
          id: true,
          classification: true,
          verificationStatus: true,
          isAvClean: true,
        },
      },
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
  // PERSONAL_FAST applications use the streamlined loan-request flow and do not
  // expose a separate facilities step. Keep the facility gate for SME/CORPORATE
  // lanes where the user can actually add and structure facilities.
  if (application.lane !== 'PERSONAL_FAST' && application.facilities.length === 0) {
    errors.push({
      field: 'facilities',
      message: 'Add at least one facility in the Facilities section before submission',
      severity: 'error',
    });
  }

  // ---- Check 2: Borrower profile readiness uses self-contained borrower data ----
  const bp = application.borrowerProfile;
  // ---- Check 3: Mandatory documents (per borrower type) ----
  const ruleScope = {
    productType: application.productType ?? null,
    lane: (application.lane as string) ?? 'PERSONAL_FAST',
    borrowerType: application.borrowerProfile.borrowerType as string,
  };

  const [
    bureauFreshnessDays,
    netDsrPassMax,
    netDsrWarnMax,
    grossDsrPassMax,
    grossDsrWarnMax,
    dscrFailBelow,
    dscrWarnBelow,
    exposureWarningUtilisationPct,
  ] = await Promise.all([
    getBureauFreshnessDays(),
    getNumberPolicy('readiness.retail.net_dsr.pass_max', 50, ruleScope),
    getNumberPolicy('readiness.retail.net_dsr.warn_max', 60, ruleScope),
    getNumberPolicy('readiness.retail.gross_dsr.pass_max', 60, ruleScope),
    getNumberPolicy('readiness.retail.gross_dsr.warn_max', 70, ruleScope),
    getNumberPolicy('readiness.dscr.fail_below', 1.0, ruleScope),
    getNumberPolicy('readiness.dscr.warn_below', 1.1, ruleScope),
    getNumberPolicy('readiness.exposure.warning_utilisation_pct', 90, ruleScope),
  ]);

  if (stage === 'submission') {
    const fieldCheck = await checkRequiredFields(ruleScope, application as Record<string, any>);
    for (const missing of fieldCheck.missing) {
      errors.push({
        field: missing.fieldPath,
        message: `Required field missing: ${missing.label}`,
        severity: 'error',
      });
    }

    // ---- Loan purpose mandatory at submission ----
    const purposeText = (application.purpose ?? '').toString().trim();
    if (purposeText.length === 0) {
      errors.push({
        field: 'purpose',
        message: 'Loan purpose is required before submission',
        severity: 'error',
      });
    }
  }

  // P1.3: Use rule engine for document requirements instead of hardcoded function
  const documentScope: RuleScope = {
    borrowerType: application.borrowerProfile.borrowerType as string,
    lane: (application as any).lane ?? 'STANDARD',
    productType: application.productType ?? null,
  };
  const resolvedDocs = await resolveRequiredDocuments(documentScope);
  // Filter to mandatory documents only for readiness check
  const mandatoryClasses = resolvedDocs
    .filter(d => d.isMandatory)
    .map(d => d.documentClass as string);
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
    } else if (stage === 'committee') {
      const matchingDocs = application.documents.filter((d) => d.classification === docClass);
      const hasVerifiedDoc = matchingDocs.some((d) => d.verificationStatus === 'VERIFIED');
      const infectedDoc = matchingDocs.find((d) => d.isAvClean === false);

      if (infectedDoc) {
        errors.push({
          field: 'documents',
          message: `Required document failed AV scan: ${docClass.replace(/_/g, ' ')}`,
          severity: 'error',
        });
      }

      if (!hasVerifiedDoc) {
        const statuses = matchingDocs
          .map((d) => d.verificationStatus ?? 'PENDING')
          .filter((value, index, all) => all.indexOf(value) === index)
          .join(', ');
        errors.push({
          field: 'documents',
          message: `Required document not verified: ${docClass.replace(/_/g, ' ')}${statuses ? ` (current: ${statuses})` : ''}`,
          severity: 'error',
        });
      } else {
        satisfied.push({
          field: 'documents',
          message: `Required document verified: ${docClass.replace(/_/g, ' ')}`,
          severity: 'info',
        });
      }
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

  if (stage === 'committee') {
    // ---- Check 8: Bureau report freshness (90 days) ----
    const freshnessCheck = await isBureauCheckFresh(applicationId);
    if (!freshnessCheck.fresh) {
      errors.push({
        field: 'bureauChecks',
        message: `Bureau reports are older than ${bureauFreshnessDays} days and must be refreshed: ${freshnessCheck.staleProviders.join(', ')}`,
        severity: 'error',
      });
    }

    // ---- Check 9: Bureau checklist completion + verification (hard gate) ----
    const bureauComplete = await isBureauChecklistComplete(applicationId);
    if (!bureauComplete) {
      errors.push({
        field: 'bureauChecklist',
        message: 'Bureau checklist incomplete — CCRIS, CTOS and AML screening must be completed before committee submission.',
        severity: 'error',
      });
    } else {
      // Checklist is complete — verify it has been signed off by a second officer
      const bureauVerified = await isBureauChecklistVerified(applicationId);
      if (!bureauVerified) {
        errors.push({
          field: 'bureauChecklist',
          message: 'Bureau checklist must be verified by a second officer before committee submission.',
          severity: 'error',
        });
      }
    }

    // Sprint 2 — ECL snapshot required for corporate before committee
    const borrowerType = application.borrowerProfile.borrowerType as string;
    if (borrowerType === 'CORPORATE') {
      const eclCount = await prisma.eclSnapshot.count({ where: { applicationId } });
      if (eclCount === 0) {
        errors.push({
          field: 'ecl',
          message: 'At least one ECL snapshot is required for corporate applications before committee submission.',
          severity: 'error',
        });
      }
    }

    // ---- LTV cap gate (collateralised facilities only) ----
    const ltvResults = await collateralService.computeApplicationLtv(applicationId);
    const breachedLtv = ltvResults.filter((r) => r.exceedsCap && r.haircutDetails.length > 0);
    if (breachedLtv.length > 0) {
      const ltvWaived = await hasApprovedDeviation(applicationId, 'LTV');
      if (!ltvWaived) {
        errors.push({
          field: 'ltv',
          message: `${breachedLtv.length} facility/facilities breach the LTV cap (e.g. ${breachedLtv[0].ltvPercent.toFixed(1)}%). An approved policy deviation is required.`,
          severity: 'error',
        });
      } else {
        satisfied.push({
          field: 'ltv',
          message: 'LTV cap breach covered by an approved policy deviation.',
          severity: 'info',
        });
      }
    }

    // ---- DSCR minimum gate (non-retail borrowers only) ----
    if (!isRetailBorrower) {
      const dscrAssessment = await smeFinancialService.computeDualAssessment(application.borrowerProfileId);
      const dscrValue = dscrAssessment.businessDscr?.dscr ?? null;
      if (dscrAssessment.overallStatus === 'fail') {
        const dscrWaived = await hasApprovedDeviation(applicationId, 'DSCR');
        if (!dscrWaived) {
          errors.push({
            field: 'dscr',
            message: `Business DSCR${dscrValue != null ? ` of ${dscrValue.toFixed(2)}` : ''} is below the minimum (${dscrFailBelow.toFixed(2)}). An approved policy deviation is required.`,
            severity: 'error',
          });
        } else {
          satisfied.push({
            field: 'dscr',
            message: 'DSCR below minimum is covered by an approved policy deviation.',
            severity: 'info',
          });
        }
      } else if (dscrAssessment.overallStatus === 'warn') {
        warnings.push({
          field: 'dscr',
          message: `Business DSCR${dscrValue != null ? ` of ${dscrValue.toFixed(2)}` : ''} is in the warning band (${dscrFailBelow.toFixed(2)}–${dscrWarnBelow.toFixed(2)}).`,
          severity: 'warning',
        });
      }
    }
  }

  // ---- Check 10: Retail DSR warning (P1-3: now uses net-DSR thresholds) ----
  if (isRetailBorrower) {
    const retailIncome = await prisma.retailIncome.findUnique({
      where: { applicationId },
      select: { dsrPercent: true, netDsrPercent: true, dsrBasis: true },
    });
    if (!retailIncome) {
      warnings.push({
        field: 'retailIncome',
        message: 'Retail income / DSR assessment not completed — required for individual borrowers',
        severity: 'warning',
      });
    } else {
      // P1-3: Prefer net-DSR when available; fall back to gross-DSR for backward compat
      const dsrBasis = retailIncome.dsrBasis ?? 'GROSS';
      const netDsr = Number(retailIncome.netDsrPercent ?? 0);
      const grossDsr = Number(retailIncome.dsrPercent ?? 0);

      if (dsrBasis === 'NET' && netDsr > 0) {
        // Net-DSR thresholds: pass ≤ pass_max, warning ≤ warn_max, fail > warn_max
        if (netDsr > netDsrWarnMax) {
          errors.push({
            field: 'retailIncome',
            message: `Net DSR of ${netDsr.toFixed(1)}% exceeds ${netDsrWarnMax}% threshold — application is high risk`,
            severity: 'error',
          });
        } else if (netDsr > netDsrPassMax) {
          warnings.push({
            field: 'retailIncome',
            message: `Net DSR of ${netDsr.toFixed(1)}% is in the warning band (${netDsrPassMax}-${netDsrWarnMax}%)`,
            severity: 'warning',
          });
        }
      } else {
        // Fallback to gross-DSR thresholds: pass ≤ pass_max, warning ≤ warn_max, fail > warn_max
        if (grossDsr > grossDsrWarnMax) {
          errors.push({
            field: 'retailIncome',
            message: `DSR of ${grossDsr.toFixed(1)}% exceeds ${grossDsrWarnMax}% threshold — application is high risk`,
            severity: 'error',
          });
        } else if (grossDsr > grossDsrPassMax) {
          warnings.push({
            field: 'retailIncome',
            message: `DSR of ${grossDsr.toFixed(1)}% is in the warning band (${grossDsrPassMax}-${grossDsrWarnMax}%)`,
            severity: 'warning',
          });
        }
      }
    }
  }

  // ---- Check 11: §2.6 Exposure limit warning ----
  const exposureLimit = Number(bp.exposureLimit ?? 0);
  const currentExposure = Number(bp.totalExposure ?? 0);
  if (exposureLimit > 0) {
    // Calculate projected exposure including new facility amounts
    const newFacilityAmount = application.facilities.reduce((sum, f) => sum + Number(f.amount ?? 0), 0);
    const projectedExposure = currentExposure + newFacilityAmount;
    if (projectedExposure > exposureLimit) {
      warnings.push({
        field: 'exposureLimit',
        message: `Projected exposure (MYR ${projectedExposure.toLocaleString()}) would breach borrower limit (MYR ${exposureLimit.toLocaleString()}). Override required.`,
        severity: 'warning',
      });
    } else if (projectedExposure > exposureLimit * (exposureWarningUtilisationPct / 100)) {
      warnings.push({
        field: 'exposureLimit',
        message: `Projected exposure (MYR ${projectedExposure.toLocaleString()}) is approaching the borrower limit (MYR ${exposureLimit.toLocaleString()}).`,
        severity: 'warning',
      });
    }
  }

  // ---- Check 12: §3.4 FATCA/CRS declaration (foreign / elevated-risk borrowers) ----
  const amlTier = bp.amlRiskTier as string | null | undefined;
  if (amlTier === 'MEDIUM' || amlTier === 'HIGH') {
    const fatcaStatus = await fatcaCrsService.checkExpiry(application.borrowerProfileId);
    if (!fatcaStatus.exists) {
      warnings.push({
        field: 'fatcaCrs',
        message: 'No FATCA/CRS declaration on file — required for foreign / elevated AML-risk borrowers.',
        severity: 'warning',
      });
    } else if (fatcaStatus.expired) {
      warnings.push({
        field: 'fatcaCrs',
        message: `FATCA/CRS declaration expired on ${fatcaStatus.expiryDate?.toISOString().slice(0, 10)} — re-declaration required.`,
        severity: 'warning',
      });
    }
  }

  return {
    ready: errors.length === 0,
    errors,
    warnings,
    satisfied,
  };
}