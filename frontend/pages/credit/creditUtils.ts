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
  COMPLIANCE_HOLD: { bg: '#ef444420', text: '#dc2626' },
  KYC_APPROVED: { bg: '#22c55e20', text: '#16a34a' },
  KYC_REJECTED: { bg: '#ef444420', text: '#dc2626' },
  UNDERWRITING: { bg: '#8b5cf620', text: '#7c3aed' },
  CREDIT_ASSESSMENT: { bg: '#a78bfa20', text: '#7c3aed' },
  COMMITTEE_REVIEW: { bg: '#f9731620', text: '#ea580c' },
  APPROVED: { bg: '#22c55e20', text: '#16a34a' },
  REJECTED: { bg: '#ef444420', text: '#dc2626' },
  CONDITION_FULFILMENT: { bg: '#f59e0b20', text: '#d97706' },
  OFFER: { bg: '#06b6d420', text: '#0891b2' },
  ACCEPTED: { bg: '#14b8a620', text: '#0d9488' },
  DISBURSED: { bg: '#06b6d420', text: '#0891b2' },
  ACTIVE: { bg: '#22c55e20', text: '#16a34a' },
  CLOSED: { bg: '#6b728020', text: '#6b7280' },
  REFERRED_BACK: { bg: '#f59e0b20', text: '#d97706' },
  WITHDRAWN: { bg: '#6b728020', text: '#6b7280' },
};

export const STATE_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  KYC_REVIEW: 'KYC Review',
  COMPLIANCE_HOLD: 'Compliance Hold',
  KYC_APPROVED: 'KYC Approved',
  KYC_REJECTED: 'KYC Rejected',
  UNDERWRITING: 'Underwriting',
  CREDIT_ASSESSMENT: 'Credit Assessment',
  COMMITTEE_REVIEW: 'Committee Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CONDITION_FULFILMENT: 'Condition Fulfilment',
  OFFER: 'Offer',
  ACCEPTED: 'Accepted',
  DISBURSED: 'Disbursed',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
  WITHDRAWN: 'Withdrawn',
  REFERRED_BACK: 'Referred Back',
};

// §8.1 — Icons paired with each state for accessibility (colour+icon, not colour alone)
export const STATE_ICONS: Record<string, string> = {
  DRAFT: 'edit_note',
  SUBMITTED: 'send',
  KYC_REVIEW: 'fact_check',
  COMPLIANCE_HOLD: 'gpp_maybe',
  KYC_APPROVED: 'how_to_reg',
  KYC_REJECTED: 'person_off',
  UNDERWRITING: 'analytics',
  CREDIT_ASSESSMENT: 'scoreboard',
  COMMITTEE_REVIEW: 'groups',
  APPROVED: 'check_circle',
  REJECTED: 'cancel',
  CONDITION_FULFILMENT: 'assignment_late',
  OFFER: 'mail',
  ACCEPTED: 'thumb_up',
  DISBURSED: 'payments',
  ACTIVE: 'trending_up',
  CLOSED: 'lock',
  WITHDRAWN: 'undo',
  REFERRED_BACK: 'subdirectory_arrow_left',
};

export const STEPPER_STAGES: { key: string; label: string; states: ApplicationState[] }[] = [
  { key: 'draft', label: 'Draft', states: ['DRAFT'] },
  { key: 'kyc', label: 'KYC Review', states: ['SUBMITTED', 'KYC_REVIEW', 'COMPLIANCE_HOLD', 'KYC_APPROVED', 'KYC_REJECTED'] },
  { key: 'assessment', label: 'Assessment', states: ['UNDERWRITING', 'CREDIT_ASSESSMENT'] },
  { key: 'referred', label: 'Referred Back', states: ['REFERRED_BACK'] },
  { key: 'decision', label: 'Decision', states: ['COMMITTEE_REVIEW', 'APPROVED', 'REJECTED'] },
  { key: 'condition', label: 'Condition Fulfilment', states: ['CONDITION_FULFILMENT'] },
  { key: 'offer', label: 'Offer', states: ['OFFER', 'ACCEPTED'] },
  { key: 'active', label: 'Active', states: ['DISBURSED', 'ACTIVE', 'CLOSED', 'WITHDRAWN'] },
];

// ── Application 360: Borrower Segment Detection ──────────────────────

export type BorrowerSegment = 'retail' | 'sme' | 'corporate';

export const SEGMENT_LABELS: Record<BorrowerSegment, string> = {
  retail: 'Retail',
  sme: 'SME',
  corporate: 'Corporate',
};

export const SEGMENT_COLORS: Record<BorrowerSegment, { bg: string; text: string }> = {
  retail: { bg: '#dbeafe', text: '#1e40af' },
  sme: { bg: '#fef3c7', text: '#92400e' },
  corporate: { bg: '#ede9fe', text: '#5b21b6' },
};

/**
 * Infers the borrower segment from borrowerType.
 * INDIVIDUAL / JOINT → retail, SOLE_PROPRIETOR → sme, CORPORATE → corporate.
 * No new schema field is required.
 */
