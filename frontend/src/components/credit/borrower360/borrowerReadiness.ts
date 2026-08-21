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

const isBusinessBorrower = (profile: BorrowerProfile) => ['CORPORATE', 'SOLE_PROPRIETOR'].includes(profile.borrowerType);
const isIndividualBorrower = (profile: BorrowerProfile) => ['INDIVIDUAL', 'JOINT'].includes(profile.borrowerType);

export function calculateBorrowerReadiness(input: {
  profile: BorrowerProfile;
  summary: Borrower360Summary | null;
  applications: CreditApplication[];
}): BorrowerReadiness {
  const { profile, summary, applications } = input;
  const actions: BorrowerNextAction[] = [];
  let completedChecks = 0;
  let applicableChecks = 0;

  const identityChecks = [
    { missing: !profile.name?.trim(), id: 'identity_name', title: 'Add borrower name', description: 'A borrower name is required before an application can be started.' },
    ...(isIndividualBorrower(profile) ? [
      { missing: !profile.nricPassport?.trim(), id: 'identity_reference', title: 'Add NRIC / Passport', description: 'The identity reference is required for this borrower type.' },
      { missing: !profile.dateOfBirth, id: 'identity_dob', title: 'Add date of birth', description: 'Date of birth is required for this borrower type.' },
      { missing: !profile.nationality?.trim(), id: 'identity_nationality', title: 'Add nationality', description: 'Nationality is required for this borrower type.' },
    ] : []),
    ...(isBusinessBorrower(profile) ? [
      { missing: !profile.registrationNumber?.trim(), id: 'business_registration', title: 'Add registration number', description: 'The registration number is required for this borrower type.' },
      { missing: !profile.dateOfIncorporation, id: 'business_incorporation', title: 'Add incorporation date', description: 'The incorporation date is required for this borrower type.' },
      { missing: !profile.businessNature?.trim(), id: 'business_nature', title: 'Add business nature', description: 'Business nature is required for this borrower type.' },
    ] : []),
  ];
  applicableChecks += identityChecks.length;
  identityChecks.forEach((check) => {
    if (check.missing) actions.push(action(check.id, 'BLOCKER', check.title, check.description, 'Edit borrower', 'profile'));
    else completedChecks += 1;
  });

  applicableChecks += 1;
  if (profile.phone?.trim() || profile.email?.trim()) completedChecks += 1;
  else actions.push(action('contact', 'BLOCKER', 'Add primary contact', 'At least one phone number or email is required before an application can be started.', 'Edit borrower', 'profile'));

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
  else {
    const checklist = summary?.documentChecklist;
    const description = checklist
      ? `${checklist.collectedCount} of ${checklist.requiredCount} required document groups are ready; ${checklist.outstandingCount} remain. Upload at least ${Math.min(checklist.requiredCount, Math.ceil(checklist.requiredCount * 0.8))} to continue.`
      : 'Required documents are incomplete. Review the document checklist.';
    actions.push(action('documents', 'WARNING', 'Complete documents', description, 'Review documents', 'documents'));
  }

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
