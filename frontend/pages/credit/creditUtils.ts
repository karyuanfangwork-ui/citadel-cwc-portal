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
  REFERRED_BACK: { bg: '#f59e0b20', text: '#d97706' },
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
  REFERRED_BACK: 'Referred Back',
};

// §8.1 — Icons paired with each state for accessibility (colour+icon, not colour alone)
export const STATE_ICONS: Record<string, string> = {
  DRAFT: 'edit_note',
  SUBMITTED: 'send',
  KYC_REVIEW: 'fact_check',
  KYC_APPROVED: 'how_to_reg',
  KYC_REJECTED: 'person_off',
  UNDERWRITING: 'analytics',
  CREDIT_ASSESSMENT: 'scoreboard',
  COMMITTEE_REVIEW: 'groups',
  APPROVED: 'check_circle',
  REJECTED: 'cancel',
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
  { key: 'kyc', label: 'KYC Review', states: ['SUBMITTED', 'KYC_REVIEW', 'KYC_APPROVED', 'KYC_REJECTED'] },
  { key: 'assessment', label: 'Assessment', states: ['UNDERWRITING', 'CREDIT_ASSESSMENT'] },
  { key: 'referred', label: 'Referred Back', states: ['REFERRED_BACK'] },
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
  // S5 — Bureau & Compliance
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
  | 'header';

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
    ],
  },
  {
    id: 's5',
    label: 'S5 · Bureau & Compliance',
    tabs: [
      { id: 'credit-checks', label: 'Bureau Checks' },
      { id: 'industry', label: 'Industry Outlook' },
      { id: 'risk', label: 'Risk & Mitigators' },
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

/** Return the default tab groups (S1-S7 + meta), optionally including bank-only groups.
 *  Pass borrowerType to suppress tabs irrelevant for individual/retail borrowers. */
export function getVisibleTabGroups(advancedMemo: boolean, borrowerType?: string | null, applicationState?: string | null): TabGroup[] {
  const isRetail = borrowerType === 'INDIVIDUAL' || borrowerType === 'SOLE_PROPRIETOR';
  return TAB_GROUPS
    .filter(g => !g.advancedOnly || advancedMemo)
    .filter(g => !g.states || !applicationState || g.states.includes(applicationState as ApplicationState))
    .map(g => {
      if (!isRetail) return g;
      // For retail: relabel parties tab, but keep payment-capability 
      // (Way Out is universal; Projection/Sensitivity are hidden inside the component)
      const filteredTabs = g.tabs
        .map(t => t.id === 'parties' ? { ...t, label: 'Guarantors & Parties' } : t);
      return filteredTabs.some((t, i) => t.label !== g.tabs[i]?.label)
        ? { ...g, tabs: filteredTabs }
        : g;
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
  borrowerType?: string | null;
  registrationNumber?: string | null;
  riskRating?: string | null;
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
      (app.facilities && app.facilities.length > 0)
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
      hasValue(app.riskRating)
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
  s5: 'credit-checks',
  s6: 'collateral',
  s7: 'approvals',
  meta: 'documents',
};

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