/**
 * tabRegistry.ts — Maps CA Memo sections to their step, group, component, and route.
 * Redesigned for 7-section structure (Wave A of CA Memo Redesign).
 *
 * Step 1: Loan & Borrower  (S1 + S2)
 * Step 2: Risk & Mitigants (S3 + S4 + S5)
 * Step 3: Decision         (S6 + S7)
 */

import React from 'react';
import type { DetailTab } from './creditUtils';

// ── Step Definitions ──────────────────────────────────────────────

export type WizardStep = 1 | 2 | 3;

export const WIZARD_STEPS: { step: WizardStep; label: string }[] = [
  { step: 1, label: 'Loan & Borrower' },
  { step: 2, label: 'Risk & Mitigants' },
  { step: 3, label: 'Decision' },
];

// ── Section Definitions (within steps) ────────────────────────────

export interface SectionDef {
  id: DetailTab;
  label: string;
  shortLabel: string; // for sidebar nav
  step: WizardStep;
  order: number; // overall order
  advancedOnly?: boolean;
}

export const SECTIONS: SectionDef[] = [
  // Step 1: Loan & Borrower
  { id: 'loan-request', label: 'Loan Request', shortLabel: 'Loan', step: 1, order: 1 },
  { id: 'borrower-profile', label: 'Borrower Profile & KYC', shortLabel: 'Profile', step: 1, order: 2 },
  { id: 'parties', label: 'Directors & UBOs', shortLabel: 'Parties', step: 1, order: 3 },

  // Step 2: Risk & Mitigants
  { id: 'financials', label: 'Financials', shortLabel: 'Financials', step: 2, order: 4 },
  { id: 'risk-score', label: 'Risk Score & Rating', shortLabel: 'Score', step: 2, order: 5 },
  { id: 'payment-capability', label: 'Payment Capability', shortLabel: 'Payment', step: 2, order: 6 },
  { id: 'credit-checks', label: 'Bureau Checks', shortLabel: 'Bureau', step: 2, order: 7 },
  { id: 'industry', label: 'Industry Outlook', shortLabel: 'Industry', step: 2, order: 8 },
  { id: 'risk', label: 'Risk & Mitigators', shortLabel: 'Mitigators', step: 2, order: 9 },

  // Step 3: Decision
  { id: 'collateral', label: 'Collateral', shortLabel: 'Collateral', step: 3, order: 10 },
  { id: 'security', label: 'Security & Guarantees', shortLabel: 'Security', step: 3, order: 11 },
  { id: 'approvals', label: 'Approvals', shortLabel: 'Approvals', step: 3, order: 12 },
  { id: 'signoff', label: 'Sign-off', shortLabel: 'Signoff', step: 3, order: 13 },
  { id: 'conditions', label: 'Conditions Precedent', shortLabel: 'Conditions', step: 3, order: 14 },
  { id: 'disbursement', label: 'Disbursement', shortLabel: 'Disbursement', step: 3, order: 15, advancedOnly: false },
  { id: 'summary', label: 'Summary', shortLabel: 'Summary', step: 3, order: 16 },

  // Meta (cross-cutting)
  { id: 'documents', label: 'Documents', shortLabel: 'Docs', step: 3, order: 17 },
  { id: 'audit', label: 'Audit Trail', shortLabel: 'Audit', step: 3, order: 18 },

  // ── Bank-only sections (advanced_memo flag) ──
  { id: 'risk-rating', label: 'Risk Rating & ECL', shortLabel: 'ECL', step: 2, order: 100, advancedOnly: true },
  { id: 'profitability', label: 'Profitability', shortLabel: 'P&L', step: 2, order: 101, advancedOnly: true },
  { id: 'counterparties', label: 'Counterparties', shortLabel: 'Counter', step: 2, order: 102, advancedOnly: true },
  { id: 'conduct', label: 'Account Conduct', shortLabel: 'Conduct', step: 2, order: 103, advancedOnly: true },
  { id: 'forward-looking-risk', label: 'ESG / SICR / FL Risk', shortLabel: 'FL Risk', step: 2, order: 104, advancedOnly: true },
  { id: 'header', label: 'Header & Background', shortLabel: 'Header', step: 1, order: 105, advancedOnly: true },
  { id: 'facilities', label: 'Facilities (Legacy)', shortLabel: 'Facilities', step: 1, order: 106, advancedOnly: true },
];

// ── Group Definitions (groups within a step for the sidebar) ──────

export interface GroupDef {
  id: string;
  label: string;
  step: WizardStep;
  sections: DetailTab[];
  advancedOnly?: boolean;
}

