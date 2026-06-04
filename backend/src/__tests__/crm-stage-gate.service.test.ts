import { validateStageTransition } from '../services/crm-stage-gate.service';

const stage = (o: Partial<any> = {}) => ({
  displayOrder: 2, requiredFields: [], enforceForwardOnly: false,
  requiresApproval: false, approvalThreshold: null, isWonStage: false, ...o,
});
const opp = (o: Partial<any> = {}) => ({ value: 1000, expectedCloseDate: new Date(), description: 'x', ...o });

describe('validateStageTransition', () => {
  it('passes a clean forward move', () => {
    expect(validateStageTransition(opp(), stage({ displayOrder: 1 }), stage({ displayOrder: 2 })))
      .toEqual({ ok: true });
  });

  it('blocks backward move when forward-only enforced on target stage', () => {
    const r = validateStageTransition(opp(), stage({ displayOrder: 3 }), stage({ displayOrder: 2, enforceForwardOnly: true }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/forward/i);
  });

  it('allows backward move when forward-only NOT enforced', () => {
    const r = validateStageTransition(opp(), stage({ displayOrder: 3 }), stage({ displayOrder: 2, enforceForwardOnly: false }));
    expect(r.ok).toBe(true);
  });

  it('blocks when a required field is empty (null)', () => {
    const r = validateStageTransition(opp({ expectedCloseDate: null }), stage({ displayOrder: 1 }), stage({ displayOrder: 2, requiredFields: ['expectedCloseDate'] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/expectedCloseDate/);
  });

  it('blocks when a required field is empty string', () => {
    const r = validateStageTransition(opp({ description: '' }), stage({ displayOrder: 1 }), stage({ displayOrder: 2, requiredFields: ['description'] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/description/);
  });

  it('passes when all required fields are populated', () => {
    const r = validateStageTransition(opp(), stage({ displayOrder: 1 }), stage({ displayOrder: 2, requiredFields: ['expectedCloseDate', 'description'] }));
    expect(r.ok).toBe(true);
  });

  it('requires approval above threshold into target stage', () => {
    const r = validateStageTransition(opp({ value: 500000 }), stage({ displayOrder: 1 }), stage({ displayOrder: 2, requiresApproval: true, approvalThreshold: 100000 }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.needsApproval).toBe(true);
      expect(r.reason).toMatch(/approval/i);
    }
  });

  it('does not require approval below threshold', () => {
    const r = validateStageTransition(opp({ value: 50000 }), stage({ displayOrder: 1 }), stage({ displayOrder: 2, requiresApproval: true, approvalThreshold: 100000 }));
    expect(r.ok).toBe(true);
  });

  it('does not require approval when requiresApproval is false', () => {
    const r = validateStageTransition(opp({ value: 500000 }), stage({ displayOrder: 1 }), stage({ displayOrder: 2, requiresApproval: false, approvalThreshold: 100000 }));
    expect(r.ok).toBe(true);
  });

  it('passes same-stage move (no transition)', () => {
    const r = validateStageTransition(opp(), stage({ displayOrder: 2 }), stage({ displayOrder: 2 }));
    expect(r.ok).toBe(true);
  });

  it('checks multiple required fields and reports the first missing', () => {
    const r = validateStageTransition(
      opp({ expectedCloseDate: null, description: '' }),
      stage({ displayOrder: 1 }),
      stage({ displayOrder: 2, requiredFields: ['expectedCloseDate', 'description'] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/expectedCloseDate/);
  });
});