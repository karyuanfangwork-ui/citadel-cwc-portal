/**
 * Unit tests for sseClients.ts — SSE Client Registry with Redis Pub/Sub Adapter
 *
 * Redis pub/sub is mocked at the ioredis level. We verify:
 * 1. Client add/remove (local registry)
 * 2. deliverLocal (actual SSE writes)
 * 3. pushToUser / broadcast fan-out via Redis publish
 * 4. Fallback to local delivery when Redis is unavailable
 * 5. broadcast message routing (__broadcast__ marker)
 */

jest.mock('ioredis', () => {
  const mockSubscriber = {
    on: jest.fn(),
    subscribe: jest.fn(() => Promise.resolve()),
    disconnect: jest.fn(),
    connect: jest.fn(() => Promise.resolve()),
  };
  const mockPublisher = {
    publish: jest.fn(() => Promise.resolve(1)),
    disconnect: jest.fn(),
    connect: jest.fn(() => Promise.resolve()),
  };

  (globalThis as any).__mockSubscriber = mockSubscriber;
  (globalThis as any).__mockPublisher = mockPublisher;

  return jest.fn().mockImplementation(() => {
    if (!(globalThis as any).__publisherCreated) {
      (globalThis as any).__publisherCreated = true;
      return mockPublisher;
    }
    (globalThis as any).__publisherCreated = false;
    return mockSubscriber;
  });
});

