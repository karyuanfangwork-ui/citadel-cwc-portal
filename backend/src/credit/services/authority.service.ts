// ---------------------------------------------------------------------------
// Canonical credit authority levels
// ---------------------------------------------------------------------------

// Higher number = higher authority.
//
// GAP-P1-11 — platform-wide ADMIN is deliberately absent. Credit authority
// comes only from an explicit credit role; CREDIT_ADMIN remains credit-specific.
export const AUTHORITY_HIERARCHY: Record<string, number> = {
  RM: 1,
  MANAGER: 2,
  SENIOR_MANAGER: 3,
  COMMITTEE: 4,
  BOARD: 5,

  // Legacy/system role aliases.
  CREDIT_RM: 1,
  CREDIT_MANAGER: 2,
  SENIOR_CREDIT_OFFICER: 3,
  CREDIT_COMMITTEE: 4,
  CREDIT_ADMIN: 5,
  BOARD_RISK_COMMITTEE: 5,
};

/** Sentinel for users with no role carrying credit authority. */
export const NO_CREDIT_AUTHORITY = 'NONE';

const ROLE_NAMES_BY_AUTHORITY_LEVEL: Record<number, string[]> = {
  1: ['CREDIT_RM', 'RM'],
  2: ['CREDIT_MANAGER', 'MANAGER'],
  3: ['SENIOR_CREDIT_OFFICER', 'SENIOR_MANAGER'],
  4: ['CREDIT_COMMITTEE', 'COMMITTEE'],
  5: ['CREDIT_ADMIN', 'BOARD_RISK_COMMITTEE', 'BOARD'],
};

export function hasSufficientAuthority(userAuthority: string, requiredAuthority: string): boolean {
  const userLevel = AUTHORITY_HIERARCHY[userAuthority] ?? 0;
  const requiredLevel = AUTHORITY_HIERARCHY[requiredAuthority] ?? 0;
  return userLevel >= requiredLevel;
}

/**
 * Map authority level number to role names that commonly hold that authority.
 * Used for routing/notification candidate lookup, not as a direct permission grant.
 */
export function getRoleNamesForAuthorityLevel(level: number): string[] {
  return ROLE_NAMES_BY_AUTHORITY_LEVEL[level] ?? ROLE_NAMES_BY_AUTHORITY_LEVEL[5];
}

/**
 * Given a set of user role names, return the highest authority level key.
 */
export function getHighestAuthorityLevelName(userRoles: string[]): string {
  // GAP-P1-11 — no credit role must not fall back to a real authority level.
  let highestName = NO_CREDIT_AUTHORITY;
  let highestRank = 0;

  for (const role of userRoles) {
    const rank = AUTHORITY_HIERARCHY[role] ?? 0;
    if (rank > highestRank) {
      highestRank = rank;
      highestName = role;
    }
  }

  return highestName;
}

/**
 * Given a set of user role names, return the highest numeric authority rank.
 */
export function getUserAuthorityLevel(userRoles: string[]): number {
  return Math.max(0, ...userRoles.map((role) => AUTHORITY_HIERARCHY[role] ?? 0));
}
