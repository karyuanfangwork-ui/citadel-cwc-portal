import type { ApplicationState } from '@/src/services/credit.service';

export type BorrowerSegment = 'INDIVIDUAL' | 'SME' | 'CORPORATE';
export type BorrowerLifecycleStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type CreditTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface BorrowerListItem {
  id: string;
  borrowerNumber: string;
  name: string;
  segment: BorrowerSegment | null;
  legalType: 'INDIVIDUAL' | 'CORPORATE' | 'JOINT' | 'SOLE_PROPRIETOR';
  maskedIdentifier: string | null;
  primaryContact: string | null;
  relationshipOwner: { id: string; name: string } | null;
  activeApplicationCount: number;
  totalExposure: number;
  status: BorrowerLifecycleStatus | null;
  updatedAt: string;
}

export interface BorrowerListQuery {
  page?: number;
  limit?: number;
  search?: string;
  segment?: BorrowerSegment;
  status?: BorrowerLifecycleStatus;
  relationshipOwnerId?: string;
  hasActiveApplication?: boolean;
  sortBy?: 'name' | 'segment' | 'activeApplicationCount' | 'totalExposure' | 'status' | 'updatedAt';
  sortDirection?: 'asc' | 'desc';
}

export interface BorrowerListResponse {
  items: BorrowerListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  appliedSort: { field: string; direction: 'asc' | 'desc' };
}

export interface BorrowerStatsResponse {
  total: number;
  active: number;
  individual: number;
  sme: number;
  corporate: number;
}

export interface IdentityCheckInput {
  draftId?: string;
  segment: BorrowerSegment;
  identifier: string;
  identifierType: 'NRIC' | 'PASSPORT' | 'BUSINESS_REGISTRATION';
}

export interface DuplicateIdentityResult {
  exactMatch: boolean;
  match: {
    borrowerId: string;
    borrowerNumber: string;
    name: string;
    maskedIdentifier: string;
  } | null;
  exceptionRequestId: string | null;
  exceptionStatus?: DuplicateExceptionStatus | null;
}

export interface DuplicateExceptionInput {
  draftId: string;
  matchedBorrowerId: string;
  segment: BorrowerSegment;
  identityValue: string;
  category: string;
  justification: string;
  supportingReference?: string | null;
}

export type DuplicateExceptionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONSUMED' | 'EXPIRED';

export interface DuplicateExceptionRequest {
  id: string;
  draftId: string;
  requestedById: string;
  decidedById: string | null;
  matchedBorrowerId: string;
  segment: BorrowerSegment;
  category: string;
  justification: string;
  supportingReference: string | null;
  status: DuplicateExceptionStatus;
  decisionComment: string | null;
  expiresAt: string | null;
  identityFingerprintPrefix?: string;
  createdAt: string;
  decidedAt: string | null;
  consumedAt: string | null;
  updatedAt: string;
}

export interface DuplicateExceptionQueueItem extends DuplicateExceptionRequest {
  requester: { id: string; name: string };
  matchedBorrower: {
    id: string;
    borrowerNumber: string | null;
    name: string | null;
    maskedIdentifier: string | null;
  };
}

export interface DuplicateExceptionQueueResponse {
  items: DuplicateExceptionQueueItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface DuplicateExceptionDecision {
  decision: 'APPROVE' | 'REJECT';
  comment?: string;
}

export interface DashboardAttention {
  overdue: number;
  dueSoon: number;
  informationRequired: number;
  returned: number;
}

export interface DashboardNextAction {
  label: string;
  route: string;
}

export interface DashboardWorkItem {
  applicationId: string;
  applicationNo: string;
  currentTask: string;
  nextAction: DashboardNextAction;
  state: ApplicationState;
  updatedAt: string;
}

export interface CreditOfficerDashboard {
  attention: DashboardAttention;
  recentAssigned: DashboardWorkItem[];
}