jest.mock('../../config', () => ({
  config: {
    redis: { url: 'redis://localhost:6379' },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import {
  addClient,
  removeClient,
  pushToUser,
  broadcast,
  deliverLocal,
  initSseRedis,
  disconnectSseRedis,
  getClientCount,
  getActiveUserCount,
  isRedisConnected,
} from '../sseClients';

// Helper: create a mock Express Response object
function mockResponse(): any {
  return { write: jest.fn() };
}

// Track clients we create in tests so we can clean up
const testClients: Array<{ userId: string; res: any }> = [];

function addTestClient(userId: string, res?: any): any {
  if (!res) res = mockResponse();
  addClient(userId, res);
  testClients.push({ userId, res });
  return res;
}

afterEach(() => {
  // Clean up all test clients from the module-scoped registry
  for (const { userId, res } of testClients) {
    removeClient(userId, res);
  }
  testClients.length = 0;
  jest.clearAllMocks();
  (globalThis as any).__publisherCreated = false;
});

describe('sseClients', () => {
  // ── Client Management ────────────────────────────────────────────────────

  describe('addClient / removeClient', () => {
    it('registers and counts a client', () => {
      addTestClient('user-1');
      expect(getClientCount()).toBe(1);
      expect(getActiveUserCount()).toBe(1);
    });

    it('registers multiple tabs for the same user', () => {
      addTestClient('user-1');
      addTestClient('user-1');
      expect(getClientCount()).toBe(2);
      expect(getActiveUserCount()).toBe(1);
    });

    it('removes a client and cleans up empty user sets', () => {
      const res = mockResponse();
      addClient('user-1', res);
      removeClient('user-1', res);
      expect(getClientCount()).toBe(0);
      expect(getActiveUserCount()).toBe(0);
    });

    it('removing non-existent client is a no-op', () => {
      expect(() => removeClient('no-user', mockResponse())).not.toThrow();
    });
  });

  // ── Local Delivery ───────────────────────────────────────────────────────

  describe('deliverLocal', () => {
    it('writes SSE payload to all connections for a user', () => {
      const res1 = addTestClient('user-dl');
      const res2 = addTestClient('user-dl');

      deliverLocal('user-dl', 'notification', { title: 'Test' });

      const expectedPayload = `event: notification\ndata: {"title":"Test"}\n\n`;
      expect(res1.write).toHaveBeenCalledWith(expectedPayload);
      expect(res2.write).toHaveBeenCalledWith(expectedPayload);
    });

    it('is a no-op when user has no connections', () => {
      expect(() => deliverLocal('no-user', 'notification', {})).not.toThrow();
    });

    it('cleans up disconnected clients on write failure', () => {
      const res1 = mockResponse();
      const res2 = mockResponse();
      // res1.write throws (simulating disconnect)
      res1.write.mockImplementation(() => { throw new Error('write EPIPE'); });

      addClient('user-epipe', res1);
      addClient('user-epipe', res2);
      testClients.push({ userId: 'user-epipe', res: res1 });
      testClients.push({ userId: 'user-epipe', res: res2 });

      deliverLocal('user-epipe', 'notification', { msg: 'test' });

      // res1 should have been removed (disconnected), res2 still works
      expect(getClientCount()).toBe(1);
      expect(res2.write).toHaveBeenCalled();
    });

    it('broadcast message marker (__broadcast__) triggers broadcastLocal', () => {
      const res = addTestClient('user-bcast');
      deliverLocal('__broadcast__', 'announcement', { msg: 'system' });
      expect(res.write).toHaveBeenCalled();
    });
  });

  // ── pushToUser (without Redis — single-instance fallback) ────────────────

  describe('pushToUser (single-instance fallback)', () => {
    it('delivers locally when Redis is not initialized', () => {
      const res = addTestClient('user-push');
      pushToUser('user-push', 'notification', { title: 'Hello' });
      expect(res.write).toHaveBeenCalledWith(
        `event: notification\ndata: {"title":"Hello"}\n\n`
      );
    });
  });

  // ── pushToUser (with Redis enabled) ───────────────────────────────────────

  describe('pushToUser (Redis enabled)', () => {
    it('publishes to Redis channel when Redis is connected', async () => {
      initSseRedis();
      await new Promise((r) => setTimeout(r, 50));

      pushToUser('user-rpush', 'notification', { title: 'Redis' });

      const pub = (globalThis as any).__mockPublisher;
      expect(pub.publish).toHaveBeenCalledWith(
        'cwc:sse:notify',
        JSON.stringify({ userId: 'user-rpush', event: 'notification', data: { title: 'Redis' } })
      );

      disconnectSseRedis();
    });
  });

  // ── broadcast (without Redis — single-instance fallback) ────────────────

  describe('broadcast (single-instance fallback)', () => {
    it('delivers to all local clients when Redis is not initialized', () => {
      const res1 = addTestClient('user-ba');
      const res2 = addTestClient('user-bb');

      broadcast('system', { message: 'Maintenance' });

      expect(res1.write).toHaveBeenCalled();
      expect(res2.write).toHaveBeenCalled();
    });
  });

  // ── initSseRedis / disconnectSseRedis ─────────────────────────────────────

  describe('initSseRedis', () => {
    it('initializes without throwing', () => {
      expect(() => initSseRedis()).not.toThrow();
    });

    it('disconnectSseRedis cleans up without throwing', () => {
      initSseRedis();
      expect(() => disconnectSseRedis()).not.toThrow();
      expect(isRedisConnected()).toBe(false);
    });

    it('subscriber listens to the SSE channel', async () => {
      initSseRedis();
      // The subscribe call happens after lazy connect resolves — give it a tick
      await new Promise((r) => setTimeout(r, 50));
      const sub = (globalThis as any).__mockSubscriber;
      expect(sub.subscribe).toHaveBeenCalledWith('cwc:sse:notify');
      expect(sub.on).toHaveBeenCalledWith('message', expect.any(Function));
      disconnectSseRedis();
    });
  });

  // ── Monitoring helpers ───────────────────────────────────────────────────

  describe('getClientCount / getActiveUserCount', () => {
    it('returns 0 when no clients connected', () => {
      expect(getClientCount()).toBe(0);
      expect(getActiveUserCount()).toBe(0);
    });

    it('tracks multiple users correctly', () => {
      addTestClient('u1');
      addTestClient('u2');
      addTestClient('u2');

      expect(getActiveUserCount()).toBe(2);
      expect(getClientCount()).toBe(3);
    });
  });
});