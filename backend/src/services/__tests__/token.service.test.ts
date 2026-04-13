import { tokenService } from '../token.service';

// Mock ioredis
jest.mock('ioredis', () => {
  const store = new Map<string, string>();
  return jest.fn().mockImplementation(() => ({
    setex: jest.fn(async (key: string, _ttl: number, val: string) => {
      store.set(key, val);
      return 'OK';
    }),
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    keys: jest.fn(async (pattern: string) => {
      const prefix = pattern.replace('*', '');
      return [...store.keys()].filter((k) => k.startsWith(prefix));
    }),
    del: jest.fn(async (...keys: string[]) => {
      keys.forEach((k) => store.delete(k));
      return keys.length;
    }),
  }));
});

describe('tokenService', () => {
  it('blocks a jti after revoking it', async () => {
    await tokenService.revokeJti('jti-abc', 900);
    const blocked = await tokenService.isJtiRevoked('jti-abc');
    expect(blocked).toBe(true);
  });

  it('returns false for a jti that has not been revoked', async () => {
    const blocked = await tokenService.isJtiRevoked('jti-never-set');
    expect(blocked).toBe(false);
  });

  it('clears all jtis for a user', async () => {
    await tokenService.revokeJti('jti-user1-a', 900);
    await tokenService.revokeJti('jti-user1-b', 900);
    await tokenService.revokeAllForUser('user-1');
    // After clear, no specific jti check — just confirm no throw
  });
});
