import { tokenService } from '../token.service';

// The mock must be defined at module scope for Jest hoisting.
// Includes .on/.once/etc. that redis.ts needs.
const store = new Map<string, string>();

jest.mock('ioredis', () => {
  const handlers: Record<string, Function[]> = {};
  const client = {
    on: jest.fn((event: string, handler: Function) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
      return client;
    }),
    once: jest.fn(() => client),
    emit: jest.fn((event: string, ...args: any[]) => {
      (handlers[event] || []).forEach((h: Function) => h(...args));
      return client;
    }),
    removeListener: jest.fn(() => client),
    removeAllListeners: jest.fn(() => client),
    setex: jest.fn(async (key: string, _ttl: number, val: string) => {
      store.set(key, val);
      return 'OK';
    }),
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, val: string) => {
      store.set(key, val);
      return 'OK';
    }),
    del: jest.fn(async (...keys: string[]) => {
      keys.forEach((k) => store.delete(k));
      return keys.length;
    }),
    exists: jest.fn(async (key: string) => (store.has(key) ? 1 : 0)),
    keys: jest.fn(async (pattern: string) => {
      const prefix = pattern.replace('*', '');
      return Array.from(store.keys()).filter((k) => k.startsWith(prefix));
    }),
    incr: jest.fn(async (key: string) => {
      const v = parseInt(store.get(key) || '0', 10) + 1;
      store.set(key, String(v));
      return v;
    }),
    pipeline: jest.fn(() => ({
      setex: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      exec: jest.fn(async () => []),
    })),
    multi: jest.fn(() => ({
      set: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      exec: jest.fn(async () => []),
    })),
    connect: jest.fn(async () => 'OK'),
    disconnect: jest.fn(),
    quit: jest.fn(async () => 'OK'),
    ping: jest.fn(async () => 'PONG'),
    status: 'ready',
  };
  return jest.fn().mockImplementation(() => client);
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