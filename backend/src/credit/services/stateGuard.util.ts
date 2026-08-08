// ============================================================================
// State Guard Utility — Ensures sub-resource mutations only proceed when the
// parent application is in an editable (or deletable) state.
// ============================================================================

import { ApplicationState } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';

/**
 * States in which the application data can be freely edited (create / update
 * on sub-resources like facilities, parties, document uploads).
 */
const EDITABLE_STATES: ApplicationState[] = [
  'DRAFT',
  'KYC_REVIEW',
  'COMPLIANCE_HOLD',
  'KYC_APPROVED',
  'UNDERWRITING',
  'CREDIT_ASSESSMENT',
  'COMMITTEE_REVIEW',
  'OFFER',
];

/**
 * States in which document deletion is allowed.
 *
 * LOS-007: this list previously included APPROVED, OFFER and ACCEPTED to permit
 * "cleanup of stale documents". That is precisely the window in which documents
 * are the retained evidence behind a credit decision — removing one leaves the
 * decision unsupported. Post-decision corrections must go through a controlled
 * supersession (upload a new version), never a delete.
 */
const DELETABLE_STATES: ApplicationState[] = [
  'DRAFT',
  'KYC_REVIEW',
  'COMPLIANCE_HOLD',
  'KYC_APPROVED',
  'UNDERWRITING',
  'CREDIT_ASSESSMENT',
  'COMMITTEE_REVIEW',
];

/**
 * Throws an AppError(400) if the given state is not in the editable list.
 */
export function requireEditableState(state: ApplicationState, action: string): void {
  if (!EDITABLE_STATES.includes(state)) {
    throw new AppError(
      `Cannot ${action} — application is in ${state} state. Edits are only allowed in DRAFT, KYC_REVIEW, COMPLIANCE_HOLD, KYC_APPROVED, UNDERWRITING, CREDIT_ASSESSMENT, COMMITTEE_REVIEW, or OFFER states.`,
      400,
    );
  }
}

/**
 * Throws an AppError(400) if the given state is not in the deletable list.
 */
export function requireDeletableState(state: ApplicationState, action: string): void {
  if (!DELETABLE_STATES.includes(state)) {
    throw new AppError(
      `Cannot ${action} — application is in ${state} state. Deletion is only allowed in DRAFT, KYC_REVIEW, COMPLIANCE_HOLD, KYC_APPROVED, UNDERWRITING, CREDIT_ASSESSMENT, or COMMITTEE_REVIEW states.`,
      400,
    );
  }
}