import { ApplicationState, FacilityType } from '../../src/services/credit.service';

export const formatCurrency = (val: number | string | null, currency = 'MYR') =>
  val != null ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: currency as any, maximumFractionDigits: 0 }).format(Number(val)) : '—';

export const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const formatDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const STATE_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: '#6366f120', text: '#6366f1' },
  SUBMITTED: { bg: '#f59e0b20', text: '#d97706' },
  KYC_REVIEW: { bg: '#3b82f620', text: '#2563eb' },
  KYC_APPROVED: { bg: '#22c55e20', text: '#16a34a' },
  KYC_REJECTED: { bg: '#ef444420', text: '#dc2626' },
  UNDERWRITING: { bg: '#8b5cf620', text: '#7c3aed' },
  CREDIT_ASSESSMENT: { bg: '#a78bfa20', text: '#7c3aed' },
  COMMITTEE_REVIEW: { bg: '#f9731620', text: '#ea580c' },
  APPROVED: { bg: '#22c55e20', text: '#16a34a' },
  REJECTED: { bg: '#ef444420', text: '#dc2626' },
  OFFER: { bg: '#06b6d420', text: '#0891b2' },
  ACCEPTED: { bg: '#14b8a620', text: '#0d9488' },
  DISBURSED: { bg: '#06b6d420', text: '#0891b2' },
  ACTIVE: { bg: '#22c55e20', text: '#16a34a' },
  CLOSED: { bg: '#6b728020', text: '#6b7280' },
  WITHDRAWN: { bg: '#6b728020', text: '#6b7280' },
};

export const STATE_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  KYC_REVIEW: 'KYC Review',
  KYC_APPROVED: 'KYC Approved',
  KYC_REJECTED: 'KYC Rejected',
  UNDERWRITING: 'Underwriting',
  CREDIT_ASSESSMENT: 'Credit Assessment',
  COMMITTEE_REVIEW: 'Committee Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  OFFER: 'Offer',
  ACCEPTED: 'Accepted',
  DISBURSED: 'Disbursed',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
  WITHDRAWN: 'Withdrawn',
};

export const STEPPER_STAGES: { key: string; label: string; states: ApplicationState[] }[] = [
  { key: 'draft', label: 'Draft', states: ['DRAFT'] },
  { key: 'kyc', label: 'KYC Review', states: ['SUBMITTED', 'KYC_REVIEW', 'KYC_APPROVED', 'KYC_REJECTED'] },
  { key: 'assessment', label: 'Assessment', states: ['UNDERWRITING', 'CREDIT_ASSESSMENT'] },
  { key: 'decision', label: 'Decision', states: ['COMMITTEE_REVIEW', 'APPROVED', 'REJECTED'] },
  { key: 'offer', label: 'Offer', states: ['OFFER', 'ACCEPTED'] },
  { key: 'active', label: 'Active', states: ['DISBURSED', 'ACTIVE', 'CLOSED', 'WITHDRAWN'] },
];

export const PRODUCT_LABELS: Record<string, string> = {
  TERM_LOAN: 'Term Loan', REVOLVING_CREDIT: 'Revolving Credit', TRADE_FINANCE: 'Trade Finance',
  PROJECT_FINANCE: 'Project Finance', SYNDICATED: 'Syndicated', BRIDGE_LOAN: 'Bridge Loan',
  OVERDRAFT: 'Overdraft', LETTER_OF_CREDIT: 'Letter of Credit', BANK_GUARANTEE: 'Bank Guarantee',
};

export const FACILITY_TYPES: { value: FacilityType; label: string }[] = [
  { value: 'TERM_LOAN', label: 'Term Loan' }, { value: 'REVOLVING_CREDIT', label: 'Revolving Credit' },
  { value: 'OVERDRAFT', label: 'Overdraft' }, { value: 'LETTER_OF_CREDIT', label: 'Letter of Credit' },
  { value: 'BANK_GUARANTEE', label: 'Bank Guarantee' }, { value: 'TRADE_FINANCE', label: 'Trade Finance' },
  { value: 'BRIDGE_LOAN', label: 'Bridge Loan' }, { value: 'PROJECT_FINANCE', label: 'Project Finance' },
];

export const PHASE2_FACILITY_TYPES: { value: FacilityType; label: string }[] = [
  { value: 'CASHLINE', label: 'Cashline (Islamic)' },
  { value: 'RWC_I', label: 'Revolving Credit (Islamic)' },
  { value: 'LC_I', label: 'Letter of Credit (Islamic)' },
  { value: 'BG_I', label: 'Bank Guarantee (Islamic)' },
  { value: 'ICMTD_I', label: 'Istisna Credit (Islamic)' },
];

export function getFacilityTypes(islamicEnabled: boolean): { value: FacilityType; label: string }[] {
  return islamicEnabled ? [...FACILITY_TYPES, ...PHASE2_FACILITY_TYPES] : FACILITY_TYPES;
}

export const CURRENCIES = ['MYR', 'USD', 'SGD', 'GBP', 'EUR', 'JPY', 'CNY', 'THB', 'IDR', 'AUD', 'HKD'] as const;

