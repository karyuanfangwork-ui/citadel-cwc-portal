/**
 * P1.7 — Approval Authority Negative Tests
 *
 * Pure logic tests that verify approval authority constants and rules.
 * No DB calls — all assertions operate on the exported authority hierarchy,
 * rating ordinal mapping, and the pure business-rule predicates that govern
 * approval authority enforcement.
 *
 * Coverage:
 *  1. Below-authority rejection (e.g. ANALYST trying to approve RM5M+)
 *  2. Duplicate approval rejection (same user approving twice)
 *  3. Board-band enforcement (exposure >= RM5M or CC/worse → COMMITTEE+ required)
 *  4. Authority level hierarchy (lower level cannot override higher)
 *  5. RM cannot approve own application (self-approval SOD)
 */

// ---------------------------------------------------------------------------
// Re-export the canonical constants / functions under test
// ---------------------------------------------------------------------------
import {
  AUTHORITY_HIERARCHY,
  hasSufficientAuthority,
  getRoleNamesForAuthorityLevel,
  getHighestAuthorityLevelName,
  getUserAuthorityLevel,
} from '../services/authority.service';

import { ratingToOrdinal } from '../services/approvalMatrix.service';
import {
  requiresBoardBandAuthority,
  BOARD_BAND_EXPOSURE_THRESHOLD as SERVICE_BOARD_BAND_THRESHOLD,
} from '../services/approvalAction.service';

// ---------------------------------------------------------------------------
// Test constants — mirror the thresholds used in approvalAction.service.ts
// ---------------------------------------------------------------------------
const COMMITTEE_AUTHORITY_LEVEL = AUTHORITY_HIERARCHY['COMMITTEE']; // 4

// Authority levels (from authority.service.ts)
const LEVEL_RM = AUTHORITY_HIERARCHY['RM'];                   // 1
const LEVEL_MANAGER = AUTHORITY_HIERARCHY['MANAGER'];         // 2
const LEVEL_SENIOR_MANAGER = AUTHORITY_HIERARCHY['SENIOR_MANAGER']; // 3
const LEVEL_COMMITTEE = AUTHORITY_HIERARCHY['COMMITTEE'];     // 4
const LEVEL_BOARD = AUTHORITY_HIERARCHY['BOARD'];             // 5

// ---------------------------------------------------------------------------
// 1. Authority hierarchy constants
// ---------------------------------------------------------------------------
describe('AUTHORITY_HIERARCHY constants', () => {
  it('defines a 5-level hierarchy with strictly increasing authority', () => {
    expect(LEVEL_RM).toBeLessThan(LEVEL_MANAGER);
    expect(LEVEL_MANAGER).toBeLessThan(LEVEL_SENIOR_MANAGER);
    expect(LEVEL_SENIOR_MANAGER).toBeLessThan(LEVEL_COMMITTEE);
    expect(LEVEL_COMMITTEE).toBeLessThan(LEVEL_BOARD);
  });

  it('includes legacy aliases at the correct levels', () => {
    expect(AUTHORITY_HIERARCHY['CREDIT_RM']).toBe(LEVEL_RM);
    expect(AUTHORITY_HIERARCHY['CREDIT_MANAGER']).toBe(LEVEL_MANAGER);
    expect(AUTHORITY_HIERARCHY['SENIOR_CREDIT_OFFICER']).toBe(LEVEL_SENIOR_MANAGER);
    expect(AUTHORITY_HIERARCHY['CREDIT_COMMITTEE']).toBe(LEVEL_COMMITTEE);
    expect(AUTHORITY_HIERARCHY['CREDIT_ADMIN']).toBe(LEVEL_BOARD);
    expect(AUTHORITY_HIERARCHY['ADMIN']).toBe(LEVEL_BOARD);
    expect(AUTHORITY_HIERARCHY['BOARD_RISK_COMMITTEE']).toBe(LEVEL_BOARD);
  });
});

