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
    await closeAllRedisClients();
    // Some modules start a fire-and-forget Redis connect during import. Yield
    // once so that connect callbacks cannot recreate open sockets after the
    // first shutdown pass.
    await new Promise<void>((resolve) => setImmediate(resolve));
    await closeAllRedisClients();
  } catch {
    /* redis not loaded by this suite */
  }

  await prisma.$disconnect();

  // A few auth modules create their Redis clients while their test file's
  // afterAll hooks are still unwinding. Close once more after Prisma is down
  // so late module-import callbacks cannot leave a TCP handle behind.
  try {
    const { closeAllRedisClients } = await import('../utils/redis');
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
    await closeAllRedisClients();
  } catch {
    /* best-effort final teardown */
  }
});