export function getBorrowerSegment(borrowerType: string | null | undefined): BorrowerSegment {
  if (borrowerType === 'CORPORATE') return 'corporate';
  if (borrowerType === 'SOLE_PROPRIETOR') return 'sme';
  return 'retail'; // INDIVIDUAL, JOINT, null → retail
}

// ── Application 360: 11-Stage Journey Stepper ────────────────────────

export interface JourneyStage {
  key: string;
  label: string;
  index: number;
  targetTab: DetailTab360; // which 360 tab clicking this stage navigates to
}

export const JOURNEY_STAGES: JourneyStage[] = [
  { key: 'lead', label: 'Lead', index: 0, targetTab: 'overview' },
  { key: 'onboarding', label: 'Onboarding', index: 1, targetTab: 'customer-profile' },
  { key: 'application', label: 'Application', index: 2, targetTab: 'application-details' },
  { key: 'documents', label: 'Documents', index: 3, targetTab: 'documents' },
  { key: 'financial', label: 'Financial', index: 4, targetTab: 'financial-profile' },
  { key: 'credit', label: 'Credit', index: 5, targetTab: 'risk-assessment' },
  { key: 'approval', label: 'Approval', index: 6, targetTab: 'approvals' },
  { key: 'offer', label: 'Offer', index: 7, targetTab: 'conditions-offer' },
  { key: 'legal', label: 'Legal', index: 8, targetTab: 'documents' },
  { key: 'disbursement', label: 'Disbursement', index: 9, targetTab: 'disbursement' },
  { key: 'post', label: 'Post', index: 10, targetTab: 'timeline-audit' },
];

/**
 * Maps ApplicationState to the 11-stage journey index.
 * Pure frontend mapping — no backend state changes needed.
 */
export function getJourneyStage(state: string | null | undefined): number {
  if (!state) return 0;
  const s = state as ApplicationState;
  switch (s) {
    case 'DRAFT': return 2;
    case 'SUBMITTED':
    case 'KYC_REVIEW': return 1;
    case 'COMPLIANCE_HOLD': return 1;
    case 'KYC_APPROVED': return 3;
    case 'KYC_REJECTED': return 1;
    case 'UNDERWRITING': return 4;
    case 'CREDIT_ASSESSMENT': return 5;
    case 'REFERRED_BACK': return 2;
    case 'COMMITTEE_REVIEW': return 6;
    case 'APPROVED': return 7;
    case 'CONDITION_FULFILMENT': return 7;
    case 'REJECTED': return 6;
    case 'OFFER': return 7;
    case 'ACCEPTED': return 8;
    case 'DISBURSED': return 9;
    case 'ACTIVE': return 10;
    case 'CLOSED': return 10;
    case 'WITHDRAWN': return 2;
    default: return 0;
  }
}

/** Product types hidden from frontend dropdowns (bank-grade). */
export const HIDDEN_PRODUCT_TYPES: string[] = ['SYNDICATED', 'PROJECT_FINANCE'];

export const PRODUCT_LABELS: Record<string, string> = {
  TERM_LOAN: 'Term Loan', REVOLVING_CREDIT: 'Revolving Credit', TRADE_FINANCE: 'Trade Finance',
  PROJECT_FINANCE: 'Project Finance', SYNDICATED: 'Syndicated', BRIDGE_LOAN: 'Bridge Loan',
  OVERDRAFT: 'Overdraft', LETTER_OF_CREDIT: 'Letter of Credit', BANK_GUARANTEE: 'Bank Guarantee',
};

/** P2-1: Visible product labels — excludes hidden product types for dropdowns/selectors. */
export const VISIBLE_PRODUCT_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(PRODUCT_LABELS).filter(([key]) => !HIDDEN_PRODUCT_TYPES.includes(key)),
);

/** P2-1: Visible product types for dropdowns — excludes SYNDICATED and PROJECT_FINANCE. */
export const VISIBLE_PRODUCT_TYPES: { value: string; label: string }[] = Object.entries(VISIBLE_PRODUCT_LABELS)
  .map(([value, label]) => ({ value, label }));

/** Product types that always require collateral (secured deals). */
export const SECURED_PRODUCTS: string[] = [
  'TERM_LOAN',
  'PROJECT_FINANCE',
  'SYNDICATED',
  'BRIDGE_LOAN',
  'LETTER_OF_CREDIT',
  'BANK_GUARANTEE',
];

/** P2-1: Visible secured products — excludes hidden product types from collateral-required logic for new applications. */
export const VISIBLE_SECURED_PRODUCTS: string[] = SECURED_PRODUCTS.filter(p => !HIDDEN_PRODUCT_TYPES.includes(p));

