// backend/src/credit/services/committeeEntryGate.ts
import { validateSubmissionReadiness } from './submissionReadiness.service';
import { freezeAssessmentResult } from './assessmentResult.service';

/**
 * LOS-015 — Every transition whose target state is COMMITTEE_REVIEW must pass
 * the same gate. Previously only `submit_to_committee` was gated, so an
 * application returned to the analyst could re-enter committee via
 * `resume_committee` with a stale score, an unfrozen assessment and an
 * unlocked memo.
 */
export const COMMITTEE_ENTRY_ACTIONS = ['submit_to_committee', 'resume_committee'] as const;

export type CommitteeEntryAction = (typeof COMMITTEE_ENTRY_ACTIONS)[number];

export function isCommitteeEntryAction(action: string): action is CommitteeEntryAction {
  return (COMMITTEE_ENTRY_ACTIONS as readonly string[]).includes(action);
}

/**
 * Validate committee readiness BEFORE any irreversible step, then freeze the
 * assessment result and lock the memo version. A failed entry must leave no
 * frozen assessment and no locked memo behind.
 */
export async function enforceCommitteeEntryGate(
  applicationId: string,
  actorId: string | null,
): Promise<void> {
  const readiness = await validateSubmissionReadiness(applicationId, { stage: 'committee' });
  if (!readiness.ready) {
    const errorMessages = readiness.errors.map((e) => `${e.field}: ${e.message}`).join('; ');
    throw Object.assign(
      new Error(`Cannot enter committee review — ${errorMessages}`),
      { statusCode: 400 },
    );
  }

  await freezeAssessmentResult(applicationId, actorId ?? 'system');

  const { lockMemoVersionOnSubmission } = await import('./creditMemoVersion.service');
  await lockMemoVersionOnSubmission(applicationId, actorId);
}