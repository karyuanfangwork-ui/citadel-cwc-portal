/**
 * Unit tests for permission.service.ts
 *
 * Challenge: permission.service.ts creates `new Redis()` and `new PrismaClient()`
 * at module scope. We mock both ioredis and @prisma/client at the factory level.
 * The mock PrismaClient returns our controlled mock instance.
 */

// ── Mock ioredis with a shared store ────────────────────────────────────────
const redisStore = new Map<string, string>();

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
    get: jest.fn(async (key: string) => redisStore.get(key) ?? null),
    set: jest.fn(async (key: string, val: string) => { redisStore.set(key, val); return 'OK'; }),
    setex: jest.fn(async (key: string, _ttl: number, val: string) => {
      redisStore.set(key, val);
      return 'OK';
    }),
    del: jest.fn(async (...keys: string[]) => {
      keys.forEach((k) => redisStore.delete(k));
      return keys.length;
    }),
    keys: jest.fn(async (pattern: string) => {
      const prefix = pattern.replace('*', '');
      return Array.from(redisStore.keys()).filter((k) => k.startsWith(prefix));
    }),
    exists: jest.fn(async (key: string) => (redisStore.has(key) ? 1 : 0)),
    incr: jest.fn(async (key: string) => {
      const v = parseInt(redisStore.get(key) || '0', 10) + 1;
      redisStore.set(key, String(v));
      return v;
    }),
    pipeline: jest.fn(() => ({
      setex: jest.fn().mockReturnThis(),
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

// ── Mock PrismaClient ───────────────────────────────────────────────────────
const mockUserFindUnique = jest.fn();

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      user: { findUnique: mockUserFindUnique },
    })),
  };
});

jest.mock('../../utils/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

// Import AFTER mocks are set up
import { getUserPermissions, hasPermission, checkPermission, invalidateUserPermissionsCache } from '../permission.service';

beforeEach(() => {
  jest.clearAllMocks();
  redisStore.clear();
});

// ── getUserPermissions ────────────────────────────────────────────────────

describe('getUserPermissions', () => {
  it('returns cached permissions from Redis when available', async () => {
    // Pre-populate Redis store
    redisStore.set('rbac:perms:user-cached', JSON.stringify(['request:read', 'request:create']));

    const result = await getUserPermissions('user-cached');

    // Should return cached data without hitting Prisma
    expect(result).toEqual(['request:read', 'request:create']);
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it('queries DB and caches when Redis cache is empty', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      roles: [
        {
          role: {
            permissions: [
              { permission: { name: 'request:create' } },
              { permission: { name: 'request:read' } },
            ],
          },
        },
      ],
    });

    const result = await getUserPermissions('user-1');

    expect(result).toContain('request:create');
    expect(result).toContain('request:read');
    expect(mockUserFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
    // Should have cached the result
    const cached = redisStore.get('rbac:perms:user-1');
    expect(cached).toBeTruthy();
    expect(JSON.parse(cached!)).toContain('request:create');
  });

  it('returns empty array for non-existent user', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const result = await getUserPermissions('nonexistent-user');

    expect(result).toEqual([]);
  });

  it('deduplicates permission names across multiple roles', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'user-2',
      roles: [
        {
          role: {
            permissions: [
              { permission: { name: 'request:create' } },
              { permission: { name: 'request:read' } },
            ],
          },
        },
        {
          role: {
            permissions: [
              { permission: { name: 'request:read' } },
              { permission: { name: 'admin:access' } },
            ],
          },
        },
      ],
    });

    const result = await getUserPermissions('user-2');

    expect(result).toContain('request:create');
    expect(result).toContain('request:read');
    expect(result).toContain('admin:access');
    expect(result.filter((p) => p === 'request:read')).toHaveLength(1);
  });

  it('returns empty array for user with no roles', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'user-3',
      roles: [],
    });

    const result = await getUserPermissions('user-3');

    expect(result).toEqual([]);
  });
});

// ── hasPermission ──────────────────────────────────────────────────────────

describe('hasPermission', () => {
  it('returns true when user has the permission', async () => {
    // Pre-seed Redis cache
    redisStore.set('rbac:perms:user-p1', JSON.stringify(['request:create', 'request:read']));

    const result = await hasPermission('user-p1', 'request:create');

    expect(result).toBe(true);
  });

  it('returns false when user does not have the permission', async () => {
    redisStore.set('rbac:perms:user-p2', JSON.stringify(['request:read']));

    const result = await hasPermission('user-p2', 'request:delete');

    expect(result).toBe(false);
  });
});

// ── checkPermission ────────────────────────────────────────────────────────

describe('checkPermission', () => {
  it('resolves resource:action format and returns true', async () => {
    redisStore.set('rbac:perms:user-cp1', JSON.stringify(['admin:settings']));

    const result = await checkPermission('user-cp1', 'admin', 'settings');

    expect(result).toBe(true);
  });

  it('returns false for resource:action not in user permissions', async () => {
    redisStore.set('rbac:perms:user-cp2', JSON.stringify(['request:read']));

    const result = await checkPermission('user-cp2', 'admin', 'delete');

    expect(result).toBe(false);
  });
});

// ── invalidateUserPermissionsCache ──────────────────────────────────────────

describe('invalidateUserPermissionsCache', () => {
  it('removes cached permissions for a user', async () => {
    // Seed cache
    redisStore.set('rbac:perms:user-del', JSON.stringify(['test:perm']));
    expect(redisStore.has('rbac:perms:user-del')).toBe(true);

    await invalidateUserPermissionsCache('user-del');

    expect(redisStore.has('rbac:perms:user-del')).toBe(false);
  });

  it('does not throw when key does not exist', async () => {
    await expect(invalidateUserPermissionsCache('nonexistent-user')).resolves.toBeUndefined();
  });
});