export const FACILITY_TYPES: { value: FacilityType; label: string }[] = [
  { value: 'TERM_LOAN', label: 'Term Loan' }, { value: 'REVOLVING_CREDIT', label: 'Revolving Credit' },
  { value: 'OVERDRAFT', label: 'Overdraft' }, { value: 'LETTER_OF_CREDIT', label: 'Letter of Credit' },
  { value: 'BANK_GUARANTEE', label: 'Bank Guarantee' }, { value: 'TRADE_FINANCE', label: 'Trade Finance' },
  { value: 'BRIDGE_LOAN', label: 'Bridge Loan' }, { value: 'PROJECT_FINANCE', label: 'Project Finance' },
];

/** P2-1: Visible facility types — excludes hidden product types from dropdowns/selectors. */
export const VISIBLE_FACILITY_TYPES: { value: FacilityType; label: string }[] = FACILITY_TYPES.filter(
  ft => !HIDDEN_PRODUCT_TYPES.includes(ft.value),
);

export const PHASE2_FACILITY_TYPES: { value: FacilityType; label: string }[] = [
  { value: 'CASHLINE', label: 'Cashline (Islamic)' },
  { value: 'RWC_I', label: 'Revolving Credit (Islamic)' },
  { value: 'LC_I', label: 'Letter of Credit (Islamic)' },
  { value: 'BG_I', label: 'Bank Guarantee (Islamic)' },
  { value: 'ICMTD_I', label: 'Istisna Credit (Islamic)' },
];

export function getFacilityTypes(islamicEnabled: boolean): { value: FacilityType; label: string }[] {
  const base = islamicEnabled ? [...VISIBLE_FACILITY_TYPES, ...PHASE2_FACILITY_TYPES] : VISIBLE_FACILITY_TYPES;
  return base;
}

// ── Application Details Enhancement: Structuring field labels ────────────────

export const REPAYMENT_TYPE_LABELS: Record<string, string> = {
  EMI: 'EMI (Equal Monthly Installment)',
  BULLET: 'Bullet (Principal at Maturity)',
  INTEREST_ONLY: 'Interest Only',
  LUMP_SUM: 'Lump Sum at Maturity',
  CUSTOM: 'Custom Schedule',
};

export const REPAYMENT_FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMI_ANNUAL: 'Semi-Annual',
  ANNUAL: 'Annual',
  LUMP_SUM: 'Lump Sum at Maturity',
};

export const REPAYMENT_TYPE_OPTIONS = Object.entries(REPAYMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }));
export const REPAYMENT_FREQUENCY_OPTIONS = Object.entries(REPAYMENT_FREQUENCY_LABELS).map(([value, label]) => ({ value, label }));

export const CURRENCIES = ['MYR', 'USD', 'SGD', 'GBP', 'EUR', 'JPY', 'CNY', 'THB', 'IDR', 'AUD', 'HKD'] as const;

// ── CA Memo Redesign: 7-Section Structure ──────────────────────
//
// S1  Loan Request          — amount, tenor, product, purpose, currency
// S2  Borrower Profile      — identity, KYC, directors, UBOs, shareholders
// S3  Financials            — 3-year P&L + BS, ratios
// S4  Risk Score             — scorecard run, internal rating, DSR stress
// S5  Bureau & Compliance   — CCRIS, CTOS, SSM eInfo, AML/PEP
// S6  Collateral & Guarantees — collateral, valuation, FSV, guarantees
// S7  Decision              — approve/reject, terms, conditions, sign-off
// META — cross-cutting operations (documents, audit trail)
//
// Bank-only tabs (ECL, SICR, ESG, Profitability, WalletShare, AccountConduct,
// Counterparties, ForwardLookingRisk, Sensitivity, CashflowProjection) are
// hidden from the default nav. They can be restored via the
// `credit:advanced_memo` feature flag (Wave E).

export type DetailTab =
  // Overview — summary dashboard
  | 'overview'
  // S1 — Loan Request
  | 'loan-request'
  // S2 — Borrower Profile
  | 'borrower-profile'
  | 'parties'
  // S3 — Financials
  | 'financials'
  // S4 — Risk Score
  | 'risk-score'
  | 'payment-capability'
  // P2-3 — SME Simplified Financials
  | 'sme-financials'
  // S5 — Bureau & Compliance (consolidated accordion)
  | 'credit-checks-risk'
  // S5 — Bureau & Compliance (legacy sub-tabs, redirected to consolidated)
  | 'credit-checks'
  | 'industry'
  | 'risk'
  // S6 — Collateral & Guarantees
  | 'collateral'
  | 'security'
  // S7 — Decision
  | 'approvals'
  | 'signoff'
  | 'guarantor-assessment'
  | 'conditions'
  | 'summary'
  // META — Operations
  | 'documents'
  | 'comments'
  | 'audit'
  // Disbursement (visible in ACCEPTED / DISBURSED / CLOSED states)
  | 'disbursement'
  // Bank-only tabs (hidden by default, restored via credit:advanced_memo flag)
  | 'risk-rating'
  | 'profitability'
  | 'counterparties'
  | 'conduct'
  | 'forward-looking-risk'
  | 'facilities'
  | 'header'
  // AI Insights (A4/A5/A6/A13/A15)
  | 'ai-insights';

