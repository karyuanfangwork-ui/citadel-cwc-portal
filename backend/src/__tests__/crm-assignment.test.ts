import { assignLeadOwner, type AssignmentRule, type TerritoryMember } from '../services/crm-assignment.service';

// ── Test data ──────────────────────────────────────────────────────

const members: TerritoryMember[] = [
  { userId: 'u1', role: 'MEMBER' },
  { userId: 'u2', role: 'MEMBER' },
  { userId: 'u3', role: 'MANAGER' },
];

const rules: AssignmentRule[] = [
  { id: 'r1', name: 'Website leads', territoryId: 't1', sourceMatch: 'source=WEBSITE', roundRobin: true, isActive: true, priority: 10 },
  { id: 'r2', name: 'Referral leads', territoryId: 't1', sourceMatch: 'source=REFERRAL', roundRobin: false, isActive: true, priority: 5 },
  { id: 'r3', name: 'Default', territoryId: 't1', sourceMatch: null, roundRobin: false, isActive: true, priority: 0 },
  { id: 'r4', name: 'Inactive rule', territoryId: 't2', sourceMatch: 'source=ADS', roundRobin: false, isActive: false, priority: 20 },
];

// ── Tests ─────────────────────────────────────────────────────────

describe('assignLeadOwner', () => {
  it('matches lead source via sourceMatch', () => {
    const result = assignLeadOwner(
      { source: 'WEBSITE' },
      rules,
      { t1: members },
      { t1: 0 },
    );
    // roundRobin: picks members[0] at index 0
    expect(result.ownerId).toBe('u1');
    expect(result.ruleId).toBe('r1');
  });

  it('round-robins across territory members', () => {
    const counter = { t1: 1 }; // start at second member
    const result = assignLeadOwner(
      { source: 'WEBSITE' },
      rules,
      { t1: members },
      counter,
    );
    expect(result.ownerId).toBe('u2');
    expect(result.nextIndex).toBe(2);
  });

  it('wraps round-robin index back to 0', () => {
    const counter = { t1: 3 }; // past end of members array
    const result = assignLeadOwner(
      { source: 'WEBSITE' },
      rules,
      { t1: members },
      counter,
    );
    expect(result.ownerId).toBe('u1');
    expect(result.nextIndex).toBe(1);
  });

  it('picks first member (manager) when roundRobin is false', () => {
    // source=REFERRAL matches r2 which has roundRobin=false
    const result = assignLeadOwner(
      { source: 'REFERRAL' },
      rules,
      { t1: members },
      { t1: 0 },
    );
    // non-roundRobin picks MANAGER if present, else first member
    expect(result.ownerId).toBe('u3');
    expect(result.ruleId).toBe('r2');
  });

  it('falls through to default rule when no sourceMatch', () => {
    const result = assignLeadOwner(
      { source: 'COLD_CALL' },
      rules,
      { t1: members },
      { t1: 0 },
    );
    // No match for source=COLD_CALL → falls to r3 (sourceMatch=null default)
    expect(result.ownerId).toBe('u3'); // manager, roundRobin=false
    expect(result.ruleId).toBe('r3');
  });

  it('skips inactive rules', () => {
    const result = assignLeadOwner(
      { source: 'ADS' },
      rules,
      { t1: members, t2: members },
      { t1: 0, t2: 0 },
    );
    // r4 (ADS) is inactive → falls to r3 (default)
    expect(result.ruleId).toBe('r3');
  });

  it('returns null when no rules match and no default', () => {
    const noDefaultRules: AssignmentRule[] = [
      { id: 'r1', name: 'Only website', territoryId: 't1', sourceMatch: 'source=WEBSITE', roundRobin: false, isActive: true, priority: 10 },
    ];
    const result = assignLeadOwner(
      { source: 'COLD_CALL' },
      noDefaultRules,
      { t1: members },
      { t1: 0 },
    );
    expect(result.ownerId).toBeNull();
    expect(result.ruleId).toBeNull();
  });

  it('handles missing territory members gracefully', () => {
    const result = assignLeadOwner(
      { source: 'WEBSITE' },
      rules,
      {}, // no members for t1
      { t1: 0 },
    );
    expect(result.ownerId).toBeNull();
  });
});