export type DetailTab = 'header' | 'summary' | 'facilities' | 'risk-rating' | 'payment-capability' | 'security' | 'profitability' | 'counterparties' | 'conduct' | 'credit-checks' | 'industry' | 'risk' | 'esg' | 'sicr' | 'signoff' | 'parties' | 'documents' | 'approvals' | 'audit' | 'collateral' | 'conditions';

export interface TabDefinition {
  id: DetailTab;
  label: string;
}

export interface TabGroup {
  id: string;
  label: string;
  tabs: TabDefinition[];
}

export const TAB_GROUPS: TabGroup[] = [
  {
    id: 'phase1',
    label: 'Phase 1: Header & Background',
    tabs: [
      { id: 'header', label: 'Header' }
    ]
  },
  {
    id: 'phase2',
    label: 'Phase 2: Facilities & Requests',
    tabs: [
      { id: 'facilities', label: 'Facilities' }
    ]
  },
  {
    id: 'phase3',
    label: 'Phase 3: Risk Rating & ECL',
    tabs: [
      { id: 'risk-rating', label: 'Risk & ECL' },
      { id: 'payment-capability', label: 'Payment Capability' }
    ]
  },
  {
    id: 'phase4',
    label: 'Phase 4: Security & Guarantees',
    tabs: [
      { id: 'security', label: 'Security' },
      { id: 'collateral', label: 'Collateral' },
      { id: 'profitability', label: 'Profitability' },
      { id: 'counterparties', label: 'Counterparties' },
      { id: 'conduct', label: 'Account Conduct' }
    ]
  },
  {
    id: 'phase5',
    label: 'Phase 5: Credit Checks',
    tabs: [
      { id: 'credit-checks', label: 'Bureau Checks' },
      { id: 'industry', label: 'Industry Outlook' },
      { id: 'risk', label: 'Risk & Mitigators' },
      { id: 'esg', label: 'ESG' },
      { id: 'sicr', label: 'SICR' },
      { id: 'signoff', label: 'Sign-off' }
    ]
  },
  {
    id: 'phase6',
    label: 'Phase 6: Summary & Conditions',
    tabs: [
      { id: 'summary', label: 'Summary' },
      { id: 'conditions', label: 'Conditions' }
    ]
  },
  {
    id: 'meta',
    label: 'Meta & Operations',
    tabs: [
      { id: 'parties', label: 'Parties' },
      { id: 'documents', label: 'Documents' },
      { id: 'approvals', label: 'Approvals' },
      { id: 'audit', label: 'Audit Trail' }
    ]
  }
];

export const ALL_TABS: DetailTab[] = TAB_GROUPS.flatMap(g => g.tabs.map(t => t.id));

// ── Phase Completion Logic ────────────────────────────────────

export type PhaseStatus = 'complete' | 'incomplete' | 'optional';

export interface PhaseCompletion {
  groupId: string;
  status: PhaseStatus;
}

/**
 * Determines completion status for each TAB_GROUP based on fields present
 * on the CreditApplication object and its related arrays.
 *
 * Rules per phase:
 *  phase1  — applicationType + accountClassification + preambleText all filled
 *  phase2  — at least one facility exists
 *  phase3  — riskRating + firstWayOut both filled
 *  phase4  — at least one party linked (guarantors / co-borrowers)
 *  phase5  — preparedAt timestamp set (sign-off section completed)
 *  phase6  — purpose filled
 *  meta    — always optional (no completion gate)
 */
export function getPhaseCompletion(app: {
  applicationType?: string | null;
  accountClassification?: string | null;
  preambleText?: string | null;
  riskRating?: string | null;
  firstWayOut?: string | null;
  purpose?: string | null;
  preparedAt?: string | null;
  facilities?: unknown[];
  parties?: unknown[];
}): Record<string, PhaseStatus> {
  const hasValue = (v: unknown) => v != null && String(v).trim() !== '';

  return {
    phase1: (
      hasValue(app.applicationType) &&
      hasValue(app.accountClassification) &&
      hasValue(app.preambleText)
    ) ? 'complete' : 'incomplete',

    phase2: (app.facilities && app.facilities.length > 0)
      ? 'complete' : 'incomplete',

    phase3: (
      hasValue(app.riskRating) &&
      hasValue(app.firstWayOut)
    ) ? 'complete' : 'incomplete',

    phase4: (app.parties && app.parties.length > 0)
      ? 'complete' : 'incomplete',

    phase5: hasValue(app.preparedAt) ? 'complete' : 'incomplete',

    phase6: hasValue(app.purpose) ? 'complete' : 'incomplete',

    meta: 'optional',
  };
}

/** Returns number of required phases that are incomplete. */
export function getIncompletePhaseCount(completion: Record<string, PhaseStatus>): number {
  return Object.values(completion).filter(s => s === 'incomplete').length;
}

/**
 * Returns the first tab ID belonging to the first incomplete (non-optional) phase,
 * or null if all phases are complete.
 */
export function getNextIncompleteTab(completion: Record<string, PhaseStatus>): DetailTab | null {
  for (const group of TAB_GROUPS) {
    if (completion[group.id] === 'incomplete') {
      return group.tabs[0].id;
    }
  }
  return null;
}