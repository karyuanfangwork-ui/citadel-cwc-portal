import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/error.middleware';
import { bureauFreshness } from './borrowerCreditData.service';
import { getBorrowerApplicationReadiness } from './borrowerApplicationReadiness.service';
import { getLatestBorrowerRiskRun } from './borrowerScoring.service';
import { buildBorrowerRiskPresentation } from './borrowerRiskPresentation.service';

export type AlertTone = 'warn' | 'neg';

export interface Alert {
  tone: AlertTone;
  icon: string;
  title: string;
  body: string;
  actionLabel?: string;
}

type BorrowerDocumentRecord = {
  classification: string;
  verificationStatus: string | null;
};

type RequiredDocumentGroup = string | string[];

const BORROWER_DOCUMENT_CHECKLISTS: Record<'INDIVIDUAL' | 'SOLE_PROPRIETOR' | 'CORPORATE', RequiredDocumentGroup[]> = {
  INDIVIDUAL: ['NRIC_PASSPORT', 'PAYSLIP', 'BANK_STATEMENT'],
  SOLE_PROPRIETOR: ['NRIC_PASSPORT', 'SSM_CERT', 'BANK_STATEMENT', 'TAX_RETURN'],
  CORPORATE: [
    ['MEMORANDUM_ARTICLES', 'MOA_AOA'],
    'SSM_CERT',
    'BOARD_RESOLUTION',
    'AUTHORIZED_SIGNATORY',
    'BANK_STATEMENT',
    'AUDITED_FINANCIALS',
  ],
};

const normalizeDocumentGroup = (group: RequiredDocumentGroup) => (Array.isArray(group) ? group : [group]);

export function documentChecklistForBorrowerType(borrowerType: string | null | undefined): RequiredDocumentGroup[] {
  if (borrowerType === 'CORPORATE') return BORROWER_DOCUMENT_CHECKLISTS.CORPORATE;
  if (borrowerType === 'SOLE_PROPRIETOR') return BORROWER_DOCUMENT_CHECKLISTS.SOLE_PROPRIETOR;
  return BORROWER_DOCUMENT_CHECKLISTS.INDIVIDUAL;
}

export function computeDocumentCompletion(
  borrowerType: string | null | undefined,
  documents: BorrowerDocumentRecord[],
) {
  const requiredGroups = documentChecklistForBorrowerType(borrowerType);
  const verifiedClassifications = new Set(
    documents
      .filter((document) => document.verificationStatus === 'VERIFIED')
      .map((document) => document.classification),
  );

  const collectedGroups = requiredGroups.filter((group) =>
    normalizeDocumentGroup(group).some((classification) => verifiedClassifications.has(classification)),
  );
  const outstandingGroups = requiredGroups.filter(
    (group) => !normalizeDocumentGroup(group).some((classification) => verifiedClassifications.has(classification)),
  );
  const requiredCount = requiredGroups.length;
  const collectedCount = collectedGroups.length;

  return {
    requiredCount,
    collectedCount,
    completionPct: requiredCount > 0 ? Math.round((collectedCount / requiredCount) * 100) : 0,
    outstandingGroups,
  };
}

export function buildAlerts(input: { bureauStale: boolean; missingDocs: boolean }): Alert[] {
  const alerts: Alert[] = [];

  if (input.bureauStale) {
    alerts.push({
      tone: 'neg',
      icon: 'description',
      title: 'Bureau Report Required',
      body: 'No recent borrower-uploaded bureau report is on file. Upload the latest report to refresh conduct data.',
      actionLabel: 'Upload Bureau Report',
    });
  }

  if (input.missingDocs) {
    alerts.push({
      tone: 'warn',
      icon: 'assignment_late',
      title: 'Missing Documents',
      body: 'One or more required documents are missing. Document completeness is below target.',
      actionLabel: 'Request Documents',
    });
  }

  return alerts;
}

