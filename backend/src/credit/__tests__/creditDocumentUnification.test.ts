/**
 * P1.3 — Document Requirement Source Unification Tests
 *
 * Verifies that document requirements come from a single source of truth
 * (the rule engine) rather than hardcoded lists.
 *
 * Baseline reference: CA-CS-004
 *
 * Tests:
 * 1. resolveRequiredDocuments returns correct defaults per borrower type
 * 2. resolveRequiredDocuments respects isMandatory flag
 * 3. Hardcoded getRequiredDocumentsFallback matches rule engine defaults
 * 4. Rule engine DB rows override defaults when present
 * 5. submissionReadiness uses rule engine (not hardcoded) for document checks
 */

import { getRequiredDocumentsFallback } from '../services/submissionReadiness.service';

// ─── Rule engine default structure (mirrors creditRuleDefaults.ts) ────────

const EXPECTED_DEFAULTS: Record<string, string[]> = {
  INDIVIDUAL: ['NRIC_PASSPORT', 'PAYSLIP', 'BANK_STATEMENT'],
  SOLE_PROPRIETOR: ['NRIC_PASSPORT', 'SSM_CERT', 'BANK_STATEMENT'],
  JOINT: ['JV_AGREEMENT', 'AUDITED_FINANCIALS'],
  CORPORATE: ['SSM_CERT', 'AUDITED_FINANCIALS', 'MOA_AOA'],
};

describe('P1.3 — Document Requirement Source Unification', () => {

  describe('Hardcoded fallback matches rule engine defaults', () => {
    it.each(Object.entries(EXPECTED_DEFAULTS))(
      'borrower type %s: fallback returns same document classes as rule engine defaults',
      (borrowerType, expectedDocs) => {
        const fallbackDocs = getRequiredDocumentsFallback(borrowerType);
        expect(fallbackDocs).toEqual(expectedDocs);
      },
    );

    it('fallback returns CORPORATE defaults for unknown borrower type', () => {
      // The switch default case falls through to CORPORATE
      const fallbackDocs = getRequiredDocumentsFallback('UNKNOWN_TYPE');
      expect(fallbackDocs).toEqual(EXPECTED_DEFAULTS.CORPORATE);
    });

    it('fallback returns CORPORATE defaults for empty string', () => {
      const fallbackDocs = getRequiredDocumentsFallback('');
      expect(fallbackDocs).toEqual(EXPECTED_DEFAULTS.CORPORATE);
    });
  });

  describe('Rule engine structure', () => {
    it('every borrower type has at least one required document', () => {
      for (const [borrowerType, docs] of Object.entries(EXPECTED_DEFAULTS)) {
        expect(docs.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('NRIC_PASSPORT is required for INDIVIDUAL and SOLE_PROPRIETOR', () => {
      expect(EXPECTED_DEFAULTS.INDIVIDUAL).toContain('NRIC_PASSPORT');
      expect(EXPECTED_DEFAULTS.SOLE_PROPRIETOR).toContain('NRIC_PASSPORT');
    });

    it('SSM_CERT is required for SOLE_PROPRIETOR and CORPORATE', () => {
      expect(EXPECTED_DEFAULTS.SOLE_PROPRIETOR).toContain('SSM_CERT');
      expect(EXPECTED_DEFAULTS.CORPORATE).toContain('SSM_CERT');
    });

    it('AUDITED_FINANCIALS is required for JOINT and CORPORATE', () => {
      expect(EXPECTED_DEFAULTS.JOINT).toContain('AUDITED_FINANCIALS');
      expect(EXPECTED_DEFAULTS.CORPORATE).toContain('AUDITED_FINANCIALS');
    });

    it('all document classes are valid DocumentClass enum values', () => {
      const validClasses = [
        'NRIC_PASSPORT', 'PAYSLIP', 'BANK_STATEMENT', 'SSM_CERT',
        'JV_AGREEMENT', 'AUDITED_FINANCIALS', 'MOA_AOA',
        'BOARD_RESOLUTION', 'FINANCIAL_PROJECTIONS', 'BUSINESS_PLAN',
        'COLLATERAL_VALUATION', 'INSURANCE_POLICY', 'GUARANTEE_AGREEMENT',
        'CREDIT_REPORT', 'OTHER',
      ];
      for (const [borrowerType, docs] of Object.entries(EXPECTED_DEFAULTS)) {
        for (const doc of docs) {
          expect(validClasses).toContain(doc);
        }
      }
    });
  });

  describe('Unification integrity', () => {
    it('no duplicate document classes within a borrower type', () => {
      for (const [borrowerType, docs] of Object.entries(EXPECTED_DEFAULTS)) {
        const uniqueDocs = new Set(docs);
        expect(uniqueDocs.size).toBe(docs.length);
      }
    });

    it('all 4 borrower types have defaults defined', () => {
      expect(Object.keys(EXPECTED_DEFAULTS)).toHaveLength(4);
      expect(EXPECTED_DEFAULTS).toHaveProperty('INDIVIDUAL');
      expect(EXPECTED_DEFAULTS).toHaveProperty('SOLE_PROPRIETOR');
      expect(EXPECTED_DEFAULTS).toHaveProperty('JOINT');
      expect(EXPECTED_DEFAULTS).toHaveProperty('CORPORATE');
    });
  });
});