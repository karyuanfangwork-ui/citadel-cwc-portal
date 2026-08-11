import { describe, expect, it } from '@jest/globals';
import { maskEmail, maskPhone, maskPrimaryContact } from '../maskContact';

describe('operational borrower contact masking', () => {
  it('masks phone values while retaining only the last four digits', () => {
    expect(maskPhone('+60 12-345 6789')).toBe('*******6789');
  });

  it('masks email local parts but preserves the domain for operational routing', () => {
    expect(maskEmail('alice@example.com')).toBe('a***@example.com');
  });

  it('prefers masked phone and falls back to masked email', () => {
    expect(maskPrimaryContact('+60123456789', 'alice@example.com')).toBe('*******6789');
    expect(maskPrimaryContact(null, 'alice@example.com')).toBe('a***@example.com');
  });
});
