import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/error.middleware';
import prisma from '../../utils/prisma';

// In-memory cache for feature flags (refreshed every 60 seconds)
interface FlagCache {
  flags: Map<string, boolean>;
  lastRefresh: number;
}

const CACHE_TTL_MS = 60_000; // 1 minute

let flagCache: FlagCache = {
  flags: new Map(),
  lastRefresh: 0,
};

async function refreshCache(): Promise<void> {
  const now = Date.now();
  if (now - flagCache.lastRefresh < CACHE_TTL_MS) return;

  try {
    const flags = await prisma.featureFlag.findMany();
    const newMap = new Map<string, boolean>();
    for (const flag of flags) {
      newMap.set(flag.key, flag.enabled);
    }
    flagCache = { flags: newMap, lastRefresh: now };
  } catch (err) {
    // If DB query fails, keep existing cache — fail open for flags
    console.warn('Feature flag cache refresh failed, using stale cache', err);
  }
}

/**
 * Express middleware that checks if a feature flag is enabled.
 * Usage: router.get('/something', requireFeatureFlag('credit:module'), handler)
 * 
 * If the flag is disabled or doesn't exist, returns 403 with a clear message.
 * The flag key convention is: 'credit:<capability>' e.g. 'credit:borrowers', 'credit:applications'
 */
export function requireFeatureFlag(flagKey: string) {
  return async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      await refreshCache();

      const enabled = flagCache.flags.get(flagKey);

      if (enabled === undefined) {
        // Flag not found in DB — default to OFF (safe default)
        throw new AppError(`Feature flag '${flagKey}' is not configured. Access denied.`, 403);
      }

      if (!enabled) {
        throw new AppError(`Feature '${flagKey}' is currently disabled.`, 403);
      }

      next();
    } catch (err) {
      if (err instanceof AppError) {
        next(err);
      } else {
        next(new AppError(`Feature flag check failed for '${flagKey}'`, 500));
      }
    }
  };
}

/**
 * Check if a feature flag is enabled (programmatic check, not middleware).
 * Useful in service layer code where you need to conditionally execute logic.
 */
export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  await refreshCache();
  return flagCache.flags.get(flagKey) ?? false;
}

/**
 * Force-refresh the flag cache. Call this after toggling a flag via admin API.
 */
export async function invalidateFlagCache(): Promise<void> {
  flagCache = { flags: new Map(), lastRefresh: 0 };
  await refreshCache();
}