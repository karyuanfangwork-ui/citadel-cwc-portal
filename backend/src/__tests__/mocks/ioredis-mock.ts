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
 *   jest.mock('ioredis', () => {
 *     const { createRedisMock } = require('../__tests__/mocks/ioredis-mock');
 *     return { default: jest.fn().mockImplementation(createRedisMock), __esModule: true };
 *   });
 */

type RedisCallback = (...args: any[]) => any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createRedisMock(): Record<string, any> {
    const store = new Map<string, string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers: Record<string, any[]> = {};
    let client: Record<string, any>;

    const on: jest.Mock = jest.fn((_event: string, _handler: RedisCallback): Record<string, any> => {
        return client;
    });
    const once: jest.Mock = jest.fn((): Record<string, any> => client);

    client = {
        on,
        once,
        emit: jest.fn((event: string, ...args: any[]) => {
            (handlers[event] || []).forEach((h: RedisCallback) => h(...args));
            return client;
        }),
        removeListener: jest.fn(() => client),
        removeAllListeners: jest.fn(() => client),

        setex: jest.fn(async (key: string, _ttl: number, val: string) => {
            store.set(key, val);
            return 'OK';
        }),
        get: jest.fn(async (key: string) => store.get(key) ?? null),
        set: jest.fn(async (key: string, val: string, ..._args: any[]) => {
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
            return Array.from(store.keys()).filter((k) => k.startsWith(prefix));
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

        connect: jest.fn(async () => 'OK'),
        disconnect: jest.fn(),
        quit: jest.fn(async () => 'OK'),
        ping: jest.fn(async () => 'PONG'),

        status: 'ready',
        store,
    };

    return client;
}