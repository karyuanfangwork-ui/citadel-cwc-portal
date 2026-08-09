export type MissingDataPolicy = 'NEUTRAL' | 'PENALTY' | 'BLOCK';

import { getNumberPolicy, getStringPolicy, PolicyScope } from './policyParameter.service';
import { AppError } from '../../middleware/error.middleware';

export interface MissingDataPolicyConfig {
  factor: string;
  policy: MissingDataPolicy;
  penaltyScore: number;  // score used when PENALTY (default 25)
  neutralScore?: number; // score used when NEUTRAL (default 50)
}

/**
 * LOS-011 — Default missing-data treatment per factor.
 *
 * These are the fail-safe defaults; every value is overridable per lane /
 * product / borrower type via CreditRuleConfig keys
 * `missing_data.<factor>.policy` and `missing_data.<factor>.penalty_score`.
 *
 * Previously every factor defaulted to NEUTRAL (50), so an application with no
 * DSR and no financials still produced a plausible mid-range score.
 */
const DEFAULT_POLICIES: Record<string, MissingDataPolicyConfig> = {
  // Core repayment capacity — no DSR means no assessed ability to repay.
  cashflow:              { factor: 'cashflow',              policy: 'BLOCK',   penaltyScore: 25 },
  // Core financial evidence — penalise heavily rather than block, because some
  // lanes legitimately assess on bureau + income documents alone.
  financial_performance: { factor: 'financial_performance', policy: 'PENALTY', penaltyScore: 25 },
  leverage:              { factor: 'leverage',              policy: 'PENALTY', penaltyScore: 25 },
  liquidity:             { factor: 'liquidity',             policy: 'PENALTY', penaltyScore: 25 },
  // Judgemental factors — a missing view is not the same as adverse evidence.
  management:            { factor: 'management',            policy: 'PENALTY', penaltyScore: 25 },
  industry:              { factor: 'industry',              policy: 'NEUTRAL', penaltyScore: 25 },
  collateral:            { factor: 'collateral',            policy: 'PENALTY', penaltyScore: 25 },
  relationship:          { factor: 'relationship',          policy: 'NEUTRAL', penaltyScore: 25 },
  market_conditions:     { factor: 'market_conditions',     policy: 'NEUTRAL', penaltyScore: 25 },
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
 * defaults. Supports per-lane overrides via PolicyScope.
 */
export async function getMissingDataPolicies(
  scope?: PolicyScope,
): Promise<Record<string, MissingDataPolicyConfig>> {
  const neutralScore = await getNumberPolicy('missing_data.neutral_score', 50, scope);
  const entries = await Promise.all(
    Object.entries(DEFAULT_POLICIES).map(async ([factor, fallback]) => {
      const policyValue = await getStringPolicy(`missing_data.${factor}.policy`, fallback.policy, scope);
      const policy = ['NEUTRAL', 'PENALTY', 'BLOCK'].includes(policyValue)
        ? policyValue as MissingDataPolicy
        : fallback.policy;
      const penaltyScore = await getNumberPolicy(`missing_data.${factor}.penalty_score`, fallback.penaltyScore, scope);

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
 * - BLOCK: throws an AppError(400) so the score run fails with a clear message
 */
export function resolveMissingFactorScore(
  factor: string,
  subField: string,
  policies: Record<string, MissingDataPolicyConfig>,
): { score: number; record: MissingInputRecord } {
  // LOS-011 — an unconfigured factor must not default to neutral. Treat the
  // absence of configuration as conservatively as a configured PENALTY.
  const config = policies[factor] ?? {
    factor,
    policy: 'PENALTY' as MissingDataPolicy,
    penaltyScore: 25,
    neutralScore: 50,
  };
  const policy = config.policy;

  let score: number;
  switch (policy) {
    case 'PENALTY':
      score = config.penaltyScore;
      break;
    case 'BLOCK':
      // LOS-011 — AppError(400), not a bare Error: an incomplete file is a
      // user-fixable condition, not a server fault. A bare Error surfaced as a
      // 500 and told the analyst nothing actionable.
      throw new AppError(
        `Cannot score this application — required input '${subField}' for factor '${factor}' is missing, ` +
        `and credit policy blocks scoring without it.`,
        400,
        { code: 'MISSING_DATA_BLOCKED', factor, subField },
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