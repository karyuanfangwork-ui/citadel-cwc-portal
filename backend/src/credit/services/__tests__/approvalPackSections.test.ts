// LOS-016 — approval pack decision basis sections
import { APPROVAL_PACK_SECTIONS, buildApprovalPackHtml } from '../approvalPack.service';

const NEW_SECTIONS = ['analyst-recommendation', 'score-explanation', 'overrides-deviations', 'evidence-index'];

function minimalApp(overrides: Record<string, any> = {}): any {
  return {
    applicationNo: 'CA-TEST-0001',
    borrowerProfile: { account: { name: 'Probe Sdn Bhd' } },
    signoffs: [],
    facilities: [],
    bureauChecks: [],
    riskAssessments: [],
    conditions: [],
    decisions: [],
    scoreRuns: [],
    recommendations: [],
    assessmentResults: [],
    scoreOverrides: [],
    deviations: [],
    documents: [],
    ...overrides,
  };
}

describe('LOS-016 — approval pack decision basis', () => {
  it('declares an anchor for every new section', () => {
    const ids = APPROVAL_PACK_SECTIONS.map((s) => s.id);
    for (const id of NEW_SECTIONS) expect(ids).toContain(id);
  });

  it('renders an anchor for every declared section', () => {
    const html = buildApprovalPackHtml(minimalApp());
    for (const section of APPROVAL_PACK_SECTIONS) {
      expect(html).toContain(`id="${section.id}"`);
    }
  });

  it('renders the authored recommendation with its author and rationale', () => {
    const html = buildApprovalPackHtml(minimalApp({
      recommendations: [{
        recommendationType: 'CONDITIONAL',
        recommendedAmount: 750000,
        recommendedTenorMonths: 60,
        rationale: 'Serviceable on stressed DSR; security cover adequate.',
        submittedAt: new Date('2026-08-01'),
        author: { firstName: 'Aisha', lastName: 'Rahman' },
      }],
    }));
    expect(html).toContain('CONDITIONAL');
    expect(html).toContain('Aisha');
    expect(html).toContain('Serviceable on stressed DSR');
  });

  it('explains the score: factors, missing inputs and caps', () => {
    const html = buildApprovalPackHtml(minimalApp({
      scoreRuns: [{
        totalScore: 72.5,
        riskRating: 'BBB',
        baseRiskRating: 'A',
        factorScores: { dsr: 18, leverage: 12, conduct: 20 },
        missingInputs: [{ factor: 'bureau_score', policy: 'PENALTY' }],
        bureauCapsApplied: [{ reason: 'adverse_record', cappedTo: 'BBB' }],
        policyVersion: 'md-2026.1',
        ratingBandVersion: 4,
      }],
    }));
    expect(html).toContain('dsr');
    expect(html).toContain('bureau_score');
    expect(html).toContain('md-2026.1');
    // A capped rating must show what it was capped from.
    expect(html).toContain('A');
  });

  it('states the frozen version the pack reports', () => {
    const html = buildApprovalPackHtml(minimalApp({
      scoreRuns: [{ totalScore: 72.5, riskRating: 'BBB', baseRiskRating: 'BBB', factorScores: {}, missingInputs: [], bureauCapsApplied: [], policyVersion: 'md-2026.1', ratingBandVersion: 4 }],
      assessmentResults: [{ version: 3, status: 'FROZEN', finalRiskRating: 'BBB', policyVersion: 'md-2026.1', ratingBandVersion: 4 }],
    }));
    expect(html).toMatch(/frozen assessment.*v3|v3.*frozen/i);
  });

  it('lists evidence with verification status and hash', () => {
    const html = buildApprovalPackHtml(minimalApp({
      documents: [{
        id: 'd1', classification: 'FINANCIAL_STATEMENT', fileName: 'FY2025-audited.pdf',
        sha256Hash: 'abc123def456', verificationStatus: 'VERIFIED', verifiedAt: new Date('2026-07-01'),
      }],
    }));
    expect(html).toContain('FY2025-audited.pdf');
    expect(html).toContain('VERIFIED');
    expect(html).toContain('abc123def456'.slice(0, 12));
  });

  it('renders without throwing when every new section is empty', () => {
    expect(() => buildApprovalPackHtml(minimalApp())).not.toThrow();
  });
});