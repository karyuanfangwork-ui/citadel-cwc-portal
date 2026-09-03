import { getRequestStatusLabel } from '../requestStatusLabels';

describe('request status labels', () => {
  it('uses the governed Finance labels without technical suffixes', () => {
    expect(getRequestStatusLabel('PENDING_CEO_APPROVAL_FIN')).toBe('Pending CEO Approval (Finance)');
    expect(getRequestStatusLabel('AWAITING_PAYMENT_CONFIRMATION')).toBe('Awaiting Payment Confirmation');
    expect(getRequestStatusLabel('TICKET_CLOSED_FIN')).toBe('Closed');
  });

  it('preserves an administrator-readable fallback for unknown codes', () => {
    expect(getRequestStatusLabel('NEW_CUSTOM_STATUS')).toBe('New Custom Status');
  });
});