export interface TabDefinition {
  id: DetailTab;
  label: string;
}

export interface TabGroup {
  id: string;
  label: string;
  tabs: TabDefinition[];
  /** Whether this group is only visible with credit:advanced_memo flag */
  advancedOnly?: boolean;
  /** Application states in which this group is visible. Undefined = always visible. */
  states?: ApplicationState[];
}

export const TAB_GROUPS: TabGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    tabs: [{ id: 'overview', label: 'Overview' }],
  },
  {
    id: 's1',
    label: 'S1 · Loan Request',
    tabs: [
      { id: 'loan-request', label: 'Loan Request' },
      { id: 'facilities', label: 'Facilities' },
    ],
  },
  {
    id: 's2',
    label: 'S2 · Borrower Profile',
    tabs: [
      { id: 'borrower-profile', label: 'Profile & KYC' },
      { id: 'parties', label: 'Directors & UBOs' },
    ],
  },
  {
    id: 's3',
    label: 'S3 · Financials',
    tabs: [
      { id: 'financials', label: 'Financials' },
    ],
  },
  {
    id: 's4',
    label: 'S4 · Risk Score',
    tabs: [
      { id: 'risk-score', label: 'Scorecard & Rating' },
      { id: 'payment-capability', label: 'Payment Capability' },
      { id: 'sme-financials', label: 'SME Financials' },
    ],
  },
  {
    id: 's5',
    label: 'S5 · Credit Checks & Risk',
    tabs: [
      { id: 'credit-checks-risk', label: 'Credit Checks & Risk' },
    ],
  },
  {
    id: 's6',
    label: 'S6 · Collateral & Guarantees',
    tabs: [
      { id: 'collateral', label: 'Collateral' },
      { id: 'security', label: 'Security & Guarantees' },
    ],
  },
  {
    id: 's7',
    label: 'S7 · Decision',
    tabs: [
      { id: 'signoff', label: 'Sign-off' },
      { id: 'approvals', label: 'Approval Chain' },
      { id: 'guarantor-assessment', label: 'Guarantor Assessment' },
      { id: 'conditions', label: 'Conditions' },
      { id: 'summary', label: 'Summary' },
    ],
  },
  {
    id: 's7-disbursement',
    label: 'Disbursement',
    tabs: [
      { id: 'disbursement', label: 'Disbursement Orders' },
    ],
    // Only visible when application is in these states
    states: ['ACCEPTED', 'DISBURSED', 'ACTIVE', 'CLOSED'],
  },
  {
    id: 'meta',
    label: 'Operations',
    tabs: [
      { id: 'documents', label: 'Documents' },
      { id: 'comments', label: 'Comments' },
      { id: 'audit', label: 'Audit Trail' },
    ],
  },
  // ── Bank-only groups (hidden unless credit:advanced_memo flag is set) ──
  {
    id: 'adv-risk-rating',
    label: 'Risk Rating & ECL',
    tabs: [
      { id: 'risk-rating', label: 'Risk & ECL' },
    ],
    advancedOnly: true,
  },
  {
    id: 'adv-financial-analysis',
    label: 'Bank Financial Analysis',
    tabs: [
      { id: 'profitability', label: 'Profitability' },
      { id: 'counterparties', label: 'Counterparties' },
      { id: 'conduct', label: 'Account Conduct' },
    ],
    advancedOnly: true,
  },
  {
    id: 'adv-forward-risk',
    label: 'Forward-Looking Risk',
    tabs: [
      { id: 'forward-looking-risk', label: 'ESG / SICR / FL Risk' },
    ],
    advancedOnly: true,
  },
  {
    id: 'adv-legacy',
    label: 'Legacy Sections',
    tabs: [
      { id: 'header', label: 'Header & Background' },
      { id: 'facilities', label: 'Facilities (Legacy)' },
    ],
    advancedOnly: true,
  },
];

export const ALL_TABS: DetailTab[] = TAB_GROUPS.flatMap(g => g.tabs.map(t => t.id));

// ── Application 360 Tab Type ──
// New Application 360 tab system replacing the legacy 30+ DetailTab values.
// During Pass 2, DetailTab360 coexists with DetailTab.
// After Pass 2 finalization (Step 2.11), DetailTab will be removed.

export type DetailTab360 =
  | 'overview'
  | 'customer-profile'
  | 'application-details'
  | 'financial-profile'
  | 'credit-bureau'
  | 'risk-assessment'
  | 'collateral-guarantees'
  | 'documents'
  | 'ca-memo'
  | 'approvals'
  | 'conditions-offer'
  | 'disbursement'
  | 'timeline-audit';

