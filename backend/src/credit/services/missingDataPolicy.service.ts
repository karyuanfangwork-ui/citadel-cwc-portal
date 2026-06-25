export type MissingDataPolicy = 'NEUTRAL' | 'PENALTY' | 'BLOCK';

export interface MissingDataPolicyConfig {
  factor: string;
  policy: MissingDataPolicy;
  penaltyScore: number;  // score used when PENALTY (default 25)
}

// Default policies per factor group. NEUTRAL = 50 (current behavior),
// PENALTY = 25 (conservative downgrade), BLOCK = throw (prevent scoring).
const DEFAULT_POLICIES: Record<string, MissingDataPolicyConfig> = {
  financial_performance: { factor: 'financial_performance', policy: 'NEUTRAL', penaltyScore: 25 },
  leverage: { factor: 'leverage', policy: 'NEUTRAL', penaltyScore: 25 },
  liquidity: { factor: 'liquidity', policy: 'NEUTRAL', penaltyScore: 25 },
  cashflow: { factor: 'cashflow', policy: 'NEUTRAL', penaltyScore: 25 },
  management: { factor: 'management', policy: 'NEUTRAL', penaltyScore: 25 },
  industry: { factor: 'industry', policy: 'NEUTRAL', penaltyScore: 25 },
  collateral: { factor: 'collateral', policy: 'NEUTRAL', penaltyScore: 25 },
  relationship: { factor: 'relationship', policy: 'NEUTRAL', penaltyScore: 25 },
  market_conditions: { factor: 'market_conditions', policy: 'NEUTRAL', penaltyScore: 25 },
};

export interface MissingInputRecord {
  factor: string;
  subField: string;
  policy: MissingDataPolicy;
  appliedScore: number;
}

/**
 * Get the effective missing-data policy for a factor. Reads from
 * CreditRuleConfig if configured, otherwise falls back to the hardcoded
 * defaults (all NEUTRAL — current behavior).
 */
export async function getMissingDataPolicies(): Promise<Record<string, MissingDataPolicyConfig>> {
  // For now, return the defaults. Phase 5 will add DB-backed config via
  // CreditRuleConfig or a dedicated MissingDataPolicyConfig table.
  return DEFAULT_POLICIES;
}

/**
 * Resolve the score for a factor with missing data, based on the configured
 * policy. Returns the score and a MissingInputRecord for the audit trail.
 *
 * - NEUTRAL: returns 50 (current behavior)
 * - PENALTY: returns the configured penaltyScore (default 25)
 * - BLOCK: throws an AppError so the score run fails with a clear message
 */
export function resolveMissingFactorScore(
  factor: string,
  subField: string,
  policies: Record<string, MissingDataPolicyConfig>,
): { score: number; record: MissingInputRecord } {
  const config = policies[factor] ?? { factor, policy: 'NEUTRAL' as MissingDataPolicy, penaltyScore: 25 };
  const policy = config.policy;

  let score: number;
  switch (policy) {
    case 'PENALTY':
      score = config.penaltyScore;
      break;
    case 'BLOCK':
      throw new Error(
        `Cannot score application — required input '${subField}' for factor '${factor}' is missing and the missing-data policy is BLOCK.`,
      );
    case 'NEUTRAL':
    default:
      score = 50;
      break;
  }

  return {
    score,
    record: { factor, subField, policy, appliedScore: score },
  };
}