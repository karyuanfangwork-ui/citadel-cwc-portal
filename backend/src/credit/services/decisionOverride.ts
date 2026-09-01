/**
 * GAP-P1-02 / CA-P4-001 — the single definition of an approval departing
 * from the system recommendation.
 */

export type SystemRecommendation = 'APPROVE' | 'CONDITIONAL' | 'REJECT';
export type OverrideDecisionType =
  | 'APPROVE' | 'REJECT' | 'RETURN' | 'ESCALATE' | 'DEFER' | 'CONDITIONAL';

export interface OverrideDerivation {
  isOverride: boolean;
  reasonRequired: boolean;
}

export const TERMINAL_DECISION_TYPES: OverrideDecisionType[] = ['APPROVE', 'REJECT', 'CONDITIONAL'];
const RECOMMENDATIONS: SystemRecommendation[] = ['APPROVE', 'CONDITIONAL', 'REJECT'];

function normaliseRecommendation(value: string | null | undefined): SystemRecommendation | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return (RECOMMENDATIONS as string[]).includes(upper) ? upper as SystemRecommendation : null;
}

export function deriveOverride(
  systemRecommendation: string | null | undefined,
  decisionType: OverrideDecisionType,
): OverrideDerivation {
  const recommendation = normaliseRecommendation(systemRecommendation);
  if (recommendation === null || !TERMINAL_DECISION_TYPES.includes(decisionType)) {
    return { isOverride: false, reasonRequired: false };
  }
  const isOverride = decisionType !== recommendation;
  return { isOverride, reasonRequired: isOverride };
}
