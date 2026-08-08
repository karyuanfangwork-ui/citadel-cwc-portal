/**
 * LOS-007 — documents behind a credit decision must not be replaced or removed.
 */
import { requireEditableState, requireDeletableState } from '../stateGuard.util';
import { AppError } from '../../../middleware/error.middleware';
import { ApplicationState } from '@prisma/client';

const POST_DECISION_STATES = [
  ApplicationState.APPROVED,
  ApplicationState.OFFER,
  ApplicationState.ACCEPTED,
] as const;

const PRE_DECISION_STATES = [
  ApplicationState.DRAFT,
  ApplicationState.UNDERWRITING,
  ApplicationState.CREDIT_ASSESSMENT,
  ApplicationState.COMMITTEE_REVIEW,
] as const;

describe('requireDeletableState (LOS-007)', () => {
  it.each(POST_DECISION_STATES)('blocks deletion in %s', (state) => {
    expect(() => requireDeletableState(state, 'delete document')).toThrow(AppError);
  });

  it.each(PRE_DECISION_STATES)('still allows deletion in %s', (state) => {
    expect(() => requireDeletableState(state, 'delete document')).not.toThrow();
  });
});

describe('requireEditableState (LOS-007)', () => {
  it.each([ApplicationState.APPROVED, ApplicationState.ACCEPTED])('blocks edits in %s', (state) => {
    expect(() => requireEditableState(state, 'replace document')).toThrow(AppError);
  });
});