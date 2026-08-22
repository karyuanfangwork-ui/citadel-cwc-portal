import { SubmissionReadinessIssue, SubmissionReadinessResult } from '../../../services/credit.service';
import {
  ApplicationWorkspaceArea,
  resolveWorkspaceAreaFromTab,
} from './applicationWorkspaceAreas';

export type ApplicationReadinessStatus = 'ready' | 'blocked' | 'warning' | 'loading' | 'unavailable';
export type ReadinessItemSeverity = 'blocker' | 'warning' | 'complete';

export interface ApplicationReadinessItem {
  id: string;
  severity: ReadinessItemSeverity;
  title: string;
  description?: string;
  targetArea?: ApplicationWorkspaceArea;
  targetLocalTab?: string;
  utility?: 'documents' | 'activity-audit';
  sourceField?: string;
}

export interface ApplicationNextAction {
  title: string;
  description?: string;
  label: string;
  targetArea?: ApplicationWorkspaceArea;
  targetTab?: string;
  utility?: 'documents' | 'activity-audit';
}

export interface ApplicationReadinessViewModel {
  stage: string;
  status: ApplicationReadinessStatus;
  completedCount: number;
  totalCount: number;
  blockers: ApplicationReadinessItem[];
  warnings: ApplicationReadinessItem[];
  satisfied: ApplicationReadinessItem[];
  nextAction?: ApplicationNextAction;
  error?: string;
}

export interface BuildApplicationReadinessViewModelInput {
  applicationState: string;
  readiness: SubmissionReadinessResult | null;
  readinessLoading?: boolean;
  readinessError?: string | null;
}

const FIELD_TITLES: Record<string, string> = {
  application: 'Complete Application Details',
  facilities: 'Complete Facilities',
  borrowerProfile: 'Complete Borrower Profile',
  scoreOverride: 'Resolve Risk Score Override',
  collateral: 'Complete Collateral & Guarantees',
  parties: 'Complete Related Parties',
  financials: 'Complete Financial Statements',
  bureauChecks: 'Complete Bureau Verification',
  bureauChecklist: 'Complete Bureau Verification',
  retailIncome: 'Complete Retail Income / DSR',
  exposureLimit: 'Review Exposure Limit',
  fatcaCrs: 'Complete FATCA/CRS Declaration',
  ecl: 'Complete ECL Assessment',
  ltv: 'Complete LTV Assessment',
  dscr: 'Complete DSCR Assessment',
  recommendation: 'Complete Recommendation',
};

const FIELD_DESTINATIONS: Record<string, { area: ApplicationWorkspaceArea; tab: string }> = {
  application: { area: 'application-parties', tab: 'application' },
  facilities: { area: 'application-parties', tab: 'facilities' },
  borrowerProfile: { area: 'application-parties', tab: 'borrower' },
  scoreOverride: { area: 'risk-compliance', tab: 'risk-rating' },
  collateral: { area: 'risk-compliance', tab: 'collateral-guarantees' },
  parties: { area: 'application-parties', tab: 'related-parties' },
  financials: { area: 'financials', tab: 'statements' },
  bureauChecks: { area: 'risk-compliance', tab: 'bureau-kyc' },
  bureauChecklist: { area: 'risk-compliance', tab: 'bureau-kyc' },
  retailIncome: { area: 'financials', tab: 'income' },
  exposureLimit: { area: 'risk-compliance', tab: 'risk-rating' },
  fatcaCrs: { area: 'risk-compliance', tab: 'compliance' },
  ecl: { area: 'risk-compliance', tab: 'risk-rating' },
  ltv: { area: 'risk-compliance', tab: 'collateral-guarantees' },
  dscr: { area: 'financials', tab: 'repayment-capacity' },
  recommendation: { area: 'assessment-recommendation', tab: 'recommendation' },
};

const FIELD_ALIASES: Record<string, string> = {
  loanPurpose: 'application',
  purpose: 'application',
  requiredFields: 'application',
  requiredField: 'application',
  requiredDocuments: 'documents',
  document: 'documents',
  documentRequirements: 'documents',
  riskRating: 'scoreOverride',
};

const stageForState = (state: string): string => {
  if (state === 'CREDIT_ASSESSMENT' || state === 'COMMITTEE_REVIEW') return 'committee';
  if (state === 'APPROVED' || state === 'CONDITION_FULFILMENT' || state === 'OFFER' || state === 'ACCEPTED') return 'completion';
  return 'submission';
};

