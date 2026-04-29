import { describe, it, expect } from 'vitest';
import { tokenManager } from '../tokenManager';

describe('tokenManager', () => {
  it('getAccessToken returns null (deprecated)', () => {
    expect(tokenManager.getAccessToken()).toBeNull();
  });

  it('getRefreshToken returns null (deprecated)', () => {
    expect(tokenManager.getRefreshToken()).toBeNull();
  });

  it('setTokens is a no-op (does not throw)', () => {
    expect(() => tokenManager.setTokens('access', 'refresh')).not.toThrow();
  });

  it('clearTokens is a no-op (does not throw)', () => {
    expect(() => tokenManager.clearTokens()).not.toThrow();
  });

  it('isTokenExpired returns false (enforced server-side)', () => {
    expect(tokenManager.isTokenExpired('any-token')).toBe(false);
  });

  it('setTokens does not make getAccessToken return a value', () => {
    tokenManager.setTokens('abc', 'def');
    expect(tokenManager.getAccessToken()).toBeNull();
    expect(tokenManager.getRefreshToken()).toBeNull();
  });
});