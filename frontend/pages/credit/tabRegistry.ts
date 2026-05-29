/**
 * tabRegistry.ts — Maps the 13 sections to their step, group, component, and route.
 * Used by CreditApplicationWizard to render the active section.
 *
 * Architecture (§3.6):
 *
 * Step 1: Borrower & Request
 *   ├── (1) Header & Background
 *   ├── (2) Borrower Profile (summary in header page for now — no separate tab)
 *   ├── (3) Parties
 *   └── (4) Documents
 *
 * Step 2: Risk & Mitigants
 *   ├── (5) Facilities & Requests
 *   ├── (6) Collateral & Insurance
 *   ├── (7) Financial Analysis (Profitability + Counterparties + Account Conduct)
 *   ├── (8) Scoring & Rating (Credit Checks + Industry + Risk Rating + Forward-Looking Risk)
 *   └── (9) Security & Guarantees
 *
 * Step 3: Decision & Monitoring
 *   ├── (10) Approvals & Signoff
 *   ├── (11) Conditions Precedent
 *   ├── (12) Summary
 *   └── (13) Audit Trail
 */

import React from 'react';
import type { DetailTab } from './creditUtils';

// ── Step Definitions ──────────────────────────────────────────────

export type WizardStep = 1 | 2 | 3;

export const WIZARD_STEPS: { step: WizardStep; label: string }[] = [
  { step: 1, label: 'Borrower & Request' },
  { step: 2, label: 'Risk & Mitigants' },
  { step: 3, label: 'Decision & Monitoring' },
];

// ── Section Definitions (within steps) ────────────────────────────

export interface SectionDef {
  id: DetailTab;
  label: string;
  shortLabel: string; // for sidebar nav
  step: WizardStep;
  order: number; // overall order (1-13)
}

export const SECTIONS: SectionDef[] = [
  // Step 1: Borrower & Request
  { id: 'header', label: 'Header & Background', shortLabel: 'Header', step: 1, order: 1 },
  { id: 'parties', label: 'Parties (Directors, Shareholders, UBOs)', shortLabel: 'Parties', step: 1, order: 2 },
  { id: 'documents', label: 'Documents', shortLabel: 'Documents', step: 1, order: 3 },

  // Step 2: Risk & Mitigants
  { id: 'facilities', label: 'Facilities & Requests', shortLabel: 'Facilities', step: 2, order: 4 },
  { id: 'security', label: 'Security & Guarantees', shortLabel: 'Security', step: 2, order: 5 },
  { id: 'collateral', label: 'Collateral & Insurance', shortLabel: 'Collateral', step: 2, order: 6 },
  { id: 'profitability', label: 'Financial Analysis', shortLabel: 'Financials', step: 2, order: 7 },
  { id: 'counterparties', label: 'Counterparties', shortLabel: 'Counterparties', step: 2, order: 8 },
  { id: 'conduct', label: 'Account Conduct', shortLabel: 'Conduct', step: 2, order: 9 },
  { id: 'credit-checks', label: 'Scoring & Rating', shortLabel: 'Scoring', step: 2, order: 10 },
  { id: 'industry', label: 'Industry Outlook', shortLabel: 'Industry', step: 2, order: 11 },
  { id: 'risk-rating', label: 'Risk Rating & ECL', shortLabel: 'Risk/ECL', step: 2, order: 12 },
  { id: 'payment-capability', label: 'Payment Capability', shortLabel: 'Payment', step: 2, order: 13 },
  { id: 'forward-looking-risk', label: 'Forward-Looking Risk', shortLabel: 'FL Risk', step: 2, order: 14 },
  { id: 'risk', label: 'Risk & Mitigators', shortLabel: 'Mitigators', step: 2, order: 15 },

  // Step 3: Decision & Monitoring
  { id: 'approvals', label: 'Approvals & Signoff', shortLabel: 'Approvals', step: 3, order: 16 },
  { id: 'signoff', label: 'Sign-off', shortLabel: 'Signoff', step: 3, order: 17 },
  { id: 'conditions', label: 'Conditions Precedent', shortLabel: 'Conditions', step: 3, order: 18 },
  { id: 'summary', label: 'Summary', shortLabel: 'Summary', step: 3, order: 19 },
  { id: 'audit', label: 'Audit Trail', shortLabel: 'Audit', step: 3, order: 20 },
];

// ── Group Definitions (groups within a step for the sidebar) ──────

export interface GroupDef {
  id: string;
  label: string;
  step: WizardStep;
  sections: DetailTab[];
}

export const WIZARD_GROUPS: GroupDef[] = [
  // Step 1
  { id: 'g-borrower', label: 'Borrower Info', step: 1, sections: ['header', 'parties', 'documents'] },

  // Step 2
  { id: 'g-facilities', label: 'Facilities', step: 2, sections: ['facilities'] },
  { id: 'g-security', label: 'Security & Collateral', step: 2, sections: ['security', 'collateral'] },
  { id: 'g-financials', label: 'Financial Analysis', step: 2, sections: ['profitability', 'counterparties', 'conduct'] },
  { id: 'g-scoring', label: 'Scoring & Rating', step: 2, sections: ['credit-checks', 'industry', 'risk-rating', 'payment-capability', 'forward-looking-risk', 'risk'] },

  // Step 3
  { id: 'g-approvals', label: 'Approvals & Signoff', step: 3, sections: ['approvals', 'signoff'] },
  { id: 'g-conditions', label: 'Conditions & Summary', step: 3, sections: ['conditions', 'summary'] },
  { id: 'g-audit', label: 'Audit Trail', step: 3, sections: ['audit'] },
];

// ── Helpers ───────────────────────────────────────────────────────

export function getSectionsForStep(step: WizardStep): SectionDef[] {
  return SECTIONS.filter(s => s.step === step);
}

export function getGroupsForStep(step: WizardStep): GroupDef[] {
  return WIZARD_GROUPS.filter(g => g.step === step);
}

export function getSectionDef(tabId: DetailTab): SectionDef | undefined {
  return SECTIONS.find(s => s.id === tabId);
}

export function getStepForTab(tabId: DetailTab): WizardStep {
  const section = SECTIONS.find(s => s.id === tabId);
  return section?.step ?? 1;
}

/**
 * Map legacy tab URL params to wizard section.
 * e.g. ?tab=header → step=1, section=header
 */
export const LEGACY_TAB_MAP: Record<string, { step: WizardStep; section: DetailTab }> = {
  header: { step: 1, section: 'header' },
  parties: { step: 1, section: 'parties' },
  documents: { step: 1, section: 'documents' },
  facilities: { step: 2, section: 'facilities' },
  security: { step: 2, section: 'security' },
  collateral: { step: 2, section: 'collateral' },
  profitability: { step: 2, section: 'profitability' },
  counterparties: { step: 2, section: 'counterparties' },
  conduct: { step: 2, section: 'conduct' },
  'credit-checks': { step: 2, section: 'credit-checks' },
  industry: { step: 2, section: 'industry' },
  'risk-rating': { step: 2, section: 'risk-rating' },
  'payment-capability': { step: 2, section: 'payment-capability' },
  'forward-looking-risk': { step: 2, section: 'forward-looking-risk' },
  risk: { step: 2, section: 'risk' },
  approvals: { step: 3, section: 'approvals' },
  signoff: { step: 3, section: 'signoff' },
  conditions: { step: 3, section: 'conditions' },
  summary: { step: 3, section: 'summary' },
  audit: { step: 3, section: 'audit' },
};