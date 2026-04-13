import Redis from 'ioredis';
import { config } from '../config';

const redis = new Redis(config.redis.url);

const BLOCKLIST_PREFIX = 'jwt:blocked:';
const USER_PREFIX = 'jwt:user:';

export const tokenService = {
  /**
   * Add a jti to the Redis blocklist with a TTL matching the token's remaining lifetime.
   */
  async revokeJti(jti: string, ttlSeconds: number): Promise<void> {
    await redis.setex(`${BLOCKLIST_PREFIX}${jti}`, ttlSeconds, '1');
  },

  /**
   * Returns true if the jti has been revoked (is in the blocklist).
   */
  async isJtiRevoked(jti: string): Promise<boolean> {
    const val = await redis.get(`${BLOCKLIST_PREFIX}${jti}`);
    return val !== null;
  },

  /**
   * Revoke all active tokens for a user (used on password change / admin force-logout).
   */
  async revokeAllForUser(userId: string): Promise<void> {
    const keys = await redis.keys(`${BLOCKLIST_PREFIX}${USER_PREFIX}${userId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    // Store a "revoked before" sentinel for this user (30 days TTL)
    await redis.setex(`${USER_PREFIX}${userId}:revoked_at`, 30 * 24 * 3600, Date.now().toString());
  },

  /**
   * Returns the timestamp (ms) before which all tokens for this user are invalid.
   * Returns 0 if no global revocation has been issued.
   */
  async getUserRevocationTimestamp(userId: string): Promise<number> {
    const val = await redis.get(`${USER_PREFIX}${userId}:revoked_at`);
    return val ? parseInt(val, 10) : 0;
  },
};
