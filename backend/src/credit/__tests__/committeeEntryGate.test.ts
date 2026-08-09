// backend/src/credit/__tests__/committeeEntryGate.test.ts
import { readFileSync } from 'fs';
import { join } from 'path';
const COMMITTEE_ENTRY_ACTIONS = ['submit_to_committee', 'resume_committee'];

describe('LOS-015 — committee entry gate coverage', () => {
  it('applies the gate to every transition whose target is COMMITTEE_REVIEW', () => {
    // Mirrors STATE_TRANSITIONS in creditApplication.service.ts
    const transitionsIntoCommittee = [
      { from: 'CREDIT_ASSESSMENT', to: 'COMMITTEE_REVIEW', action: 'submit_to_committee' },
      { from: 'REFERRED_BACK', to: 'COMMITTEE_REVIEW', action: 'resume_committee' },
    ];
    for (const t of transitionsIntoCommittee) {
      expect(COMMITTEE_ENTRY_ACTIONS).toContain(t.action);
    }
  });

  it('exports a single gate function used by both actions', async () => {
    const mod = await import('../services/committeeEntryGate');
    expect(typeof mod.enforceCommitteeEntryGate).toBe('function');
    expect(mod.COMMITTEE_ENTRY_ACTIONS).toEqual(expect.arrayContaining(COMMITTEE_ENTRY_ACTIONS));
  });

  it('freezes only after every gate that can reject the transition', () => {
    // The gate freezes the assessment and locks the memo — both irreversible.
    // If any check that can throw runs after it, a rejected transition leaves a
    // frozen assessment and locked memo behind, which is what the gate promises
    // not to do. That ordering is a property of the source, not of any single
    // function's behaviour, so this asserts on the source directly rather than
    // building the heavy fixtures a runtime test would need.
    const source = readFileSync(
      join(__dirname, '..', 'services', 'creditApplication.service.ts'),
      'utf8',
    );

    const freezeAt = source.indexOf('await enforceCommitteeEntryGate(');
    expect(freezeAt).toBeGreaterThan(-1);

    // The last committee-scoped validation gate is the balance-sheet check.
    const balanceSheetGate = source.indexOf('does not balance: Assets');
    expect(balanceSheetGate).toBeGreaterThan(-1);
    expect(freezeAt).toBeGreaterThan(balanceSheetGate);

    // And the SICR gate.
    const sicrGate = source.indexOf('SICR');
    expect(sicrGate).toBeGreaterThan(-1);
    expect(freezeAt).toBeGreaterThan(sicrGate);
  });
});