const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING_CEO_APPROVAL_FIN: 'Pending CEO Approval (Finance)',
  PENDING_CFO_APPROVAL_FIN: 'Pending CFO Approval (Finance)',
  PENDING_GROUP_DCEO_APPROVAL: 'Pending Group DCEO Approval',
  PAYMENT_PROCESSING_FIN: 'Payment Processing',
  AWAITING_PAYMENT_CONFIRMATION: 'Awaiting Payment Confirmation',
  PAYMENT_CONFIRMED_FIN: 'Payment Confirmed',
  TICKET_CLOSED_FIN: 'Closed',
  CEO_APPROVED_FIN: 'CEO Approved (Finance)',
  CEO_REJECTED_FIN: 'CEO Rejected (Finance)',
  CFO_APPROVED_FIN: 'CFO Approved (Finance)',
  CFO_REJECTED_FIN: 'CFO Rejected (Finance)',
  FINANCE_ACKNOWLEDGED: 'Finance Acknowledged',
  FINANCE_IN_PROGRESS: 'Finance In Progress',
};

const fallbackStatusLabel = (code: string): string => code
  .replace(/_/g, ' ')
  .toLowerCase()
  .replace(/\b\w/g, (character) => character.toUpperCase());

export function getRequestStatusLabel(code: string): string {
  return REQUEST_STATUS_LABELS[code] ?? fallbackStatusLabel(code);
}

export { REQUEST_STATUS_LABELS };