export const TAB_GROUPS_360: TabGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    tabs: [{ id: 'overview' as DetailTab360 as unknown as DetailTab, label: 'Overview' }],
  },
  {
    id: 'customer-profile',
    label: 'Borrower Profile',
    tabs: [{ id: 'customer-profile' as DetailTab360 as unknown as DetailTab, label: 'Borrower Profile' }],
  },
  {
    id: 'application-details',
    label: 'Application Details',
    tabs: [{ id: 'application-details' as DetailTab360 as unknown as DetailTab, label: 'Application Details' }],
  },
  {
    id: 'financial-profile',
    label: 'Financial Profile',
    tabs: [{ id: 'financial-profile' as DetailTab360 as unknown as DetailTab, label: 'Financial Profile' }],
  },
  {
    id: 'risk-assessment',
    label: 'Risk Assessment',
    tabs: [{ id: 'risk-assessment' as DetailTab360 as unknown as DetailTab, label: 'Risk Assessment' }],
  },
  {
    id: 'credit-bureau',
    label: 'Credit Bureau & Compliance',
    tabs: [{ id: 'credit-bureau' as DetailTab360 as unknown as DetailTab, label: 'Credit Bureau & Compliance' }],
  },
  {
    id: 'collateral-guarantees',
    label: 'Collateral & Guarantees',
    tabs: [{ id: 'collateral-guarantees' as DetailTab360 as unknown as DetailTab, label: 'Collateral & Guarantees' }],
  },
  {
    id: 'documents',
    label: 'Documents',
    tabs: [{ id: 'documents' as DetailTab360 as unknown as DetailTab, label: 'Documents' }],
  },
  {
    id: 'ca-memo',
    label: 'CA Memo',
    tabs: [{ id: 'ca-memo' as DetailTab360 as unknown as DetailTab, label: 'CA Memo' }],
  },
  {
    id: 'approvals',
    label: 'Approvals',
    tabs: [{ id: 'approvals' as DetailTab360 as unknown as DetailTab, label: 'Approvals' }],
  },
  {
    id: 'conditions-offer',
    label: 'Conditions & Offer',
    tabs: [{ id: 'conditions-offer' as DetailTab360 as unknown as DetailTab, label: 'Conditions & Offer' }],
  },
  {
    id: 'disbursement',
    label: 'Disbursement',
    tabs: [{ id: 'disbursement' as DetailTab360 as unknown as DetailTab, label: 'Disbursement' }],
  },
  {
    id: 'timeline-audit',
    label: 'Timeline & Audit',
    tabs: [{ id: 'timeline-audit' as DetailTab360 as unknown as DetailTab, label: 'Timeline & Audit' }],
  },
];

export const ALL_TABS_360: DetailTab360[] = TAB_GROUPS_360.flatMap(g => g.tabs.map(t => t.id as DetailTab360));

/**
 * Mapping from legacy DetailTab to new DetailTab360.
 * During Pass 2, old tab IDs redirect to their new home.
 * After Pass 2, this mapping is removed and only DetailTab360 is used.
 */
export const TAB_TO_TAB360: Record<DetailTab, DetailTab360> = {
  'overview': 'overview',
  'loan-request': 'application-details',
  'borrower-profile': 'customer-profile',
  'parties': 'customer-profile',
  'financials': 'financial-profile',
  'risk-score': 'risk-assessment',
  'payment-capability': 'financial-profile',
  'sme-financials': 'financial-profile',
  'credit-checks-risk': 'credit-bureau',
  'credit-checks': 'credit-bureau',
  'industry': 'risk-assessment',
  'risk': 'risk-assessment',
  'collateral': 'collateral-guarantees',
  'security': 'collateral-guarantees',
  'approvals': 'approvals',
  'signoff': 'approvals',
  'guarantor-assessment': 'collateral-guarantees',
  'conditions': 'conditions-offer',
  'summary': 'conditions-offer',
  'documents': 'documents',
  'comments': 'timeline-audit',
  'audit': 'timeline-audit',
  'disbursement': 'disbursement',
  'risk-rating': 'risk-assessment',
  'profitability': 'risk-assessment',
  'counterparties': 'risk-assessment',
  'conduct': 'risk-assessment',
  'forward-looking-risk': 'risk-assessment',
  'facilities': 'application-details',
  'header': 'application-details',
  'ai-insights': 'risk-assessment',
};

/**
 * Mapping from new DetailTab360 to the primary legacy DetailTab for rendering.
 * During Pass 2, new tab IDs map to old tab content.
 * As each new tab component is built, it replaces the legacy redirect.
 */
export const TAB360_TO_LEGACY: Record<DetailTab360, DetailTab> = {
  'overview': 'overview',
  'customer-profile': 'borrower-profile',
  'application-details': 'loan-request',
  'financial-profile': 'financials',
  'credit-bureau': 'credit-checks-risk',
  'risk-assessment': 'risk-score',
  'collateral-guarantees': 'collateral',
  'documents': 'documents',
  'ca-memo': 'overview',
  'approvals': 'approvals',
  'conditions-offer': 'conditions',
  'disbursement': 'disbursement',
  'timeline-audit': 'audit',
};

