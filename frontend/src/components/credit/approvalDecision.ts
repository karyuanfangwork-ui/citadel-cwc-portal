import type { ApprovalDecision } from '@/src/services/credit.service';

/**
 * LOS-012 — One decision contract for every approval surface.
 *
 * These rules mirror the backend Zod validator in
 * backend/src/credit/validators/approval.validator.ts. The backend remains the
 * enforcing authority; this module exists so the desktop panel, the quick view
 * and the mobile inbox cannot drift from it (they previously posted payloads
 * missing rejectionReasonCode / conditions and simply failed with a 400).
 */

export const COMMENT_MIN_LENGTH = 10;
export const OVERRIDE_REASON_MIN_LENGTH = 10;

export const REASON_REQUIRED_DECISIONS: ApprovalDecision[] = ['REJECT', 'CONDITIONAL', 'RETURN'];
const TERMINAL_DECISIONS: ApprovalDecision[] = ['APPROVE', 'REJECT', 'CONDITIONAL'];

export interface ApprovalCondition {
  title: string;
  description?: string;
  category?: string;
  conditionType?: string;
  dueDate?: string | null;
}

export interface ApprovalDecisionInput {
  decision: ApprovalDecision;
  comment: string;
  rejectionReasonCode?: string;
  conditions?: ApprovalCondition[];
  systemRecommendation?: string | null;
  overrideReason?: string;
  /** Some approval tiers require a comment even on a plain APPROVE. */
  requireCommentForTier?: boolean;
}

/** Mirrors backend deriveOverride; backend remains authoritative. */
export function isOverrideOf(systemRecommendation: string | null | undefined, decision: ApprovalDecision): boolean {
  if (!systemRecommendation) return false;
  const recommendation = systemRecommendation.trim().toUpperCase();
  return TERMINAL_DECISIONS.includes(recommendation as ApprovalDecision)
    && TERMINAL_DECISIONS.includes(decision)
    && decision !== recommendation;
}

/** Returns null when the input is valid, otherwise a user-facing message. */
export function validateApprovalDecision(input: ApprovalDecisionInput): string | null {
  const comment = input.comment?.trim() ?? '';

  if (input.requireCommentForTier && !comment) {
    return 'A comment is required for this approval tier';
  }

  if (REASON_REQUIRED_DECISIONS.includes(input.decision) && comment.length < COMMENT_MIN_LENGTH) {
    return `A reason of at least ${COMMENT_MIN_LENGTH} characters is required for a ${input.decision.toLowerCase()} decision`;
  }

  if (input.decision === 'REJECT' && !input.rejectionReasonCode) {
    return 'A rejection reason code is required';
  }

  if (input.decision === 'CONDITIONAL' && (input.conditions?.length ?? 0) === 0) {
    return 'At least one condition is required for a conditional approval';
  }

  if (isOverrideOf(input.systemRecommendation, input.decision)) {
    const reason = input.overrideReason?.trim() ?? '';
    if (reason.length < OVERRIDE_REASON_MIN_LENGTH) {
      return `This decision overrides the system recommendation (${input.systemRecommendation}). Give an override reason of at least ${OVERRIDE_REASON_MIN_LENGTH} characters.`;
    }
  }

  return null;
}

/** Builds the exact body creditService.submitApproval expects. */
export function buildApprovalPayload(input: ApprovalDecisionInput) {
  const comment = input.comment?.trim() ?? '';
  return {
    decision: input.decision,
    comment: comment || undefined,
    rejectionReasonCode: input.decision === 'REJECT' ? input.rejectionReasonCode : undefined,
    conditions: input.decision === 'CONDITIONAL' ? input.conditions : undefined,
    ...(isOverrideOf(input.systemRecommendation, input.decision) && input.overrideReason?.trim()
      ? { overrideReason: input.overrideReason.trim() }
      : {}),
  };
}