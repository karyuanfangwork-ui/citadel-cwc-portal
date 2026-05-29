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

export type DetailTab = 'header' | 'summary' | 'facilities' | 'risk-rating' | 'payment-capability' | 'security' | 'profitability' | 'counterparties' | 'conduct' | 'credit-checks' | 'industry' | 'risk' | 'forward-looking-risk' | 'signoff' | 'parties' | 'documents' | 'approvals' | 'audit' | 'collateral' | 'conditions';

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
    label: 'Header & Background',
    tabs: [
      { id: 'header', label: 'Header' }
    ]
  },
  {
    id: 'phase2',
    label: 'Facilities & Requests',
    tabs: [
      { id: 'facilities', label: 'Facilities' }
    ]
  },
  {
    id: 'phase3',
    label: 'Risk Rating & ECL',
    tabs: [
      { id: 'risk-rating', label: 'Risk & ECL' },
      { id: 'payment-capability', label: 'Payment Capability' }
    ]
  },
  {
    id: 'phase4',
    label: 'Security & Guarantees',
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
    label: 'Credit Checks',
    tabs: [
      { id: 'credit-checks', label: 'Bureau Checks' },
      { id: 'industry', label: 'Industry Outlook' },
      { id: 'risk', label: 'Risk & Mitigators' },
      { id: 'forward-looking-risk', label: 'Forward-Looking Risk' },
      { id: 'signoff', label: 'Sign-off' }
    ]
  },
  {
    id: 'phase6',
    label: 'Summary & Conditions',
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

// ── §3.9 Smart Defaults ─────────────────────────────────────────

/** Default tenor (months) by product type */
const PRODUCT_DEFAULT_TENOR: Record<string, number> = {
  TERM_LOAN: 60,
  REVOLVING_CREDIT: 12,
  TRADE_FINANCE: 6,
  PROJECT_FINANCE: 84,
  SYNDICATED: 60,
  BRIDGE_LOAN: 12,
  OVERDRAFT: 12,
  LETTER_OF_CREDIT: 6,
  BANK_GUARANTEE: 12,
};

/** Common borrower home currency by country code (ISO 3166-1 alpha-2) */
const COUNTRY_DEFAULT_CURRENCY: Record<string, string> = {
  MY: 'MYR',
  SG: 'SGD',
  GB: 'GBP',
  US: 'USD',
  AU: 'AUD',
  CN: 'CNY',
  JP: 'JPY',
  TH: 'THB',
  ID: 'IDR',
  HK: 'HKD',
};

export interface SmartDefaultOptions {
  /** Borrower profile object (for currency, domicile) */
  borrower?: {
    homeCurrency?: string | null;
    countryOfRegistration?: string | null;
    countryOfResidence?: string | null;
  } | null;
  /** Selected product type (for tenor) */
  productType?: string | null;
  /** Current user (for RM default) */
  currentUser?: {
    id: string;
    roles?: string[];
  } | null;
  /** Users with approval permission (for reviewer suggestion) */
  approvalUsers?: { id: string; name: string }[] | null;
}

export interface SmartDefaults {
  /** Suggested currency based on borrower domicile */
  currency: string;
  /** Suggested tenor in months based on product type */
  tenorMonths: number;
  /** Suggested assigned RM ID (current user if they're an RM, otherwise null) */
  assignedRmId: string | null;
  /** Suggested reviewer name from approval users (excluding current user) */
  suggestedReviewer: string | null;
}

/**
 * §3.9 Smart Defaults
 *
 * Computes default values for new credit application forms:
 * - Currency → borrower home currency (or MYR fallback)
 * - Tenor → product default (or 60 months fallback)
 * - Assigned RM → current user if they're an RM
 * - Suggested reviewer → first approval user who isn't the current maker
 */
export function getSmartDefaults(options: SmartDefaultOptions): SmartDefaults {
  const { borrower, productType, currentUser, approvalUsers } = options;

  // Currency: borrower's home currency, or infer from country, or fallback MYR
  const currency =
    borrower?.homeCurrency ||
    (borrower?.countryOfRegistration && COUNTRY_DEFAULT_CURRENCY[borrower.countryOfRegistration]) ||
    (borrower?.countryOfResidence && COUNTRY_DEFAULT_CURRENCY[borrower.countryOfResidence]) ||
    'MYR';

  // Tenor: product default or 60 months
  const tenorMonths = (productType && PRODUCT_DEFAULT_TENOR[productType]) || 60;

  // Assigned RM: current user if they have credit:rm role
  const isRm = currentUser?.roles?.some(r => r === 'credit:rm' || r === 'CREDIT_RM') ?? false;
  const assignedRmId = isRm ? currentUser!.id : null;

  // Suggested reviewer: first approval user who isn't the current user
  const suggestedReviewer = (approvalUsers && currentUser)
    ? approvalUsers.find(u => u.id !== currentUser.id)?.name ?? null
    : null;

  return { currency, tenorMonths, assignedRmId, suggestedReviewer };
}