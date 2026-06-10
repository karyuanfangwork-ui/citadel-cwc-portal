import { maskNric } from '../../utils/maskNric';

describe('maskNric', () => {
  it('masks NRIC returning last 4 chars only', () => {
    expect(maskNric('S1234567A')).toBe('****567A');
  });

  it('masks short values as ****', () => {
    expect(maskNric('AB')).toBe('****');
  });

  it('masks 4-char values as ****', () => {
    expect(maskNric('1234')).toBe('****');
  });

  it('returns null for null input', () => {
    expect(maskNric(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(maskNric(undefined as any)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(maskNric('')).toBeNull();
  });
});