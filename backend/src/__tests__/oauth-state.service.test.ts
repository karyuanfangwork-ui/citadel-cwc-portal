import { createOAuthState, verifyOAuthState } from '../services/oauth-state.service';

describe('oauth-state.service', () => {
  it('round-trips a signed OAuth state payload', () => {
    const state = createOAuthState('user-1', 'GOOGLE', { now: 1_000, ttlMs: 60_000, nonce: 'nonce-1' });

    expect(verifyOAuthState(state, { now: 2_000 })).toEqual({
      userId: 'user-1',
      provider: 'GOOGLE',
    });
  });

  it('rejects tampered state payloads', () => {
    const state = createOAuthState('user-1', 'OUTLOOK', { now: 1_000, ttlMs: 60_000, nonce: 'nonce-1' });
    const [payload, signature] = state.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const tampered = `${Buffer.from(JSON.stringify({ ...decoded, userId: 'user-2' })).toString('base64url')}.${signature}`;

    expect(() => verifyOAuthState(tampered, { now: 2_000 })).toThrow('Invalid OAuth state');
  });

  it('rejects expired state payloads', () => {
    const state = createOAuthState('user-1', 'GOOGLE', { now: 1_000, ttlMs: 60_000, nonce: 'nonce-1' });

    expect(() => verifyOAuthState(state, { now: 62_000 })).toThrow('OAuth state expired');
  });
});
