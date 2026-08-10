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
  // The tests were never the slow part: 108 suites and 1256 tests pass in about
  // seven seconds. Jest then sat on open handles for 1h40m. Close them in
  // dependency order and tolerate absence — not every suite imports every
  // subsystem, and a teardown that throws is worse than one that no-ops.
  try {
    const { shutdownScheduler } = await import('../services/scheduler.service');
    await shutdownScheduler();
  } catch {
    /* scheduler not initialised by this suite */
  }

  try {
    const { closeAllRedisClients } = await import('../utils/redis');
    await closeAllRedisClients();
  } catch {
    /* redis not loaded by this suite */
  }

  await prisma.$disconnect();
});