export async function getBorrowerSummary(borrowerId: string) {
  const profile = await prisma.borrowerProfile.findUnique({ where: { id: borrowerId } });

  if (!profile) {
    throw new AppError('Borrower profile not found', 404);
  }

  const [creditProfile, income, latestBureauReport, applications, documents, latestRiskRun] = await Promise.all([
    prisma.borrowerCreditProfile.findUnique({ where: { borrowerId } }),
    prisma.borrowerIncome.findUnique({ where: { borrowerId } }),
    prisma.borrowerBureauReport.findFirst({
      where: { borrowerId },
      orderBy: { uploadedAt: 'desc' },
      include: { facilities: true },
    }),
    prisma.creditApplication.findMany({
      where: { borrowerProfileId: borrowerId },
      select: { state: true },
    }),
    prisma.creditDocument.findMany({
      where: { borrowerProfileId: borrowerId, deletedAt: null },
      select: { classification: true, verificationStatus: true },
    }),
    getLatestBorrowerRiskRun(borrowerId),
  ]);

  const fresh = bureauFreshness(latestBureauReport?.uploadedAt ?? null);
  const applicationReadiness = await getBorrowerApplicationReadiness(borrowerId);
  const activeApps = applications.filter((application: { state: string }) => !['CLOSED', 'REJECTED', 'WITHDRAWN'].includes(application.state)).length;
  const docCompletion = computeDocumentCompletion(profile.borrowerType, documents);
  const facilities = latestBureauReport?.facilities ?? [];
  const riskAssessment = buildBorrowerRiskPresentation({
    riskRun: latestRiskRun
      ? {
          effectiveRiskRating: latestRiskRun.effectiveRiskRating,
          baseRiskRating: latestRiskRun.baseRiskRating,
          totalScore: Number(latestRiskRun.totalScore),
          scorecardVersion: latestRiskRun.scorecardVersion,
          runAt: latestRiskRun.runAt,
          missingInputs: latestRiskRun.missingInputs,
          reasonCodes: latestRiskRun.reasonCodes,
          bureauCapsApplied: latestRiskRun.bureauCapsApplied,
          factorScores: latestRiskRun.factorScores,
        }
      : null,
    bureau: { stale: fresh.stale, uploadedAt: latestBureauReport?.uploadedAt ?? null },
    applicationReadiness,
    docCompletionPct: docCompletion.completionPct,
    kycVerified: Boolean(profile.kycVerifiedAt),
    compliancePass: Boolean(profile.kycVerifiedAt) && !profile.isSanctionedEntity,
  });

  return {
    borrowerId,
    borrowerType: profile.borrowerType,
    borrowerName: profile.name,
    riskGrade: creditProfile?.riskGrade ?? profile.creditRiskRating ?? null,
    riskRating: latestRiskRun
      ? {
          effective: latestRiskRun.effectiveRiskRating,
          base: latestRiskRun.baseRiskRating,
          calculatedAt: latestRiskRun.runAt,
          version: latestRiskRun.scorecardVersion,
          reasonCodes: latestRiskRun.reasonCodes ?? [],
          missingInputs: latestRiskRun.missingInputs ?? [],
          bureauCapsApplied: latestRiskRun.bureauCapsApplied ?? [],
        }
      : null,
    riskAssessment,
    creditScore: creditProfile?.creditScore ?? null,
    scoreBand: creditProfile?.scoreBand ?? null,
    dsrPercent: creditProfile?.dsrPercent != null ? Number(creditProfile.dsrPercent) : null,
    netDsrPercent: creditProfile?.netDsrPercent != null ? Number(creditProfile.netDsrPercent) : null,
    totalExposure: Number(profile.totalExposure ?? 0),
    activeApps,
    docCompletionPct: docCompletion.completionPct,
    documentChecklist: {
      requiredCount: docCompletion.requiredCount,
      collectedCount: docCompletion.collectedCount,
      outstandingCount: docCompletion.requiredCount - docCompletion.collectedCount,
      completionPct: docCompletion.completionPct,
      outstandingGroups: docCompletion.outstandingGroups,
    },
    facilityCount: facilities.length,
    compliancePass: Boolean(profile.kycVerifiedAt) && !profile.isSanctionedEntity,
    bureau: {
      source: latestBureauReport?.source ?? null,
      uploadedAt: latestBureauReport?.uploadedAt ?? null,
      daysOld: fresh.days,
      stale: fresh.stale,
    },
    income: income
      ? {
          gross: Number(income.monthlyGrossIncome),
          commitments:
            Number(income.hirePurchaseCommitment) +
            Number(income.creditCardCommitment) +
            Number(income.existingLoanCommitment) +
            Number(income.otherCommitments),
          netIncome: income.monthlyNetIncome != null ? Number(income.monthlyNetIncome) : null,
          details: {
            employmentType: income.employmentType,
            employerName: income.employerName,
            monthlyGrossIncome: Number(income.monthlyGrossIncome),
            epfMonthlyAmount: income.epfMonthlyAmount != null ? Number(income.epfMonthlyAmount) : null,
            monthlyTaxDeduction: Number(income.monthlyTaxDeduction),
            monthlySocsoDeduction: Number(income.monthlySocsoDeduction),
            hirePurchaseCommitment: Number(income.hirePurchaseCommitment),
            creditCardCommitment: Number(income.creditCardCommitment),
            existingLoanCommitment: Number(income.existingLoanCommitment),
            otherCommitments: Number(income.otherCommitments),
          },
        }
      : null,
    bureauFacilities: facilities,
    alerts: buildAlerts({ bureauStale: fresh.stale, missingDocs: docCompletion.completionPct < 100 }),
    applicationReadiness,
  };
}
