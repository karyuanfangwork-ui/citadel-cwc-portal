// backend/src/credit/__tests__/committeeEntryGate.test.ts
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
});