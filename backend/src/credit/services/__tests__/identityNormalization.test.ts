// LOS-017 — Canonical identity normalization for duplicate matching
import { normalizeIdentity, MIN_IDENTITY_LENGTH } from '../../utils/identityNormalization';

describe('LOS-017 — normalizeIdentity', () => {
  it('collapses separator and case variants of one NRIC to one value', () => {
    const forms = ['880101-14-5523', '880101145523', '880101 14 5523', '880101/14/5523'];
    const normalized = forms.map(normalizeIdentity);
    expect(new Set(normalized).size).toBe(1);
    expect(normalized[0]).toBe('880101145523');
  });

  it('upper-cases alphanumeric identifiers', () => {
    expect(normalizeIdentity('a1234567b')).toBe('A1234567B');
    expect(normalizeIdentity('202301012345 (1234567-X)')).toBe('2023010123451234567X');
  });

  it('returns null for empty, whitespace or missing input', () => {
    expect(normalizeIdentity(null)).toBeNull();
    expect(normalizeIdentity(undefined)).toBeNull();
    expect(normalizeIdentity('')).toBeNull();
    expect(normalizeIdentity('   ')).toBeNull();
    expect(normalizeIdentity('---')).toBeNull();
  });

  it('returns null below the minimum length so short junk never matches', () => {
    expect(MIN_IDENTITY_LENGTH).toBe(6);
    expect(normalizeIdentity('12345')).toBeNull();
    expect(normalizeIdentity('123456')).toBe('123456');
  });
});