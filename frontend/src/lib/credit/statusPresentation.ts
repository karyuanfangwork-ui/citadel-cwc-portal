import type { CreditTone } from '@/src/types/credit-ui.types';

export interface ApplicationStatusPresentation {
  label: string;
  icon: string;
  tone: CreditTone;
}

const STATUS_PRESENTATION: Record<string, ApplicationStatusPresentation> = {
  DRAFT: { label: 'Draft', icon: 'edit_note', tone: 'neutral' },
  SUBMITTED: { label: 'Submitted', icon: 'send', tone: 'info' },
  KYC_REVIEW: { label: 'Under Review', icon: 'fact_check', tone: 'info' },
  COMPLIANCE_HOLD: { label: 'Information Required', icon: 'info', tone: 'warning' },
  KYC_APPROVED: { label: 'Ready for Assessment', icon: 'assignment_turned_in', tone: 'info' },
  KYC_REJECTED: { label: 'Returned for Revision', icon: 'undo', tone: 'warning' },
  REFERRED_BACK: { label: 'Returned for Revision', icon: 'undo', tone: 'warning' },
  RETURNED_FOR_REVISION: { label: 'Returned for Revision', icon: 'undo', tone: 'warning' },
  UNDERWRITING: { label: 'Under Assessment', icon: 'query_stats', tone: 'info' },
  CREDIT_ASSESSMENT: { label: 'Under Assessment', icon: 'query_stats', tone: 'info' },
  COMMITTEE_REVIEW: { label: 'Pending Approval', icon: 'gavel', tone: 'warning' },
  APPROVED: { label: 'Approved', icon: 'check_circle', tone: 'success' },
  CONDITION_FULFILMENT: { label: 'Approved', icon: 'check_circle', tone: 'success' },
  OFFER: { label: 'Approved', icon: 'check_circle', tone: 'success' },
  ACCEPTED: { label: 'Approved', icon: 'check_circle', tone: 'success' },
  DISBURSED: { label: 'Approved', icon: 'check_circle', tone: 'success' },
  ACTIVE: { label: 'Approved', icon: 'check_circle', tone: 'success' },
  REJECTED: { label: 'Declined', icon: 'cancel', tone: 'danger' },
  WITHDRAWN: { label: 'Cancelled', icon: 'block', tone: 'neutral' },
  CLOSED: { label: 'Closed', icon: 'lock', tone: 'neutral' },
};

export function getApplicationStatusPresentation(state: string): ApplicationStatusPresentation {
  return STATUS_PRESENTATION[state] ?? { label: 'Open', icon: 'open_in_new', tone: 'neutral' };
}
