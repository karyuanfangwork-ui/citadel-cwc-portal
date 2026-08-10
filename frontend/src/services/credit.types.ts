// frontend/src/services/credit.types.ts

/**
 * Response types for the credit dashboard endpoints.
 *
 * These are deliberately separate from credit.service.ts, which is ~2400 lines
 * and hard to read a type out of.
 *
 * Why they exist at all: the approval-inbox endpoint was consumed as `any`, its
 * rows were rendered as if they were `CreditApplication`, and the resulting
 * `undefined` state crashed My Approvals into its error boundary for every user.
 * TypeScript had nothing to check. It does now.
 *
 * NOTE the field names. This DTO is NOT a CreditApplication:
 *   applicationId  not  id
 *   applicationNo  not  applicationNumber
 *   currentState   not  state
 *   borrowerName   is a flat string, not a nested borrowerProfile
 *
 * `currentState` is typed as `string` rather than `ApplicationState` on purpose:
 * `ApplicationState` lives in credit.service.ts, which imports this module, so
 * referencing it here would make the two files circular. MyApprovals narrows it
 * where it maps into a CreditApplication.
 */
export interface ApprovalInboxItem {
  applicationId: string;
  applicationNo: string;
  borrowerName: string;
  productType: string;
  requestedAmount: number;
  currency: string;
  currentState: string;
  urgency: string;
  submittedAt: string;
  daysWaiting: number;
  riskRating?: string;
  requestedTenor?: number;
  _slaBreached?: boolean;
}

/** An application the backend withheld, and the reason it gave (LOS-020). */
export interface ApprovalInboxExclusion {
  applicationId: string;
  borrowerName: string;
  reason: string;
}

export interface ApprovalInbox {
  high: ApprovalInboxItem[];
  medium: ApprovalInboxItem[];
  low: ApprovalInboxItem[];
  totalPending: number;
  excluded: ApprovalInboxExclusion[];
}

/** The envelope every credit endpoint wraps its payload in. */
export interface CreditApiResponse<T> {
  status: string;
  data: T;
}