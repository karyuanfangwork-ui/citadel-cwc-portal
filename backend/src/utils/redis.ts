/**
 * Shared Redis Connection Factory
 *
 * All ioredis clients MUST be created through this factory to avoid the
 * Docker startup race condition where the backend container starts before
 * the Redis container's DNS hostname is resolvable.
 *
 * Problem: `new Redis(config.redis.url)` connects eagerly. If the `redis`
 * Docker hostname isn't resolvable yet, ioredis silently falls back to
 * `127.0.0.1:6379` and spams `ECONNREFUSED` errors on every retry.
 *
 * Solution: Use `lazyConnect: true` + explicit `.connect()` with retry,
 * so the first real connection attempt happens after DNS is ready.
 * The `retryStrategy` ensures transient failures don't kill the process.
 */

import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

/** Common ioredis options for resilient connections */
const COMMON_OPTS = {
  maxRetriesPerRequest: 3 as const,
  retryStrategy(times: number): number | null {
    if (times > 10) {
      // Give up after 10 retries (~17s with backoff)
      logger.warn(`Redis: giving up after ${times} connection attempts`);
      return null;
    }
    return Math.min(times * 200, 5000);
  },
  lazyConnect: true as const,
};

/**
 * Create a resilient Redis client that survives the Docker startup race.
 *
 * Usage:
 *   const redis = createRedisClient();                              // default opts
 *   const redis = createRedisClient({ maxRetriesPerRequest: null }); // for BullMQ
 */
/**
 * Every client this factory hands out.
 *
 * Nine modules call createRedisClient() at import time and none of them export
 * the result, so before this registry existed there was no way to close them.
 * Combined with a retryStrategy that retries forever, that kept the Node event
 * loop alive: `npx jest src/credit` passed 1256 tests in 7.1 seconds and then
 * hung for 1h40m until it was killed by hand. `npm run test:release` ends in
 * `&& npm test`, so the release gate never returned.
 */
const activeClients = new Set<Redis>();

/**
 * Close every client this factory created. Intended for test teardown and
 * graceful shutdown — not for request paths.
 */
export async function closeAllRedisClients(): Promise<void> {
  // Module-level clients can finish initialization on a later event-loop turn.
  // Drain a few turns so those late clients are closed in the same teardown.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const clients = [...activeClients];
    activeClients.clear();
    await Promise.all(
      clients.map(async (client) => {
        try {
          // quit() waits for a reply, which never arrives if Redis is unreachable.
          // disconnect() is unconditional and clears the reconnect timer.
          client.disconnect();
        } catch {
          /* already closed */
        }
      }),
    );
    if (activeClients.size === 0) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

export function createRedisClient(opts?: Record<string, any>): Redis {
  const options = { ...COMMON_OPTS, ...opts };
  const client = new Redis(config.redis.url, options);

  client.on('error', (err) => {
    const msg = String(err);
    // Suppress ECONNREFUSED noise — retryStrategy handles reconnection
    if (msg.includes('ECONNREFUSED')) return;
    logger.warn('Redis client error', { error: msg });
  });

  client.on('ready', () => {
    logger.info('Redis client connected');
  });

  activeClients.add(client);

  return client;
}

/**
 * Ensure a Redis client is connected before first use.
 * Safe to call multiple times (idempotent).
 */
export async function ensureConnected(client: Redis): Promise<void> {
  if (client.status === 'ready') return;
  try {
    await client.connect();
  } catch {
    // Already connecting or connected — that's fine
  }
}

/**
 * Parse config.redis.url into { host, port, password } for BullMQ's
 * `connection` option which doesn't accept a URL string.
 */
export function getRedisConnectionConfig() {
  const url = new URL(config.redis.url);
  return {
    host: url.hostname || 'localhost',
    port: Number(url.port) || 6379,
    password: url.password || undefined,
  };
}