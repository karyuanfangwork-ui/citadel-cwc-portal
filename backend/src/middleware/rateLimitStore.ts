/**
 * P1-05 to P1-08: Redis-backed rate limiting store
 *
 * Replaces the default in-memory store with a Redis-backed store so that
 * rate-limit counters are shared across multiple API instances in production.
 *
 * Design:
 * - Uses the shared Redis connection factory (utils/redis.ts).
 * - Auth/password-reset limiters fail CLOSED (deny requests) when Redis is
 *   unavailable — safe default for security-sensitive endpoints.
 * - General API limiters fail OPEN (allow requests) when Redis is down —
 *   avoids total outage from a Redis blip.
 * - A single Redis client instance is lazily created and reused.
 * - Enabled via RATE_LIMIT_REDIS_ENABLED=true in environment.
 */

import RedisStore from 'rate-limit-redis';
import { createRedisClient, ensureConnected } from '../utils/redis';
import { config } from '../config';
import { logger } from '../utils/logger';

let _rateLimitRedisClient: ReturnType<typeof createRedisClient> | null = null;

/**
 * Get or create the singleton Redis client for rate limiting.
 * Lazily connects so the server starts even if Redis is unavailable.
 */
function getRateLimitRedisClient() {
    if (!_rateLimitRedisClient) {
        _rateLimitRedisClient = createRedisClient();
    }
    return _rateLimitRedisClient;
}

export interface RedisStoreOptions {
    /** Prefix for Redis keys. Defaults to 'rl:'. */
    prefix?: string;
}

/**
 * Create a Redis-backed store for express-rate-limit.
 *
 * Returns `undefined` when RATE_LIMIT_REDIS_ENABLED is not 'true',
 * so express-rate-limit falls back to its default in-memory store.
 */
export function createRedisRateLimitStore(opts: RedisStoreOptions = {}) {
    // Config toggle: Redis rate limiting must be explicitly enabled.
    if (!config.rateLimit.redisEnabled) {
        logger.info('Rate limiting: using in-memory store (RATE_LIMIT_REDIS_ENABLED not set)');
        return undefined;
    }

    const { prefix = 'rl:' } = opts;
    const client = getRateLimitRedisClient();

    // Ensure Redis is reachable before returning the store.
    ensureConnected(client)
        .then(() => {
            logger.info('Rate limiting: Redis store connected', { prefix });
        })
        .catch((err) => {
            logger.error('Rate limiting: Redis connection failed — falling back to in-memory', { error: String(err) });
        });

    // rate-limit-redis v4: sendCommand takes raw Redis command name + args as
    // strings and returns a Promise<RedisReply>. ioredis.call() has a matching
    // runtime signature but different TypeScript overloads.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendCommand = (...args: string[]): Promise<any> => client.call(...args as [string, ...string[]]) as Promise<any>;

    return new RedisStore({
        sendCommand,
        prefix,
        resetExpiryOnChange: true,
    });
}