/**
 * Shared Redis mock for Jest unit tests.
 *
 * Provides a minimal ioredis-compatible mock that includes:
 * - Basic key operations (setex, get, keys, del, exists, set, expire, ttl)
 * - Event emitter methods (.on, .once) as no-ops
 * - Pipeline/discard support for transaction patterns
 * - Disconnect/connect for lifecycle management
 *
 * Usage in tests:
 *   jest.mock('ioredis', () => require('../__tests__/mocks/ioredis-mock'));
 *
 * Or per-test:
 *   jest.mock('ioredis', () => {
 *     const { createRedisMock } = require('../__tests__/mocks/ioredis-mock');
 *     return { default: jest.fn().mockImplementation(createRedisMock) };
 *   });
 */

type RedisCallback = (...args: any[]) => any;

export function createRedisMock() {
  const store = new Map<string, string>();
  const handlers: Record<string, RedisCallback[]> = {};

  const client = {
    store,

    on: jest.fn((event: string, handler: RedisCallback) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
      return client;
    }),
    once: jest.fn((event: string, handler: RedisCallback) => {
      return client;
    }),
    emit: jest.fn((event: string, ...args: any[]) => {
      (handlers[event] || []).forEach((h) => h(...args));
      return client;
    }),
    removeListener: jest.fn(() => client),
    removeAllListeners: jest.fn(() => client),

    setex: jest.fn(async (key: string, ttl: number, val: string) => {
      store.set(key, val);
      return 'OK';
    }),
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, val: string, ...args: any[]) => {
      store.set(key, val);
      return 'OK';
    }),
    del: jest.fn(async (...keys: string[]) => {
      keys.forEach((k) => store.delete(k));
      return keys.length;
    }),
    exists: jest.fn(async (key: string) => (store.has(key) ? 1 : 0)),
    expire: jest.fn(async (_key: string, _seconds: number) => 1),
    ttl: jest.fn(async (_key: string) => -1),
    incr: jest.fn(async (key: string) => {
      const v = parseInt(store.get(key) || '0', 10) + 1;
      store.set(key, String(v));
      return v;
    }),
    decr: jest.fn(async (key: string) => {
      const v = parseInt(store.get(key) || '0', 10) - 1;
      store.set(key, String(v));
      return v;
    }),
    keys: jest.fn(async (pattern: string) => {
      const prefix = pattern.replace('*', '');
      return [...store.keys()].filter((k) => k.startsWith(prefix));
    }),
    hset: jest.fn(async (_key: string, ..._args: any[]) => 1),
    hget: jest.fn(async (_key: string, _field: string) => null),
    hgetall: jest.fn(async (_key: string) => ({})),
    hdel: jest.fn(async (_key: string, ..._fields: string[]) => 0),
    sadd: jest.fn(async (_key: string, ..._members: string[]) => 0),
    srem: jest.fn(async (_key: string, ..._members: string[]) => 0),
    smembers: jest.fn(async (_key: string) => []),
    sismember: jest.fn(async (_key: string, _member: string) => 0),

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

    connect: jest.fn(async () => {
      if (handlers['connect']) handlers['connect'].forEach((h) => h());
      if (handlers['ready']) handlers['ready'].forEach((h) => h());
      return 'OK';
    }),
    disconnect: jest.fn(),
    quit: jest.fn(async () => 'OK'),
    ping: jest.fn(async () => 'PONG'),

    status: 'ready',
  };

  return client;
}

/**
 * Default export: a jest.mock-compatible factory function.
 *
 * Usage:
 *   jest.mock('ioredis', () => jest.fn().mockImplementation(() => require('../__tests__/mocks/ioredis-mock').createRedisMock()));
 */
export default jest.fn().mockImplementation(createRedisMock);