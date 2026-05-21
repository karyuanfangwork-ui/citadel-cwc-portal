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
  'KYC_APPROVED',
  'UNDERWRITING',
  'CREDIT_ASSESSMENT',
  'COMMITTEE_REVIEW',
  'OFFER',
];

/**
 * States in which document deletion is allowed — broader than edits because
 * approved applications may still need cleanup of stale documents.
 */
const DELETABLE_STATES: ApplicationState[] = [
  'DRAFT',
  'KYC_REVIEW',
  'KYC_APPROVED',
  'UNDERWRITING',
  'CREDIT_ASSESSMENT',
  'COMMITTEE_REVIEW',
  'APPROVED',
  'OFFER',
  'ACCEPTED',
];

/**
 * Throws an AppError(400) if the given state is not in the editable list.
 */
export function requireEditableState(state: ApplicationState, action: string): void {
  if (!EDITABLE_STATES.includes(state)) {
    throw new AppError(
      `Cannot ${action} — application is in ${state} state. Edits are only allowed in DRAFT, KYC_REVIEW, KYC_APPROVED, UNDERWRITING, CREDIT_ASSESSMENT, COMMITTEE_REVIEW, or OFFER states.`,
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
      `Cannot ${action} — application is in ${state} state. Deletion is only allowed in DRAFT, KYC_REVIEW, KYC_APPROVED, UNDERWRITING, CREDIT_ASSESSMENT, COMMITTEE_REVIEW, APPROVED, OFFER, or ACCEPTED states.`,
      400,
    );
  }
}