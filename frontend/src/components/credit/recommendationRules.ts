import type { CreditRecommendation, RecommendationDraftInput } from '@/src/services/credit.service';

/**
 * LOS-005 — Client-side mirror of the recommendation rules the backend already
 * enforces (creditRecommendation.service.ts). The backend remains authoritative;
 * these exist so the UI can disable actions and explain why, instead of posting
 * a request that will 400 or 403.
 */
export const RATIONALE_MIN_LENGTH = 20;

/** Returns null when the draft is valid, otherwise a user-facing message. */
export function validateRecommendationDraft(input: RecommendationDraftInput): string | null {
  if (!input?.recommendationType) {
    return 'Select a recommendation type';
  }

  const rationale = input.rationale?.trim() ?? '';
  if (rationale.length < RATIONALE_MIN_LENGTH) {
    return `Provide a rationale of at least ${RATIONALE_MIN_LENGTH} characters`;
  }

  if (input.recommendationType === 'CONDITIONAL' && !(input.conditions?.trim())) {
    return 'Describe the conditions for a conditional recommendation';
  }

  if (input.recommendedAmount != null && input.recommendedAmount <= 0) {
    return 'Recommended amount must be greater than zero';
  }

  if (input.recommendedTenorMonths != null && input.recommendedTenorMonths <= 0) {
    return 'Recommended tenor must be greater than zero months';
  }

  return null;
}

/** Only the author may edit, and only while the recommendation is still a DRAFT. */
export function canEditRecommendation(
  rec: CreditRecommendation | null,
  currentUserId: string,
): boolean {
  if (!rec) return false;
  return rec.status === 'DRAFT' && rec.authorId === currentUserId;
}

/** Submission has the same constraint as editing (service: only the author, only a DRAFT). */
export function canSubmitRecommendation(
  rec: CreditRecommendation | null,
  currentUserId: string,
): boolean {
  return canEditRecommendation(rec, currentUserId);
}