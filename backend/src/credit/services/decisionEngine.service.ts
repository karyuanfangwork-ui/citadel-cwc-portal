import { RiskRating } from '../types/credit.types';
import { ratingToOrdinal } from './approvalMatrix.service';
import { MissingInputRecord } from './missingDataPolicy.service';

export type DecisionRecommendation = 'APPROVE' | 'CONDITIONAL' | 'REJECT';

export interface RuleTraceEntry {
  rule: string;
  recommendation: DecisionRecommendation;
  detail: string;
}

export interface DecisionInput {
  score: number;
  rating: RiskRating | string;
  amlBlocked: boolean;
  fraudFlags: string[];
  missingInputs?: MissingInputRecord[];
}

export interface DecisionResult {
  recommendation: DecisionRecommendation;
  ruleTrace: RuleTraceEntry[];
  reasonCodes: string[];
}

// Rating ordinal thresholds (from approvalMatrix.service RATING_ORDER)
// AAA=1 ... D=10. CCC starts at ordinal 8.
const REJECT_RATING_ORDINAL = 7; // CCC or worse (ordinal >= 8 → REJECT)
const CONDITIONAL_RATING_ORDINAL = 4; // BBB or worse (ordinal >= 5 → CONDITIONAL)

/**
 * Decision recommendation engine.
 *
 * Evaluates a set of rules and returns APPROVE, CONDITIONAL, or REJECT.
 * On conflict, the stricter recommendation wins (REJECT > CONDITIONAL > APPROVE).
 * Each rule that fires is recorded in the rule trace for auditability.
 */
export function recommendDecision(input: DecisionInput): DecisionResult {
  const trace: RuleTraceEntry[] = [];
  const reasonCodes: string[] = [];

  // Rule 1: AML block → REJECT (strictest, short-circuits)
  if (input.amlBlocked) {
    trace.push({
      rule: 'AML_BLOCKED',
      recommendation: 'REJECT',
      detail: 'AML screening is blocked — application cannot proceed.',
    });
    reasonCodes.push('AML_BLOCKED');
  }

  // Rule 2: Fraud flags → REJECT
  if (input.fraudFlags.length > 0) {
    trace.push({
      rule: 'FRAUD_FLAGS_PRESENT',
      recommendation: 'REJECT',
      detail: `Fraud flags detected: ${input.fraudFlags.join(', ')}`,
    });
    reasonCodes.push('FRAUD_FLAGS');
  }

  // Rule 3: Rating-based assessment
  const ratingOrdinal = ratingToOrdinal(input.rating as string);
  if (ratingOrdinal >= REJECT_RATING_ORDINAL + 1) {
    // CCC, CC, C, D → REJECT
    trace.push({
      rule: 'RATING_PROHIBITED',
      recommendation: 'REJECT',
      detail: `Risk rating ${input.rating} is in the prohibited risk band.`,
    });
    reasonCodes.push('RATING_PROHIBITED');
  } else if (ratingOrdinal >= CONDITIONAL_RATING_ORDINAL + 1) {
    // BBB, BB, B → CONDITIONAL
    trace.push({
      rule: 'RATING_MODERATE',
      recommendation: 'CONDITIONAL',
      detail: `Risk rating ${input.rating} requires conditional approval.`,
    });
    reasonCodes.push('RATING_MODERATE');
  } else {
    // AAA, AA, A → APPROVE (from rating perspective)
    trace.push({
      rule: 'RATING_LOW_RISK',
      recommendation: 'APPROVE',
      detail: `Risk rating ${input.rating} is in the low-risk band.`,
    });
  }

  // Rule 4: Missing inputs → CONDITIONAL (downgrade APPROVE to CONDITIONAL)
  if (input.missingInputs && input.missingInputs.length > 0) {
    trace.push({
      rule: 'MISSING_INPUTS',
      recommendation: 'CONDITIONAL',
      detail: `${input.missingInputs.length} factor(s) had missing source data: ${input.missingInputs.map((m) => m.factor).join(', ')}`,
    });
    reasonCodes.push('MISSING_INPUTS');
  }

  // Stricter-rule-wins: REJECT > CONDITIONAL > APPROVE
  const severity: Record<DecisionRecommendation, number> = { APPROVE: 0, CONDITIONAL: 1, REJECT: 2 };
  const recommendation = trace.reduce<DecisionRecommendation>(
    (strictest, entry) =>
      severity[entry.recommendation] > severity[strictest]
        ? entry.recommendation
        : strictest,
    'APPROVE',
  );

  return { recommendation, ruleTrace: trace, reasonCodes };
}