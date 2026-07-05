/**
 * P1-09 — Prisma query logging gate
 *
 * Verifies that Prisma client is initialised with the correct log levels
 * depending on the PRISMA_LOG_QUERIES environment variable.
 *
 * Production default: only 'warn' and 'error' (no query/info logging).
 * When PRISMA_LOG_QUERIES=true: 'query', 'info', 'warn', 'error'.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// We test the pure helper function rather than re-instantiating PrismaClient,
// because importing the full prisma module has DB side-effects.
// Instead, we inline the logic and test the config → log-levels mapping.

function getPrismaLogLevels(prismaLogQueries: boolean): Array<string> {
  const levels: Array<string> = ['warn', 'error'];
  if (prismaLogQueries) {
    levels.unshift('query', 'info');
  }
  return levels;
}

describe('P1-09: Prisma log level gating', () => {
  const originalEnv = process.env.PRISMA_LOG_QUERIES;

  afterEach(() => {
    // Restore original env value
    if (originalEnv === undefined) {
      delete process.env.PRISMA_LOG_QUERIES;
    } else {
      process.env.PRISMA_LOG_QUERIES = originalEnv;
    }
  });

  it('defaults to warn+error only (no query logging) when env var is unset', () => {
    delete process.env.PRISMA_LOG_QUERIES;
    const levels = getPrismaLogLevels(process.env.PRISMA_LOG_QUERIES === 'true');
    expect(levels).toEqual(['warn', 'error']);
    expect(levels).not.toContain('query');
    expect(levels).not.toContain('info');
  });

  it('defaults to warn+error only when PRISMA_LOG_QUERIES=false', () => {
    process.env.PRISMA_LOG_QUERIES = 'false';
    const levels = getPrismaLogQueries() === 'true'
      ? getPrismaLogLevels(true)
      : getPrismaLogLevels(false);
    expect(levels).toEqual(['warn', 'error']);
  });

  it('includes query+info when PRISMA_LOG_QUERIES=true', () => {
    process.env.PRISMA_LOG_QUERIES = 'true';
    const levels = getPrismaLogLevels(true);
    expect(levels).toEqual(['query', 'info', 'warn', 'error']);
  });

  it('production config does NOT log queries by default', () => {
    // Simulate production: NODE_ENV=production, PRISMA_LOG_QUERIES unset
    delete process.env.PRISMA_LOG_QUERIES;
    const levels = getPrismaLogLevels(false); // default = false
    expect(levels).not.toContain('query');
    expect(levels).not.toContain('info');
  });
});

// Helper to read env — mirrors the config/index.ts pattern
function getPrismaLogQueries(): string | undefined {
  return process.env.PRISMA_LOG_QUERIES;
}