/**
 * P2-1: Feature-flag key mapping for bank-grade tabs.
 * Each tab/group ID maps to the feature flag that gates its visibility.
 * Tabs without a flag key are always visible (core flow).
 */
export const TAB_FEATURE_FLAGS: Partial<Record<DetailTab, string>> = {
  'risk-rating': 'credit:ecl',
  'profitability': 'credit:profitability',
  'counterparties': 'credit:counterparties',
  'conduct': 'credit:account_conduct',
  'forward-looking-risk': 'credit:esg',  // ESG/SICR/FL Risk combined tab
};

/** Group-level feature flags — these hide the entire group, not just individual tabs. */
export const GROUP_FEATURE_FLAGS: Record<string, string> = {
  'adv-risk-rating': 'credit:ecl',
  'adv-financial-analysis': 'credit:profitability',  // profitability + counterparties + conduct
  'adv-forward-risk': 'credit:esg',                  // ESG / SICR / FL Risk
};

/** FATCA/CRS section within borrower-profile tab is gated separately. */
export const FATCA_CRS_FLAG = 'credit:fatca_crs';

// ── P2-2: Processing Lanes ────────────────────────────────────────────────────

/** Processing lane types — determines tab set and approval depth. */
export type ProcessingLane = 'PERSONAL_FAST' | 'SME' | 'CORPORATE';

/** Human-readable labels for each processing lane. */
export const LANE_LABELS: Record<ProcessingLane, string> = {
  PERSONAL_FAST: 'Personal Fast',
  SME: 'SME',
  CORPORATE: 'Corporate',
};

/** Lane descriptions shown in tooltips / info banners. */
export const LANE_DESCRIPTIONS: Record<ProcessingLane, string> = {
  PERSONAL_FAST: 'Individual borrower ≤ RM150k — streamlined 7-section flow, 2 approvals',
  SME: 'SME borrower (turnover < RM5M) — 12-tab flow, 2-eye approval',
  CORPORATE: 'Full corporate assessment — comprehensive flow, matrix-based approval',
};

/**
 * P2-2: Map a tab ID to the minimum lane that includes it.
 * Tabs not listed here appear in ALL lanes (core tabs).
 */
export const TAB_MIN_LANE: Partial<Record<DetailTab, ProcessingLane>> = {
  'collateral': 'SME',
  'security': 'SME',
  'conditions': 'SME',
  'payment-capability': 'SME',
  'risk-score': 'SME',
  'sme-financials': 'SME',
  'parties': 'CORPORATE',
  'industry': 'CORPORATE',
  'guarantor-assessment': 'CORPORATE',
  'approvals': 'CORPORATE',
  'audit': 'CORPORATE',
};

/**
 * Check if a tab is visible for a given lane.
 * Core tabs (not in TAB_MIN_LANE) are always visible.
 */
export function isTabVisibleForLane(tabId: DetailTab, lane: ProcessingLane): boolean {
  const minLane = TAB_MIN_LANE[tabId];
  if (!minLane) return true; // Core tab — always visible

  const LANE_ORDER: Record<ProcessingLane, number> = {
    PERSONAL_FAST: 0,
    SME: 1,
    CORPORATE: 2,
  };

  return LANE_ORDER[lane] >= LANE_ORDER[minLane];
}

/** Get the lane-appropriate tab list. */
export function getLaneTabIds(lane: ProcessingLane): DetailTab[] {
  // Start with core tabs (visible in all lanes)
  const coreTabs: DetailTab[] = [
    'overview', 'loan-request', 'borrower-profile', 'financials', 'credit-checks-risk', 'signoff', 'documents', 'comments',
  ];

  const smeTabs: DetailTab[] = [
    'collateral', 'security', 'conditions', 'payment-capability', 'risk-score', 'sme-financials',
  ];

  const corporateTabs: DetailTab[] = [
    'parties', 'guarantor-assessment', 'approvals', 'audit',
  ];

  const tabs = [...coreTabs];

  if (lane === 'SME' || lane === 'CORPORATE') {
    tabs.push(...smeTabs);
  }

  if (lane === 'CORPORATE') {
    tabs.push(...corporateTabs);
  }

  tabs.push('summary');
  return tabs;
}

/** Return the default tab groups (S1-S7 + meta), optionally including bank-only groups.
 *  Pass borrowerType to suppress tabs irrelevant for individual/retail borrowers.
 *  Pass featureFlags (from useCreditFeatureFlags) to filter bank-grade tabs.
 *  Pass lane (from useApplicationLane) to filter tabs by processing lane (P2-2). */
