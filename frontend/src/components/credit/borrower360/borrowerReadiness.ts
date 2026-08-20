import type {
  ApplicationState,
  Borrower360Summary,
  BorrowerProfile,
  CreditApplication,
} from '../../../services/credit.service';

export type BorrowerReadinessStatus = 'READY' | 'WARNING' | 'BLOCKED';
export type BorrowerActionSeverity = 'BLOCKER' | 'WARNING' | 'INFO' | 'DONE';

export interface BorrowerNextAction {
  id: string;
  severity: BorrowerActionSeverity;
  title: string;
  description: string;
  actionLabel: string;
  target: 'profile' | 'income' | 'bureau' | 'documents' | 'risk' | 'application';
}

export interface BorrowerReadiness {
  status: BorrowerReadinessStatus;
  completionPct: number;
  outstandingCount: number;
  actions: BorrowerNextAction[];
}

const ACTION_ORDER: Record<BorrowerActionSeverity, number> = {
  BLOCKER: 0,
  WARNING: 1,
  INFO: 2,
  DONE: 3,
};

const action = (
  id: string,
  severity: BorrowerActionSeverity,
  title: string,
  description: string,
  actionLabel: string,
  target: BorrowerNextAction['target'],
): BorrowerNextAction => ({ id, severity, title, description, actionLabel, target });

const isBusinessBorrower = (profile: BorrowerProfile) => profile.borrowerType !== 'INDIVIDUAL';

export function calculateBorrowerReadiness(input: {
  profile: BorrowerProfile;
  summary: Borrower360Summary | null;
  applications: CreditApplication[];
}): BorrowerReadiness {
  const { profile, summary, applications } = input;
  const actions: BorrowerNextAction[] = [];
  let completedChecks = 0;
  let applicableChecks = 0;

  const identityPresent = Boolean(
    profile.name?.trim() && (isBusinessBorrower(profile) ? profile.registrationNumber : profile.nricPassport),
  );
  applicableChecks += 1;
  if (identityPresent) completedChecks += 1;
  else actions.push(action('identity', 'BLOCKER', 'Complete identity details', 'Add the borrower name and required identity reference.', 'Edit borrower', 'profile'));

  applicableChecks += 1;
  if (profile.kycVerifiedAt) completedChecks += 1;
  else actions.push(action('kyc', 'BLOCKER', 'Verify KYC', 'Identity verification is required before the borrower is ready.', 'Verify KYC', 'profile'));

  const hasFinancials = isBusinessBorrower(profile) ? Boolean(profile.annualTurnover || profile.financialStatements?.length) : Boolean(summary?.income);
  applicableChecks += 1;
  if (hasFinancials) completedChecks += 1;
  else actions.push(action(
    isBusinessBorrower(profile) ? 'financials' : 'income',
    'BLOCKER',
    isBusinessBorrower(profile) ? 'Add financial statements' : 'Add income information',
    isBusinessBorrower(profile) ? 'Turnover or financial statements are needed for assessment.' : 'Income and commitments are needed for assessment.',
    isBusinessBorrower(profile) ? 'Add financials' : 'Edit income',
    'income',
  ));

  const bureauFresh = Boolean(summary?.bureau.daysOld != null && !summary.bureau.stale);
  applicableChecks += 1;
  if (bureauFresh) completedChecks += 1;
  else actions.push(action('bureau', 'WARNING', 'Refresh bureau report', 'The bureau report is missing or outside the current freshness window.', 'Upload bureau report', 'bureau'));

  const documentsComplete = (summary?.docCompletionPct ?? 0) >= 80;
  applicableChecks += 1;
  if (documentsComplete) completedChecks += 1;
  else actions.push(action('documents', 'WARNING', 'Complete documents', 'At least 80% of required documents should be available.', 'Review documents', 'documents'));

  if (applications.length > 0) {
    applicableChecks += 1;
    const riskRating = profile.creditRiskRating || summary?.riskRating?.effective || summary?.riskGrade;
    if (riskRating) completedChecks += 1;
    else actions.push(action('risk', 'WARNING', 'Complete risk assessment', 'A risk rating is required for an active application.', 'Review risk', 'risk'));
  }

  actions.sort((left, right) => ACTION_ORDER[left.severity] - ACTION_ORDER[right.severity]);
  const hasBlocker = actions.some((item) => item.severity === 'BLOCKER');
  return {
    status: hasBlocker ? 'BLOCKED' : actions.length > 0 ? 'WARNING' : 'READY',
    completionPct: applicableChecks === 0 ? 0 : Math.round((completedChecks / applicableChecks) * 100),
    outstandingCount: actions.length,
    actions,
  };
}

const CONTINUABLE_STATES: ApplicationState[] = ['DRAFT', 'REFERRED_BACK'];

export function getPrimaryApplicationAction(applications: CreditApplication[]): {
  label: 'Start application' | 'Continue application' | 'View application';
  applicationId: string | null;
} {
  const draft = applications.find((application) => CONTINUABLE_STATES.includes(application.state));
  if (draft) return { label: 'Continue application', applicationId: draft.id };
  const application = applications[0];
  return application
    ? { label: 'View application', applicationId: application.id }
    : { label: 'Start application', applicationId: null };
}