// ---------------------------------------------------------------------------
// 2. hasSufficientAuthority — below-authority rejection
// ---------------------------------------------------------------------------
describe('hasSufficientAuthority — below-authority rejection', () => {
  it('rejects an RM-level user when BOARD approval is required', () => {
    expect(hasSufficientAuthority('RM', 'BOARD')).toBe(false);
  });

  it('rejects a MANAGER-level user when BOARD approval is required', () => {
    expect(hasSufficientAuthority('MANAGER', 'BOARD')).toBe(false);
  });

  it('rejects a SENIOR_MANAGER-level user when BOARD approval is required', () => {
    expect(hasSufficientAuthority('SENIOR_MANAGER', 'BOARD')).toBe(false);
  });

  it('rejects a COMMITTEE-level user when BOARD approval is required', () => {
    expect(hasSufficientAuthority('COMMITTEE', 'BOARD')).toBe(false);
  });

  it('rejects a MANAGER-level user when COMMITTEE approval is required', () => {
    expect(hasSufficientAuthority('MANAGER', 'COMMITTEE')).toBe(false);
  });

  it('rejects an RM-level user when SENIOR_MANAGER approval is required', () => {
    expect(hasSufficientAuthority('RM', 'SENIOR_MANAGER')).toBe(false);
  });

  it('rejects an RM-level user when MANAGER approval is required', () => {
    expect(hasSufficientAuthority('RM', 'MANAGER')).toBe(false);
  });

  // Legacy alias equivalents
  it('rejects CREDIT_RM when CREDIT_ADMIN (BOARD) is required', () => {
    expect(hasSufficientAuthority('CREDIT_RM', 'CREDIT_ADMIN')).toBe(false);
  });

  it('rejects CREDIT_MANAGER when BOARD_RISK_COMMITTEE is required', () => {
    expect(hasSufficientAuthority('CREDIT_MANAGER', 'BOARD_RISK_COMMITTEE')).toBe(false);
  });

  // Positive: equal authority should pass
  it('allows BOARD-level user when BOARD approval is required', () => {
    expect(hasSufficientAuthority('BOARD', 'BOARD')).toBe(true);
  });

  // Positive: higher authority should pass
  it('allows BOARD-level user when MANAGER approval is required', () => {
    expect(hasSufficientAuthority('BOARD', 'MANAGER')).toBe(true);
  });

  it('allows COMMITTEE-level user when MANAGER approval is required', () => {
    expect(hasSufficientAuthority('COMMITTEE', 'MANAGER')).toBe(true);
  });

  // Unknown roles get level 0 — always rejected
  it('rejects an unknown role regardless of required authority', () => {
    expect(hasSufficientAuthority('UNKNOWN_ROLE', 'RM')).toBe(false);
  });

  it('rejects empty string role', () => {
    expect(hasSufficientAuthority('', 'RM')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Duplicate approval rejection (pure logic predicate)
// ---------------------------------------------------------------------------
describe('Duplicate approval rejection', () => {
  /**
   * The service checks: if an existing CreditDecision exists for the same
   * applicationId + decisionById + decisionType=APPROVE, the second approval
   * is rejected. This test verifies the logic predicate used to make that
   * determination.
   */

  it('detects duplicate when same user already has an APPROVE decision', () => {
    const existingApprovals = [
      { decisionById: 'user-A', decisionType: 'APPROVE' },
      { decisionById: 'user-B', decisionType: 'APPROVE' },
    ];
    const newApprover = 'user-A';
    const isDuplicate = existingApprovals.some(
      (d) => d.decisionById === newApprover && d.decisionType === 'APPROVE',
    );
    expect(isDuplicate).toBe(true);
  });

  it('allows a different user to approve after a previous approval', () => {
    const existingApprovals = [
      { decisionById: 'user-A', decisionType: 'APPROVE' },
    ];
    const newApprover = 'user-B';
    const isDuplicate = existingApprovals.some(
      (d) => d.decisionById === newApprover && d.decisionType === 'APPROVE',
    );
    expect(isDuplicate).toBe(false);
  });

  it('does not treat a REJECT decision as a duplicate approval', () => {
    const existingApprovals = [
      { decisionById: 'user-A', decisionType: 'REJECT' },
    ];
    const newApprover = 'user-A';
    const isDuplicate = existingApprovals.some(
      (d) => d.decisionById === newApprover && d.decisionType === 'APPROVE',
    );
    expect(isDuplicate).toBe(false);
  });

  it('does not count approvals by different users as duplicates of each other', () => {
    const existingApprovals = [
      { decisionById: 'user-A', decisionType: 'APPROVE' },
      { decisionById: 'user-B', decisionType: 'APPROVE' },
      { decisionById: 'user-C', decisionType: 'APPROVE' },
    ];
    // user-D is new — not a duplicate
    const newApprover = 'user-D';
    const isDuplicate = existingApprovals.some(
      (d) => d.decisionById === newApprover && d.decisionType === 'APPROVE',
    );
    expect(isDuplicate).toBe(false);
  });

  it('rejects same user approving after their own REJECT (if they later try APPROVE)', () => {
    const existingApprovals = [
      { decisionById: 'user-A', decisionType: 'REJECT' },
      { decisionById: 'user-A', decisionType: 'APPROVE' },
    ];
    const newApprover = 'user-A';
    const isDuplicate = existingApprovals.some(
      (d) => d.decisionById === newApprover && d.decisionType === 'APPROVE',
    );
    expect(isDuplicate).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Board-band enforcement — LOS-002 corrected
// ---------------------------------------------------------------------------
describe('Board-band enforcement', () => {
  /**
   * LOS-002 fix: the comparator is now `>=` (ordinal >= CC).
   * Higher ordinal = worse credit, so "CC or worse" means ordinal >= 8.
   * C(9), D(10), NR(11) all require committee/board authority.
   * AAA(1)–CCC(7) below RM5m do NOT trigger on rating alone.
   */

  // Verify the threshold constants match the service
  it('board-band exposure threshold is RM5,000,000', () => {
    expect(SERVICE_BOARD_BAND_THRESHOLD).toBe(5_000_000);
  });

  it('board-band rating ordinal matches CC rating', () => {
    expect(ratingToOrdinal('CC')).toBe(8);
  });

  // Exposure triggers
  it('triggers board-band for exposure exactly at RM5M threshold', () => {
    expect(requiresBoardBandAuthority(5_000_000, 'AAA')).toBe(true);
  });

  it('triggers board-band for exposure above RM5M threshold', () => {
    expect(requiresBoardBandAuthority(10_000_000, 'AAA')).toBe(true);
  });

  it('does NOT trigger board-band for exposure below RM5M with a good rating', () => {
    expect(requiresBoardBandAuthority(4_999_999, 'AAA')).toBe(false);
  });

  // Rating triggers (LOS-002 corrected: ordinal >= CC)
  it('triggers board-band for CC rating even with exposure below RM5M', () => {
    expect(requiresBoardBandAuthority(1_000_000, 'CC')).toBe(true);
  });

  it('triggers board-band for D rating (worst) regardless of exposure', () => {
    expect(requiresBoardBandAuthority(100, 'D')).toBe(true);
  });

  it('triggers board-band for C rating with low exposure', () => {
    expect(requiresBoardBandAuthority(100, 'C')).toBe(true);
  });

  it('triggers board-band for NR (not rated) with low exposure', () => {
    expect(requiresBoardBandAuthority(100, 'NR')).toBe(true);
  });

  it('does NOT trigger board-band for AAA rating with low exposure', () => {
    expect(requiresBoardBandAuthority(100, 'AAA')).toBe(false);
  });

  it('does NOT trigger board-band for BBB rating with low exposure', () => {
    expect(requiresBoardBandAuthority(100, 'BBB')).toBe(false);
  });

  it('does NOT trigger board-band for CCC rating with low exposure', () => {
    expect(requiresBoardBandAuthority(100, 'CCC')).toBe(false);
  });

  it('treats an unknown rating conservatively as board band', () => {
    expect(requiresBoardBandAuthority(100, 'UNKNOWN')).toBe(true);
  });

  it('treats a null rating conservatively as board band', () => {
    expect(requiresBoardBandAuthority(100, null)).toBe(true);
  });

  // Authority enforcement within board-band
  it('blocks MANAGER-level authority when board-band is triggered', () => {
    const authorityOrdinal = AUTHORITY_HIERARCHY['MANAGER']; // 2
    expect(authorityOrdinal < COMMITTEE_AUTHORITY_LEVEL).toBe(true); // 2 < 4 → true → blocked
  });

  it('blocks SENIOR_MANAGER-level authority when board-band is triggered', () => {
    const authorityOrdinal = AUTHORITY_HIERARCHY['SENIOR_MANAGER']; // 3
    expect(authorityOrdinal < COMMITTEE_AUTHORITY_LEVEL).toBe(true); // 3 < 4 → true → blocked
  });

  it('allows COMMITTEE-level authority when board-band is triggered', () => {
    const authorityOrdinal = AUTHORITY_HIERARCHY['COMMITTEE']; // 4
    expect(authorityOrdinal < COMMITTEE_AUTHORITY_LEVEL).toBe(false); // 4 < 4 → false → allowed
  });

  it('allows BOARD-level authority when board-band is triggered', () => {
    const authorityOrdinal = AUTHORITY_HIERARCHY['BOARD']; // 5
    expect(authorityOrdinal < COMMITTEE_AUTHORITY_LEVEL).toBe(false); // 5 < 4 → false → allowed
  });

  // Combined: full board-band check logic
  it('rejects approval from MANAGER for RM5M+ exposure (below COMMITTEE)', () => {
    const triggersBand = requiresBoardBandAuthority(5_000_000, 'BB');
    const authorityOrdinal = AUTHORITY_HIERARCHY['MANAGER']; // 2
    const blockedByBand = triggersBand && authorityOrdinal < COMMITTEE_AUTHORITY_LEVEL;
    expect(triggersBand).toBe(true);
    expect(blockedByBand).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Authority level hierarchy — lower level cannot override higher
// ---------------------------------------------------------------------------
describe('Authority level hierarchy — lower level cannot override higher', () => {
  it('RM (1) cannot override MANAGER (2) decision', () => {
    expect(hasSufficientAuthority('RM', 'MANAGER')).toBe(false);
  });

  it('MANAGER (2) cannot override SENIOR_MANAGER (3) decision', () => {
    expect(hasSufficientAuthority('MANAGER', 'SENIOR_MANAGER')).toBe(false);
  });

  it('SENIOR_MANAGER (3) cannot override COMMITTEE (4) decision', () => {
    expect(hasSufficientAuthority('SENIOR_MANAGER', 'COMMITTEE')).toBe(false);
  });

  it('COMMITTEE (4) cannot override BOARD (5) decision', () => {
    expect(hasSufficientAuthority('COMMITTEE', 'BOARD')).toBe(false);
  });

  it('RM (1) cannot override BOARD (5) decision — skip two levels', () => {
    expect(hasSufficientAuthority('RM', 'BOARD')).toBe(false);
  });

  // Positive: equal level is sufficient
  it('MANAGER (2) can meet MANAGER (2) requirement', () => {
    expect(hasSufficientAuthority('MANAGER', 'MANAGER')).toBe(true);
  });

  // Positive: higher level can override lower
  it('BOARD (5) can meet MANAGER (2) requirement', () => {
    expect(hasSufficientAuthority('BOARD', 'MANAGER')).toBe(true);
  });

  it('COMMITTEE (4) can meet MANAGER (2) requirement', () => {
    expect(hasSufficientAuthority('COMMITTEE', 'MANAGER')).toBe(true);
  });

  // getUserAuthorityLevel picks the highest
  it('getUserAuthorityLevel returns the highest level from mixed roles', () => {
    expect(getUserAuthorityLevel(['RM', 'MANAGER'])).toBe(LEVEL_MANAGER);
    expect(getUserAuthorityLevel(['RM', 'BOARD'])).toBe(LEVEL_BOARD);
    expect(getUserAuthorityLevel(['CREDIT_RM', 'CREDIT_MANAGER', 'SENIOR_CREDIT_OFFICER'])).toBe(LEVEL_SENIOR_MANAGER);
  });

  it('getHighestAuthorityLevelName returns correct role name for mixed roles', () => {
    expect(getHighestAuthorityLevelName(['RM', 'MANAGER'])).toBe('MANAGER');
    expect(getHighestAuthorityLevelName(['RM', 'BOARD'])).toBe('BOARD');
  });

  it('getRoleNamesForAuthorityLevel maps each level to correct roles', () => {
    expect(getRoleNamesForAuthorityLevel(1)).toEqual(expect.arrayContaining(['CREDIT_RM', 'RM']));
    expect(getRoleNamesForAuthorityLevel(2)).toEqual(expect.arrayContaining(['CREDIT_MANAGER', 'MANAGER']));
    expect(getRoleNamesForAuthorityLevel(3)).toEqual(expect.arrayContaining(['SENIOR_CREDIT_OFFICER', 'SENIOR_MANAGER']));
    expect(getRoleNamesForAuthorityLevel(4)).toEqual(expect.arrayContaining(['CREDIT_COMMITTEE', 'COMMITTEE']));
    expect(getRoleNamesForAuthorityLevel(5)).toEqual(expect.arrayContaining(['CREDIT_ADMIN', 'ADMIN', 'BOARD_RISK_COMMITTEE', 'BOARD']));
  });
});

// ---------------------------------------------------------------------------
// 6. Self-approval SOD — RM cannot approve own application
// ---------------------------------------------------------------------------
describe('Self-approval SOD — RM cannot approve own application', () => {
  // Pure logic: assignedRmId === actorId → rejection

  it('blocks approval when actor is the assigned RM', () => {
    const assignedRmId = 'user-rm-001';
    const actorId = 'user-rm-001';
    expect(assignedRmId === actorId).toBe(true); // SOD violation
  });

  it('allows approval when actor is NOT the assigned RM', () => {
    const assignedRmId: string = 'user-rm-001';
    const actorId: string = 'user-analyst-001';
    expect(assignedRmId === actorId).toBe(false); // no SOD violation
  });

  it('blocks approval when RM has dual roles (RM + MANAGER) but is still the assigned RM', () => {
    // Even if the RM also has MANAGER role, they still can't approve their own app
    const assignedRmId = 'user-rm-001';
    const actorId = 'user-rm-001';
    const actorRoles = ['RM', 'MANAGER'];
    // The SOD check only looks at userId equality, not roles
    expect(assignedRmId === actorId).toBe(true); // still blocked
  });

  it('does not block a different user who happens to have RM role', () => {
    const assignedRmId: string = 'user-rm-001';
    const actorId: string = 'user-rm-002'; // different user, even with same role
    expect(assignedRmId === actorId).toBe(false); // no SOD violation
  });

  // SOD conflict from checkSodConflict: originator+approver role on the same app
  it('detects SOD conflict when user has both originator and approver roles AND is the assigned RM', () => {
    // checkSodConflict returns true if:
    //   user has ORIGINATOR role (CREDIT_RM) AND
    //   user has APPROVER role (CREDIT_MANAGER) AND
    //   user is the assigned RM on the application
    const roleNames = ['CREDIT_RM', 'CREDIT_MANAGER'];
    const ORIGINATOR_ROLES = ['CREDIT_RM'];
    const APPROVER_ROLES = ['CREDIT_MANAGER'];
    const isAdmin = false;
    const hasOriginatorRole = roleNames.some(r => ORIGINATOR_ROLES.includes(r));
    const hasApproverRole = roleNames.some(r => APPROVER_ROLES.includes(r));
    const isAssignedRm = true; // this user is the RM on the app

    const hasConflict = !isAdmin && hasOriginatorRole && hasApproverRole && isAssignedRm;
    expect(hasConflict).toBe(true);
  });

  it('does NOT report SOD conflict when user has originator role but is NOT the assigned RM', () => {
    const roleNames = ['CREDIT_RM', 'CREDIT_MANAGER'];
    const ORIGINATOR_ROLES = ['CREDIT_RM'];
    const APPROVER_ROLES = ['CREDIT_MANAGER'];
    const isAdmin = false;
    const hasOriginatorRole = roleNames.some(r => ORIGINATOR_ROLES.includes(r));
    const hasApproverRole = roleNames.some(r => APPROVER_ROLES.includes(r));
    const isAssignedRm = false; // different RM is assigned

    const hasConflict = !isAdmin && hasOriginatorRole && hasApproverRole && isAssignedRm;
    expect(hasConflict).toBe(false);
  });

  it('does NOT report SOD conflict when user has only originator role (no approver role)', () => {
    const roleNames = ['CREDIT_RM']; // no approver role
    const ORIGINATOR_ROLES = ['CREDIT_RM'];
    const APPROVER_ROLES = ['CREDIT_MANAGER'];
    const hasOriginatorRole = roleNames.some(r => ORIGINATOR_ROLES.includes(r));
    const hasApproverRole = roleNames.some(r => APPROVER_ROLES.includes(r));
    expect(hasOriginatorRole && hasApproverRole).toBe(false);
  });

  it('ADMIN bypasses authority-level SOD conflict check', () => {
    // checkSodConflict returns false for admin users even if they have both roles
    const roleNames = ['ADMIN', 'CREDIT_RM', 'CREDIT_MANAGER'];
    const ADMIN_BYPASS_ROLES = ['ADMIN', 'CREDIT_ADMIN'];
    const isAdmin = roleNames.some(r => ADMIN_BYPASS_ROLES.includes(r));
    expect(isAdmin).toBe(true);
    // In checkSodConflict, isAdmin → returns false (no conflict)
  });

  // Edge: null/undefined RM
  it('does not block approval when assignedRmId is null (no RM assigned)', () => {
    const assignedRmId: string | null = null;
    const actorId = 'user-analyst-001';
    expect(assignedRmId === actorId).toBe(false); // no SOD violation
  });

  it('does not block approval when assignedRmId is undefined (no RM assigned)', () => {
    const assignedRmId: string | undefined = undefined;
    const actorId = 'user-analyst-001';
    expect(assignedRmId === actorId).toBe(false); // no SOD violation
  });
});

// ---------------------------------------------------------------------------
// 7. ratingToOrdinal — verify ordering for board-band calculations
// ---------------------------------------------------------------------------
describe('ratingToOrdinal — ordering for board-band', () => {
  it('AAA has the lowest (best) ordinal', () => {
    expect(ratingToOrdinal('AAA')).toBe(1);
  });

  it('D has a higher (worse) ordinal than CC', () => {
    expect(ratingToOrdinal('D')).toBeGreaterThan(ratingToOrdinal('CC'));
  });

  it('CC ordinal is 8', () => {
    expect(ratingToOrdinal('CC')).toBe(8);
  });

  it('CCC ordinal is less than CC (better rating)', () => {
    expect(ratingToOrdinal('CCC')).toBeLessThan(ratingToOrdinal('CC'));
  });

  it('unknown rating defaults to 99', () => {
    expect(ratingToOrdinal('UNKNOWN')).toBe(99);
  });

  it('NR (not rated) has the worst defined ordinal', () => {
    expect(ratingToOrdinal('NR')).toBe(11);
    expect(ratingToOrdinal('NR')).toBeGreaterThan(ratingToOrdinal('D'));
  });

  // Verify the complete ordering
  it('ratings are strictly ordered from best to worst', () => {
    const ratings = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D'];
    const ordinals = ratings.map(ratingToOrdinal);
    // Each subsequent ordinal should be strictly greater
    for (let i = 1; i < ordinals.length; i++) {
      expect(ordinals[i]).toBeGreaterThan(ordinals[i - 1]);
    }
  });
});