export function getVisibleTabGroups(
  advancedMemo: boolean,
  borrowerType?: string | null,
  applicationState?: string | null,
  featureFlags?: Record<string, boolean>,
  lane?: ProcessingLane | null,
): TabGroup[] {
  const isRetail = borrowerType === 'INDIVIDUAL' || borrowerType === 'SOLE_PROPRIETOR';
  const isFlagEnabled = (flagKey: string): boolean => featureFlags?.[flagKey] ?? false;

  return TAB_GROUPS
    .filter(g => !g.advancedOnly || advancedMemo)
    // P2-1: Filter out groups gated by feature flags
    .filter(g => {
      if (g.advancedOnly && GROUP_FEATURE_FLAGS[g.id]) {
        return isFlagEnabled(GROUP_FEATURE_FLAGS[g.id]);
      }
      return true;
    })
    .filter(g => !g.states || !applicationState || g.states.includes(applicationState as ApplicationState))
    .map(g => {
      // P2-1: Filter out individual tabs gated by feature flags
      // P2-2: Filter out tabs not visible for the current lane
      const tabFiltered = {
        ...g,
        tabs: g.tabs.filter(t => {
          const flagKey = TAB_FEATURE_FLAGS[t.id];
          // If a tab has a feature flag key, only show it when the flag is enabled
          if (flagKey && !g.advancedOnly) {
            return isFlagEnabled(flagKey);
          }
          // P2-2: Lane-based filtering — hide tabs above the current lane
          if (lane && !isTabVisibleForLane(t.id, lane)) {
            return false;
          }
          return true;
        }),
      };

      if (!isRetail) return tabFiltered;
      // For retail: relabel parties tab, but keep payment-capability 
      // (Way Out is universal; Projection/Sensitivity are hidden inside the component)
      const filteredTabs = tabFiltered.tabs
        .map(t => t.id === 'parties' ? { ...t, label: 'Guarantors & Parties' } : t);
      return filteredTabs.some((t, i) => t.label !== tabFiltered.tabs[i]?.label)
        ? { ...tabFiltered, tabs: filteredTabs }
        : tabFiltered;
    })
    .filter(g => g.tabs.length > 0);
}

// ── Section Completion Logic (7-section model) ─────────────────

export type PhaseStatus = 'complete' | 'incomplete' | 'optional';

export interface PhaseCompletion {
  groupId: string;
  status: PhaseStatus;
}

/**
 * Determines completion status for each of the 7 sections based on
 * the CreditApplication data.
 *
 * S1  Loan Request     — requestedAmount + requestedTenor + productType + purpose
 * S2  Borrower Profile — borrowerType + (registrationNumber OR individualId) + ≥1 director
 * S3  Financials       — ≥1 FinancialStatement with ≥1 FinancialLineItem
 * S4  Risk Score       — riskRating filled (≥1 CreditScoreRun linked)
 * S5  Bureau           — ≥1 CreditBureauCheck (CCRIS or CTOS)
 * S6  Collateral       — optional (unsecured lending path); required if secured product
 * S7  Decision         — ≥1 CreditDecision record (decisionedAt set)
 * META — always optional (no completion gate)
 */
export function getPhaseCompletion(app: {
  requestedAmount?: number | string | null;
  requestedTenor?: number | string | null;
  productType?: string | null;
  purpose?: string | null;
  lane?: string | null;
  borrowerType?: string | null;
  registrationNumber?: string | null;
  riskRating?: string | null;
  scoreRunCount?: number | null;
  latestScoreRunAt?: string | null;
  latestScoreRunStatus?: string | null;
  firstWayOut?: string | null;
  preparedAt?: string | null;
  decisionedAt?: string | null;
  facilities?: unknown[];
  parties?: unknown[];
  financialStatements?: unknown[];
  creditBureauChecks?: unknown[];
  creditDecisions?: unknown[];
  isSecured?: boolean;
  retailIncome?: { monthlyGrossIncome?: unknown } | null;
  bureauChecklist?: {
    ccrisUploaded?: boolean;
    ctosUploaded?: boolean;
    noAdverseRecord?: boolean;
    adverseExceptionReason?: string | null;
    amlScreeningDone?: boolean;
  } | null;
}): Record<string, PhaseStatus> {
  const hasValue = (v: unknown) => v != null && String(v).trim() !== '';

  return {
    s1: (
      hasValue(app.requestedAmount) &&
      hasValue(app.requestedTenor) &&
      hasValue(app.productType) &&
      hasValue(app.purpose) &&
      (
        app.lane === 'PERSONAL_FAST'
          ? true
          : (app.facilities && app.facilities.length > 0)
      )
    ) ? 'complete' : 'incomplete',

    s2: (() => {
      if (!hasValue(app.borrowerType)) return false;
      const isRetail = app.borrowerType === 'INDIVIDUAL' || app.borrowerType === 'SOLE_PROPRIETOR';
      if (isRetail) {
        // For retail: borrowerType set is sufficient (NRIC is on CrmContact, not the application)
        return true;
      }
      // For corporate: need registrationNumber + at least one director/party
      return hasValue(app.registrationNumber) && (app.parties && app.parties.length > 0);
    })() ? 'complete' : 'incomplete',

    s3: (
      (app.borrowerType === 'INDIVIDUAL' || app.borrowerType === 'SOLE_PROPRIETOR')
        ? (app.retailIncome != null && app.retailIncome.monthlyGrossIncome != null)
        : (app.financialStatements && app.financialStatements.length > 0)
    ) ? 'complete' : 'incomplete',

    s4: (
      Number(app.scoreRunCount ?? 0) > 0 || hasValue(app.latestScoreRunAt)
    ) ? 'complete' : 'incomplete',

    s5: (() => {
      const cl = app.bureauChecklist;
      if (!cl) return false;
      return (
        Boolean(cl.ccrisUploaded) &&
        Boolean(cl.ctosUploaded) &&
        Boolean(cl.amlScreeningDone) &&
        (Boolean(cl.noAdverseRecord) || Boolean(cl.adverseExceptionReason))
      );
    })() ? 'complete' : 'incomplete',

    s6: app.isSecured
      ? ((app.facilities && app.facilities.length > 0) ? 'complete' : 'incomplete')
      : 'optional',

    s7: hasValue(app.decisionedAt) ? 'complete' : 'incomplete',

    meta: 'optional',
  };
}

