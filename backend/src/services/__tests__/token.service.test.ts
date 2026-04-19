import { tokenService } from '../token.service';

const store = new Map<string, string>();

jest.mock('ioredis', () => {
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

beforeEach(() => store.clear());

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

  it('revokeAllForUser sets a revocation timestamp', async () => {
    const before = Date.now();
    await tokenService.revokeAllForUser('user-1');
    const ts = await tokenService.getUserRevocationTimestamp('user-1');
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(Date.now());
  });

  it('getUserRevocationTimestamp returns 0 for unknown user', async () => {
    const ts = await tokenService.getUserRevocationTimestamp('user-unknown');
    expect(ts).toBe(0);
  });
});
