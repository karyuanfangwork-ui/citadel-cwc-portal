/**
 * Shared request-status constants — single source of truth for the backend.
 *
 * CLOSED_STATUSES  — every terminal/closed status (request is done, no further action).
 * RESOLVED_STATUSES — statuses that count as positively resolved (for avg-resolution-time metrics).
 *
 * These MUST be kept in sync with the frontend's RESOLVED_STATUSES set
 * in frontend/constants.tsx.
 */

import { RequestStatus } from '@prisma/client';

/** Statuses that represent a successfully resolved request. */
export const RESOLVED_STATUSES: RequestStatus[] = [
  RequestStatus.RESOLVED,
  RequestStatus.COMPLETED,
  RequestStatus.PAYMENT_COMPLETED,
];

/**
 * All terminal / closed statuses — a request in any of these states
 * is considered "closed" and excluded from open-request counts.
 *
 * Aligned with the frontend RESOLVED_STATUSES set in frontend/constants.tsx.
 */
export const CLOSED_STATUSES: RequestStatus[] = [
  // Positively resolved
  RequestStatus.RESOLVED,
  RequestStatus.COMPLETED,
  RequestStatus.PAYMENT_COMPLETED,
  RequestStatus.REIMBURSEMENT_CLOSED,
  RequestStatus.TICKET_CLOSED_FIN,

  // Generic rejected / cancelled
  RequestStatus.REJECTED,
  RequestStatus.CANCELLED,

  // Onboarding / Offboarding completed
  RequestStatus.ONBOARDING_COMPLETED,
  RequestStatus.OFFBOARDING_COMPLETED,

  // LOA
  RequestStatus.LOA_ACCEPTED,

  // CEO-level rejections
  RequestStatus.CEO_REJECTED,
  RequestStatus.CEO_REJECTED_FIN,

  // IT workflow rejections
  RequestStatus.CTO_REJECTED_IT,
  RequestStatus.CFO_REJECTED_IT,
  RequestStatus.MANAGER_REJECTED_IT,

  // Finance workflow rejections
  RequestStatus.MANAGER_REJECTED_FIN,
  RequestStatus.FINANCE_HEAD_REJECTED,
  RequestStatus.CFO_REJECTED_FIN,

  // Group-level rejections
  RequestStatus.GROUP_DCEO_REJECTED,

  // Finance payment confirmed
  RequestStatus.PAYMENT_CONFIRMED_FIN,

  // Chargeback
  RequestStatus.FROM_ENTITY_REJECTED,
  RequestStatus.TO_ENTITY_REJECTED,
  RequestStatus.CHARGEBACK_COMPLETED,
];