import prisma from '../utils/prisma';

// Mock puppeteer ESM module so tests that import through app.ts
// don't crash on Jest's CJS transform of the ESM-only package.
jest.mock('puppeteer', () => ({
  __esModule: true,
  default: {
    launch: jest.fn(),
    executablePath: jest.fn(() => '/tmp/mock-chrome'),
  },
}));

afterAll(async () => {
  // Close background subsystems in dependency order and tolerate absence — not
  // every suite imports every subsystem, and a teardown that throws is worse
  // than one that no-ops. An aborted afterAll abandons this file's Redis and
  // Prisma handles, which is what kept Jest alive before Phase 8b.
  try {
    const { shutdownScheduler } = await import('../services/scheduler.service');
    await shutdownScheduler();
  } catch {
    /* scheduler not initialised by this suite */
  }

  try {
    const { shutdownAllQueues } = await import('../queues/shutdown');
    await shutdownAllQueues();
  } catch {
    /* no queues loaded by this suite */
  }

  try {
    const { disconnectSseRedis } = await import('../utils/sseClients');
    disconnectSseRedis();
  } catch {
    /* SSE Redis adapter not loaded by this suite */
  }

  try {
    const { closeAllRedisClients } = await import('../utils/redis');
    // closeAllRedisClients() drains five event-loop turns internally, which
    // covers module-level clients that finish connecting on a later turn.
    // Phase 8b: one pass is enough now that queue closers no longer force
    // connections during teardown.
    await closeAllRedisClients();
  } catch {
    /* redis not loaded by this suite */
  }

  await prisma.$disconnect();
});