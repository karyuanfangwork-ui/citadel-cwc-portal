/**
 * Redis Cache Utility
 *
 * Thin Redis wrapper with graceful fallback. If Redis is unavailable,
 * all operations return null/void silently so the application continues
 * working without caching.
 *
 * Uses lazy connection on first use (like sseClients pattern).
 */

import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

// ── Singleton Redis client for caching ──────────────────────────────────────
let redis: Redis | null = null;
let redisAvailable = false;
let connectAttempted = false;

/**
 * Lazily connect to Redis on first use.
 * If connection fails, log a warning and mark as unavailable.
 */
async function ensureConnection(): Promise<boolean> {
  if (connectAttempted) return redisAvailable;
  connectAttempted = true;

  try {
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) {
          // Stop retrying after 5 attempts
          return null;
        }
        return Math.min(times * 200, 5000);
      },
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      if (redisAvailable) {
        logger.warn('Cache: Redis connection error, caching disabled', { error: String(err) });
      }
      redisAvailable = false;
    });

    redis.on('ready', () => {
      redisAvailable = true;
    });

    await redis.connect();
    redisAvailable = true;
    logger.info('Cache: Redis client connected for caching');
  } catch (err) {
    logger.warn('Cache: Redis unavailable — caching disabled', { error: String(err) });
    redis = null;
    redisAvailable = false;
  }

  return redisAvailable;
}

// ── Cache operations ─────────────────────────────────────────────────────────

/**
 * Get a string value from Redis.
 * Returns null if Redis is unavailable or the key doesn't exist.
 */
export async function cacheGet(key: string): Promise<string | null> {
  if (!(await ensureConnection()) || !redis) return null;
  try {
    return await redis.get(key);
  } catch (err) {
    logger.warn('Cache: GET failed', { key, error: String(err) });
    return null;
  }
}

/**
 * Set a string value in Redis with TTL in seconds.
 * Silently fails if Redis is unavailable.
 */
export async function cacheSet(key: string, value: string, ttlSec: number): Promise<void> {
  if (!(await ensureConnection()) || !redis) return;
  try {
    await redis.set(key, value, 'EX', ttlSec);
  } catch (err) {
    logger.warn('Cache: SET failed', { key, error: String(err) });
  }
}

/**
 * Delete a key from Redis.
 * Silently fails if Redis is unavailable.
 */
export async function cacheDel(key: string): Promise<void> {
  if (!(await ensureConnection()) || !redis) return;
  try {
    await redis.del(key);
  } catch (err) {
    logger.warn('Cache: DEL failed', { key, error: String(err) });
  }
}

/**
 * Get a JSON-parsed value from Redis.
 * Returns null if Redis is unavailable, key doesn't exist, or parsing fails.
 */
export async function cacheGetJSON<T>(key: string): Promise<T | null> {
  const raw = await cacheGet(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.warn('Cache: JSON parse failed', { key, error: String(err) });
    return null;
  }
}

/**
 * Stringify a value and set it in Redis with TTL in seconds.
 * Silently fails if Redis is unavailable.
 */
export async function cacheSetJSON<T>(key: string, value: T, ttlSec: number): Promise<void> {
  try {
    const raw = JSON.stringify(value);
    await cacheSet(key, raw, ttlSec);
  } catch (err) {
    logger.warn('Cache: JSON stringify failed', { key, error: String(err) });
  }
}

/**
 * Close the cache Redis client.
 *
 * This client is created directly rather than through createRedisClient(), so
 * it is not in the shared client registry and closeAllRedisClients() cannot
 * reach it. Reset the lazy-connection state so the module remains reusable
 * after teardown.
 */
export async function closeCacheRedis(): Promise<void> {
  if (!redis) {
    connectAttempted = false;
    redisAvailable = false;
    return;
  }

  try {
    // disconnect() is unconditional and clears reconnect timers, unlike quit()
    // which can wait for a reply if Redis is already unreachable.
    redis.disconnect();
  } catch {
    /* already closed */
  }

  redis = null;
  redisAvailable = false;
  connectAttempted = false;
}