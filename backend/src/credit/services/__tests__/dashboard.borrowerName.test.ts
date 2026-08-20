/** Regression coverage for dashboard borrower display-name resolution. */
import { resolveBorrowerName } from '../dashboard.service';

describe('resolveBorrowerName', () => {
  it('prefers the linked account name', () => {
    expect(resolveBorrowerName(
      { name: 'Legacy Name', account: { name: 'Lyra Manufacturing Sdn Bhd' }, contact: null },
      'CA-2026-00016',
    )).toBe('Lyra Manufacturing Sdn Bhd');
  });

  it('falls back to the contact full name for individuals', () => {
    expect(resolveBorrowerName(
      { name: null, account: null, contact: { firstName: 'Aisha', lastName: 'Rahman' } },
      'CA-2026-00017',
    )).toBe('Aisha Rahman');
  });

  it('falls back to the authoritative name when no account or contact is linked', () => {
    expect(resolveBorrowerName({ name: 'Sole Trader Co', account: null, contact: null }, 'CA-1'))
      .toBe('Sole Trader Co');
  });

  it('never returns "Unknown" when the profile is missing entirely', () => {
    expect(resolveBorrowerName(null, 'CA-2026-00015')).toBe('Borrower CA-2026-00015');
  });

  it('never returns "Unknown" when every name field is blank', () => {
    expect(resolveBorrowerName(
      { name: '', account: { name: '' }, contact: { firstName: '', lastName: '' } },
      'CA-2026-00014',
    )).toBe('Borrower CA-2026-00014');
  });
});
