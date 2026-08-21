export type BorrowerRiskRatingStatus = 'NOT_CALCULATED' | 'CALCULATED' | 'INCOMPLETE' | 'DECISION_READY';
export type BorrowerRiskActionTarget = 'profile' | 'bureau' | 'income' | 'financials' | 'kyc' | 'documents' | 'risk';

export interface BorrowerRiskMissingInput {
  code: string;
  title: string;
  description: string;
  target: BorrowerRiskActionTarget;
  actionLabel: string;
}

export interface BorrowerRiskPresentationInput {
  riskRun: {
    effectiveRiskRating: string;
    baseRiskRating: string;
    totalScore: unknown;
    scorecardVersion: number | null;
    runAt: Date | string;
    missingInputs: unknown;
    reasonCodes: unknown;
    bureauCapsApplied: unknown;
  } | null;
  bureau: { stale: boolean; uploadedAt: Date | string | null };
  applicationReadiness: { ready: boolean; blockers: unknown[] } | null;
  docCompletionPct: number;
  kycVerified: boolean;
  compliancePass: boolean;
}

export interface BorrowerRiskPresentation {
  ratingStatus: BorrowerRiskRatingStatus;
  effectiveRating: string | null;
  baseRating: string | null;
  score: number | null;
  scorecardVersion: number | null;
  calculatedAt: Date | string | null;
  missingInputs: BorrowerRiskMissingInput[];
  reasonCodes: Array<{ code: string; label: string }>;
  bureauCaps: Array<{ code: string; label: string }>;
  nextAction: { target: BorrowerRiskActionTarget; label: string } | null;
  applicationImpact: 'ALLOWED' | 'BLOCKED' | 'NOT_AVAILABLE';
  assessmentImpact: 'INCOMPLETE' | 'READY' | 'NOT_CALCULATED';
}

const MISSING_INPUTS: Record<string, Omit<BorrowerRiskMissingInput, 'code'>> = {
  bureau_score: {
    title: 'Bureau score missing',
    description: 'A current bureau score is required to complete the borrower risk assessment.',
    target: 'bureau',
    actionLabel: 'Upload bureau report',
  },
  borrower_income: {
    title: 'Income information missing',
    description: 'Income and commitments are required for the affordability assessment.',
    target: 'income',
    actionLabel: 'Edit income & DSR',
  },
  financial_statement: {
    title: 'Financial statement missing',
    description: 'An approved financial statement is required for this borrower type.',
    target: 'financials',
    actionLabel: 'Open financial spreading',
  },
  bureau_report: {
    title: 'Bureau report needs refresh',
    description: 'The bureau report is missing or outside the current freshness window.',
    target: 'bureau',
    actionLabel: 'Refresh bureau report',
  },
  kyc: {
    title: 'KYC verification incomplete',
    description: 'KYC verification must be completed before assessment decisioning.',
    target: 'kyc',
    actionLabel: 'Verify KYC',
  },
  documents: {
    title: 'Required documents incomplete',
    description: 'Review the borrower document checklist before assessment decisioning.',
    target: 'documents',
    actionLabel: 'Review documents',
  },
};

const CAP_LABELS: Record<string, string> = {
  borrower_score_lt_300: 'Bureau score below 300 — rating capped',
  borrower_score_lt_500: 'Bureau score below 500 — rating capped',
  facility_impaired: 'Impaired facility on bureau report — rating capped',
  facility_rescheduled: 'Rescheduled/restructured facility — rating capped',
  facility_watchlist: 'Watchlist facility — rating capped',
};

const asStringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const asReasonCodes = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is { code: string; label: string } => Boolean(item && typeof item === 'object' && typeof (item as any).code === 'string' && typeof (item as any).label === 'string'))
  : [];

export function buildBorrowerRiskPresentation(input: BorrowerRiskPresentationInput): BorrowerRiskPresentation {
  if (!input.riskRun) {
    return {
      ratingStatus: 'NOT_CALCULATED', effectiveRating: null, baseRating: null, score: null,
      scorecardVersion: null, calculatedAt: null, missingInputs: [], reasonCodes: [], bureauCaps: [],
      nextAction: { target: 'risk', label: 'Calculate risk rating' }, applicationImpact: input.applicationReadiness?.ready ? 'ALLOWED' : 'BLOCKED',
      assessmentImpact: 'NOT_CALCULATED',
    };
  }

  const rawMissing = asStringArray(input.riskRun.missingInputs);
  const missingCodes = [...rawMissing];
  if (input.bureau.stale && !missingCodes.includes('bureau_report')) missingCodes.push('bureau_report');
  if (!input.kycVerified && !missingCodes.includes('kyc')) missingCodes.push('kyc');
  if (input.docCompletionPct < 100 && !missingCodes.includes('documents')) missingCodes.push('documents');

  const missingInputs = missingCodes.map((code) => ({ code, ...(MISSING_INPUTS[code] ?? {
    title: 'Assessment input needs attention', description: 'A required assessment input is incomplete or unavailable.', target: 'risk' as const, actionLabel: 'Review risk assessment',
  }) }));
  const decisionReady = missingInputs.length === 0 && input.applicationReadiness?.ready === true && input.compliancePass;
  const first = missingInputs[0];

  return {
    ratingStatus: decisionReady ? 'DECISION_READY' : missingInputs.length > 0 ? 'INCOMPLETE' : 'CALCULATED',
    effectiveRating: input.riskRun.effectiveRiskRating,
    baseRating: input.riskRun.baseRiskRating,
    score: Number(input.riskRun.totalScore),
    scorecardVersion: input.riskRun.scorecardVersion,
    calculatedAt: input.riskRun.runAt,
    missingInputs,
    reasonCodes: asReasonCodes(input.riskRun.reasonCodes),
    bureauCaps: asStringArray(input.riskRun.bureauCapsApplied).map((code) => ({ code, label: CAP_LABELS[code] ?? 'Bureau policy cap applied' })),
    nextAction: first ? { target: first.target, label: first.actionLabel } : { target: 'risk', label: 'Recalculate risk rating' },
    applicationImpact: input.applicationReadiness?.ready ? 'ALLOWED' : 'BLOCKED',
    assessmentImpact: decisionReady ? 'READY' : 'INCOMPLETE',
  };
}