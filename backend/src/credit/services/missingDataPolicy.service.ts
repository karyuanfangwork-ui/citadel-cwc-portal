export type MissingDataPolicy = 'NEUTRAL' | 'PENALTY' | 'BLOCK';

import { getNumberPolicy, getStringPolicy } from './policyParameter.service';

export interface MissingDataPolicyConfig {
  factor: string;
  policy: MissingDataPolicy;
  penaltyScore: number;  // score used when PENALTY (default 25)
  neutralScore?: number; // score used when NEUTRAL (default 50)
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
  const neutralScore = await getNumberPolicy('missing_data.neutral_score', 50);
  const entries = await Promise.all(
    Object.entries(DEFAULT_POLICIES).map(async ([factor, fallback]) => {
      const policyValue = await getStringPolicy(`missing_data.${factor}.policy`, fallback.policy);
      const policy = ['NEUTRAL', 'PENALTY', 'BLOCK'].includes(policyValue)
        ? policyValue as MissingDataPolicy
        : fallback.policy;
      const penaltyScore = await getNumberPolicy(`missing_data.${factor}.penalty_score`, fallback.penaltyScore);

      return [factor, { factor, policy, penaltyScore, neutralScore }] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<string, MissingDataPolicyConfig>;
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
  const config = policies[factor] ?? { factor, policy: 'NEUTRAL' as MissingDataPolicy, penaltyScore: 25, neutralScore: 50 };
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
      score = config.neutralScore ?? 50;
      break;
  }

  return {
    score,
    record: { factor, subField, policy, appliedScore: score },
  };
}