const normalizeField = (field: string): string => {
  const normalized = field.trim();
  if (FIELD_ALIASES[normalized]) return FIELD_ALIASES[normalized];
  if (normalized.toLowerCase().startsWith('financial')) return 'financials';
  return normalized;
};

const documentTitle = (message: string): string => {
  const match = message.match(/missing\s*:\s*(.+)$/i)
    || message.match(/not verified\s*:\s*(.+)$/i)
    || message.match(/^required\s*:\s*(.+)$/i);
  const documentName = match?.[1]?.trim().replace(/[.]+$/, '');
  if (!documentName) return 'Upload Required Document';
  const label = documentName.replace(/[_-]+/g, ' ').toLowerCase();
  return `Upload ${label.replace(/\b\w/g, character => character.toUpperCase())}`;
};

const titleForIssue = (field: string, issue: SubmissionReadinessIssue): string => {
  if (field === 'documents') return documentTitle(issue.message);
  return FIELD_TITLES[field] || 'Complete Required Information';
};

const destinationForIssue = (field: string, issue: SubmissionReadinessIssue) => {
  if (field === 'documents') {
    return { area: 'documents' as const, tab: 'documents', utility: 'documents' as const };
  }

  const structuredDestination = FIELD_DESTINATIONS[field];
  if (structuredDestination) return structuredDestination;

  if (issue.tab) {
    return { area: resolveWorkspaceAreaFromTab(issue.tab), tab: issue.tab };
  }

  return undefined;
};

const toItem = (issue: SubmissionReadinessIssue, severity: ReadinessItemSeverity, index: number): ApplicationReadinessItem => {
  const field = normalizeField(issue.field);
  const destination = destinationForIssue(field, issue);
  return {
    id: `${severity}-${issue.field}-${index}`,
    severity,
    title: titleForIssue(field, issue),
    description: issue.message,
    targetArea: destination?.area,
    targetLocalTab: destination?.tab,
    utility: destination && 'utility' in destination ? destination.utility : undefined,
    sourceField: issue.field,
  };
};

const actionLabel = (item: ApplicationReadinessItem): string => {
  if (item.utility === 'documents') return 'Open Documents';
  if (item.targetArea === 'financials') return 'Go to Financials';
  if (item.targetArea === 'application-parties') return 'Go to Application & Parties';
  if (item.targetArea === 'risk-compliance') return 'Go to Risk & Compliance';
  if (item.targetArea === 'assessment-recommendation') return 'Go to Assessment & Recommendation';
  if (item.targetArea === 'decision-completion') return 'Go to Decision & Completion';
  return 'Review Requirement';
};

export const buildApplicationReadinessViewModel = ({
  applicationState,
  readiness,
  readinessLoading = false,
  readinessError = null,
}: BuildApplicationReadinessViewModelInput): ApplicationReadinessViewModel => {
  if (readinessLoading || !readiness) {
    return {
      stage: stageForState(applicationState),
      status: readinessLoading ? 'loading' : 'unavailable',
      completedCount: 0,
      totalCount: 0,
      blockers: [],
      warnings: [],
      satisfied: [],
      error: readinessError || undefined,
    };
  }

  const blockers = readiness.errors.map((issue, index) => toItem(issue, 'blocker', index));
  const blockerFields = new Set(blockers.map(item => normalizeField(item.sourceField || '')));
  const warnings = readiness.warnings
    .filter(issue => !blockerFields.has(normalizeField(issue.field)))
    .map((issue, index) => toItem(issue, 'warning', index));
  const satisfied = readiness.satisfied.map((issue, index) => toItem(issue, 'complete', index));
  const status: ApplicationReadinessStatus = blockers.length > 0
    ? 'blocked'
    : readiness.ready
      ? warnings.length > 0 ? 'warning' : 'ready'
      : 'blocked';
  const firstBlocker = blockers[0];

  return {
    stage: stageForState(applicationState),
    status,
    completedCount: satisfied.length,
    totalCount: blockers.length + warnings.length + satisfied.length,
    blockers,
    warnings,
    satisfied,
    nextAction: firstBlocker ? {
      title: firstBlocker.title,
      description: firstBlocker.description,
      label: actionLabel(firstBlocker),
      targetArea: firstBlocker.targetArea,
      targetTab: firstBlocker.targetLocalTab,
      utility: firstBlocker.utility,
    } : undefined,
  };
};
