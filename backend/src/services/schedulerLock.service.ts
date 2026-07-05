/**
 * P3-05: Scheduler distributed lock via Redis
 *
 * When multiple backend instances are running (horizontal scaling),
 * each in-process scheduler fires the same cron/interval jobs simultaneously,
 * causing duplicate work (duplicate SLA checks, duplicate CRM reminders, etc.).
 *
 * This module provides `acquireLock(key, ttlMs)` which uses a Redis SETNX
 * with expiry. Only the instance that acquires the lock executes the job;
 * others skip it.
 *
 * Fallback: if Redis is unavailable, jobs run on every instance (degraded
 * singleton mode is disabled). Set SCHEDULER_SINGLETON_MODE=true to force
 * singleton behavior — in that mode, if Redis is down, the job is SKIPPED
 * rather than running on all instances.
 *
 * Usage in job runners:
 *   const lock = await acquireLock('sla-checker', 60_000);
 *   if (!lock.acquired) return; // another instance is running it
 *   try { await doWork(); } finally { await releaseLock(lock); }
 */

import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

const LOCK_PREFIX = 'scheduler:lock:';
const DEFAULT_TTL_MS = 120_000; // 2 minutes — generous for job runtime

let redisClient: Redis | null = null;

/**
 * Lazily create a dedicated Redis client for scheduler locks.
 * Separate from the main Redis connection pool so lock contention
 * doesn't affect rate limiting or SSE pub/sub.
 */
async function getLockClient(): Promise<Redis> {
    if (redisClient && redisClient.status === 'ready') return redisClient;

    const client = new Redis(config.redis.url, {
        maxRetriesPerRequest: 3,
        retryStrategy(times: number): number | null {
            if (times > 5) return null; // give up after 5 retries
            return Math.min(times * 200, 3000);
        },
        lazyConnect: true,
    });

    client.on('error', (err) => {
        const msg = String(err);
        if (!msg.includes('ECONNREFUSED')) {
            logger.warn('[SchedulerLock] Redis error', { error: msg });
        }
    });

    client.on('ready', () => {
        logger.info('[SchedulerLock] Redis lock client connected');
    });

    await client.connect();
    redisClient = client;
    return client;
}

export interface SchedulerLock {
    acquired: boolean;
    key: string;
    value: string;
    ttlMs: number;
}

/**
 * Try to acquire a distributed lock for a scheduler job.
 * Returns { acquired: true } if this instance got the lock, false otherwise.
 *
 * @param jobKey — unique identifier for the job (e.g. 'sla', 'crm.activity_reminders')
 * @param ttlMs — lock expiry in ms (prevents stale locks if the holder crashes)
 */
export async function acquireLock(jobKey: string, ttlMs: number = DEFAULT_TTL_MS): Promise<SchedulerLock> {
    const lockValue = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const redisKey = `${LOCK_PREFIX}${jobKey}`;

    // If singleton mode is not requested and Redis is unavailable, allow the job to run
    // on all instances (graceful degradation). This matches pre-P3-05 behavior.
    const singletonMode = config.scheduler?.singletonMode ?? false;

    try {
        const client = await getLockClient();
        const result = await client.set(redisKey, lockValue, 'PX', ttlMs, 'NX');

        if (result === 'OK') {
            logger.debug(`[SchedulerLock] Acquired lock for ${jobKey}`, { lockValue });
            return { acquired: true, key: redisKey, value: lockValue, ttlMs };
        }

        // Another instance holds the lock
        logger.debug(`[SchedulerLock] Lock not acquired for ${jobKey} — another instance holds it`);
        return { acquired: false, key: redisKey, value: lockValue, ttlMs };
    } catch (err) {
        if (singletonMode) {
            // In singleton mode, if Redis is down, SKIP the job to prevent duplicates
            logger.warn(`[SchedulerLock] Redis unavailable in singleton mode — skipping ${jobKey}`);
            return { acquired: false, key: redisKey, value: lockValue, ttlMs };
        }
        // In non-singleton mode, allow the job to run on every instance
        logger.warn(`[SchedulerLock] Redis unavailable — allowing ${jobKey} on all instances (non-singleton mode)`);
        return { acquired: true, key: redisKey, value: lockValue, ttlMs };
    }
}

/**
 * Release a scheduler lock. Uses a Lua script to ensure we only
 * release our own lock (prevents accidentally releasing another instance's lock).
 */
export async function releaseLock(lock: SchedulerLock): Promise<void> {
    if (!lock.acquired) return;

    try {
        const client = await getLockClient();
        // Only delete if the value matches — prevents releasing a lock we don't own
        const result = await client.eval(
            'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
            1,
            lock.key,
            lock.value,
        );
        logger.debug(`[SchedulerLock] Released lock for ${lock.key}`, { released: result === 1 });
    } catch (err) {
        logger.warn(`[SchedulerLock] Failed to release lock for ${lock.key}`, { error: String(err) });
        // Lock will expire via TTL — safe to ignore
    }
}