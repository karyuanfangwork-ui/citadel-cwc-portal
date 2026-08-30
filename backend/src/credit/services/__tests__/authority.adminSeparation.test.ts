/** GAP-P1-11 — platform administration must not confer credit authority. */

import {
  AUTHORITY_HIERARCHY,
  hasSufficientAuthority,
  getHighestAuthorityLevelName,
  getUserAuthorityLevel,
} from '../authority.service';

describe('AUTHORITY_HIERARCHY (GAP-P1-11)', () => {
  it('does not grant the platform ADMIN role credit authority', () => {
    expect(AUTHORITY_HIERARCHY.ADMIN).toBeUndefined();
  });

  it('retains CREDIT_ADMIN at board level', () => {
    expect(AUTHORITY_HIERARCHY.CREDIT_ADMIN).toBe(5);
  });

  it('leaves genuine credit roles untouched', () => {
    expect(AUTHORITY_HIERARCHY.CREDIT_RM).toBe(1);
    expect(AUTHORITY_HIERARCHY.CREDIT_MANAGER).toBe(2);
    expect(AUTHORITY_HIERARCHY.SENIOR_CREDIT_OFFICER).toBe(3);
    expect(AUTHORITY_HIERARCHY.CREDIT_COMMITTEE).toBe(4);
    expect(AUTHORITY_HIERARCHY.BOARD_RISK_COMMITTEE).toBe(5);
  });
});

describe('getUserAuthorityLevel (GAP-P1-11)', () => {
  it('gives an ADMIN-only user zero credit authority', () => {
    expect(getUserAuthorityLevel(['ADMIN'])).toBe(0);
  });

  it('gives an ADMIN with CREDIT_MANAGER manager-level authority', () => {
    expect(getUserAuthorityLevel(['ADMIN', 'CREDIT_MANAGER'])).toBe(2);
  });

  it('still gives CREDIT_ADMIN board-level authority', () => {
    expect(getUserAuthorityLevel(['CREDIT_ADMIN'])).toBe(5);
  });
});

describe('getHighestAuthorityLevelName (GAP-P1-11)', () => {
  it('returns a zero-authority sentinel for an ADMIN-only user', () => {
    const name = getHighestAuthorityLevelName(['ADMIN']);
    expect(AUTHORITY_HIERARCHY[name] ?? 0).toBe(0);
  });

  it('does not fall back to RM without a credit role', () => {
    expect(getHighestAuthorityLevelName(['ADMIN'])).not.toBe('RM');
    expect(getHighestAuthorityLevelName([])).not.toBe('RM');
  });

  it('returns the highest credit role when present', () => {
    expect(getHighestAuthorityLevelName(['ADMIN', 'CREDIT_MANAGER'])).toBe('CREDIT_MANAGER');
  });
});

describe('hasSufficientAuthority (GAP-P1-11)', () => {
  it('refuses ADMIN-only manager and board approval', () => {
    const name = getHighestAuthorityLevelName(['ADMIN']);
    expect(hasSufficientAuthority(name, 'MANAGER')).toBe(false);
    expect(hasSufficientAuthority(name, 'BOARD')).toBe(false);
  });

  it('still allows explicit credit authority', () => {
    expect(hasSufficientAuthority('CREDIT_ADMIN', 'BOARD')).toBe(true);
    expect(hasSufficientAuthority('CREDIT_MANAGER', 'MANAGER')).toBe(true);
  });
});