export const WIZARD_GROUPS: GroupDef[] = [
  // Step 1: Loan & Borrower
  { id: 'g-loan', label: 'Loan Request', step: 1, sections: ['loan-request'] },
  { id: 'g-borrower', label: 'Borrower', step: 1, sections: ['borrower-profile', 'parties'] },

  // Step 2: Risk & Mitigants
  { id: 'g-financials', label: 'Financials', step: 2, sections: ['financials'] },
  { id: 'g-score', label: 'Risk Score', step: 2, sections: ['risk-score', 'payment-capability'] },
  { id: 'g-bureau', label: 'Bureau & Compliance', step: 2, sections: ['credit-checks', 'industry', 'risk'] },

  // Step 3: Decision
  { id: 'g-collateral', label: 'Collateral & Guarantees', step: 3, sections: ['collateral', 'security'] },
  { id: 'g-approvals', label: 'Approvals & Signoff', step: 3, sections: ['approvals', 'signoff'] },
  { id: 'g-conditions', label: 'Conditions & Disbursement', step: 3, sections: ['conditions', 'disbursement', 'summary'] },
  { id: 'g-meta', label: 'Operations', step: 3, sections: ['documents', 'audit'] },

  // ── Bank-only groups (hidden unless credit:advanced_memo) ──
  { id: 'g-adv-risk-rating', label: 'Risk Rating & ECL', step: 2, sections: ['risk-rating'], advancedOnly: true },
  { id: 'g-adv-financials', label: 'Bank Financial Analysis', step: 2, sections: ['profitability', 'counterparties', 'conduct'], advancedOnly: true },
  { id: 'g-adv-flr', label: 'Forward-Looking Risk', step: 2, sections: ['forward-looking-risk'], advancedOnly: true },
  { id: 'g-adv-legacy', label: 'Legacy Sections', step: 1, sections: ['header', 'facilities'], advancedOnly: true },
];

// ── Helpers ───────────────────────────────────────────────────────

export function getSectionsForStep(step: WizardStep): SectionDef[] {
  return SECTIONS.filter(s => s.step === step && !s.advancedOnly);
}

export function getGroupsForStep(step: WizardStep): GroupDef[] {
  return WIZARD_GROUPS.filter(g => g.step === step && !g.advancedOnly);
}

export function getAllSectionsForStep(step: WizardStep, advancedMemo: boolean): SectionDef[] {
  return SECTIONS.filter(s => s.step === step && (!s.advancedOnly || advancedMemo));
}

export function getAllGroupsForStep(step: WizardStep, advancedMemo: boolean): GroupDef[] {
  return WIZARD_GROUPS.filter(g => g.step === step && (!g.advancedOnly || advancedMemo));
}

export function getSectionDef(tabId: DetailTab): SectionDef | undefined {
  return SECTIONS.find(s => s.id === tabId);
}

export function getStepForTab(tabId: DetailTab): WizardStep {
  const section = SECTIONS.find(s => s.id === tabId);
  return section?.step ?? 1;
}

/**
 * Map tab URL params to wizard section.
 * Supports both new section IDs and legacy tab IDs.
 */
export const LEGACY_TAB_MAP: Record<string, { step: WizardStep; section: DetailTab }> = {
  // New 7-section IDs
  'loan-request': { step: 1, section: 'loan-request' },
  'borrower-profile': { step: 1, section: 'borrower-profile' },
  'parties': { step: 1, section: 'parties' },
  'financials': { step: 2, section: 'financials' },
  'risk-score': { step: 2, section: 'risk-score' },
  'payment-capability': { step: 2, section: 'payment-capability' },
  'credit-checks': { step: 2, section: 'credit-checks' },
  'industry': { step: 2, section: 'industry' },
  'risk': { step: 2, section: 'risk' },
  'collateral': { step: 3, section: 'collateral' },
  'security': { step: 3, section: 'security' },
  'approvals': { step: 3, section: 'approvals' },
  'signoff': { step: 3, section: 'signoff' },
  'conditions': { step: 3, section: 'conditions' },
  'disbursement': { step: 3, section: 'disbursement' },
  'summary': { step: 3, section: 'summary' },
  'documents': { step: 3, section: 'documents' },
  'audit': { step: 3, section: 'audit' },
  // Legacy — redirect to nearest new section
  'header': { step: 1, section: 'loan-request' },
  'facilities': { step: 1, section: 'loan-request' },
  'risk-rating': { step: 2, section: 'risk-score' },
  'profitability': { step: 2, section: 'financials' },
  'counterparties': { step: 2, section: 'financials' },
  'conduct': { step: 2, section: 'financials' },
  'forward-looking-risk': { step: 2, section: 'risk-score' },
};