/** Returns number of required sections that are incomplete. */
export function getIncompletePhaseCount(completion: Record<string, PhaseStatus>): number {
  return Object.values(completion).filter(s => s === 'incomplete').length;
}

/** Map section/phase completion keys to their default tab ID for navigation. */
export const PHASE_TO_TAB_MAP: Record<string, string> = {
  s1: 'loan-request',
  s2: 'borrower-profile',
  s3: 'financials',
  s4: 'risk-score',
  s5: 'credit-bureau',
  s6: 'collateral',
  s7: 'approvals',
  meta: 'documents',
};

/** Reverse map: tab ID → phase completion key (s1-s7 / meta). */
export const TAB_TO_PHASE_MAP: Record<string, string> = {};
for (const [phase, tab] of Object.entries(PHASE_TO_TAB_MAP)) {
  TAB_TO_PHASE_MAP[tab] = phase;
}
// Assign remaining tabs to their parent phase
TAB_TO_PHASE_MAP['parties'] = 's2';
TAB_TO_PHASE_MAP['facilities'] = 's1';
TAB_TO_PHASE_MAP['payment-capability'] = 's4';
TAB_TO_PHASE_MAP['sme-financials'] = 's4';
TAB_TO_PHASE_MAP['credit-checks-risk'] = 's5';
// Legacy S5 sub-tab IDs still map to s5 for backward compat
TAB_TO_PHASE_MAP['credit-checks'] = 's5';
TAB_TO_PHASE_MAP['industry'] = 's5';
TAB_TO_PHASE_MAP['risk'] = 's5';
TAB_TO_PHASE_MAP['ai-insights'] = 's5';
TAB_TO_PHASE_MAP['security'] = 's6';
TAB_TO_PHASE_MAP['signoff'] = 's7';
TAB_TO_PHASE_MAP['guarantor-assessment'] = 's7';
TAB_TO_PHASE_MAP['conditions'] = 's7';
TAB_TO_PHASE_MAP['disbursement'] = 's7';
TAB_TO_PHASE_MAP['summary'] = 's7';
TAB_TO_PHASE_MAP['audit'] = 'meta';
TAB_TO_PHASE_MAP['risk-rating'] = 's4';
TAB_TO_PHASE_MAP['profitability'] = 's3';
TAB_TO_PHASE_MAP['counterparties'] = 's3';
TAB_TO_PHASE_MAP['conduct'] = 's3';
TAB_TO_PHASE_MAP['forward-looking-risk'] = 's4';
TAB_TO_PHASE_MAP['header'] = 's1';

/**
 * Returns the first tab ID belonging to the first incomplete (non-optional) section,
 * or null if all sections are complete.
 */
export function getNextIncompleteTab(completion: Record<string, PhaseStatus>, applicationState?: string | null): DetailTab | null {
  for (const group of TAB_GROUPS) {
    // Skip advanced-only groups for default next-incomplete logic
    if (group.advancedOnly) continue;
    // Skip state-gated groups that don't apply to current state
    if (group.states && applicationState && !group.states.includes(applicationState as ApplicationState)) continue;
    if (completion[group.id] === 'incomplete') {
      // Use PHASE_TO_TAB_MAP for consistent navigation targets
      const mapped = PHASE_TO_TAB_MAP[group.id];
      if (mapped) return mapped as DetailTab;
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

  // Assigned RM: current user if they have CREDIT_RM role
  const isRm = currentUser?.roles?.some(r => r === 'CREDIT_RM') ?? false;
  const assignedRmId = isRm ? currentUser!.id : null;

  // Suggested reviewer: first approval user who isn't the current user
  const suggestedReviewer = (approvalUsers && currentUser)
    ? approvalUsers.find(u => u.id !== currentUser.id)?.name ?? null
    : null;

  return { currency, tenorMonths, assignedRmId, suggestedReviewer };
}