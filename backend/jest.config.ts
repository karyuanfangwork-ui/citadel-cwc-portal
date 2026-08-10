import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { diagnostics: false }],
  },
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  // Phase 8b: the suite passes 230/230 and every subsystem this repo owns is
  // closed in `src/__tests__/setup.ts` (scheduler, BullMQ queues, SSE Redis,
  // the Redis factory registry, Prisma). Two handle sources survive anyway and
  // are not ours to close from a test hook:
  //   - 17 Postgres sockets: Prisma's query engine holds its pool open past the
  //     point `prisma.$disconnect()` resolves. Engine-side, not fixable here.
  //   - 3 Redis sockets: ioredis clients that finish connecting or reconnect on
  //     an event-loop turn after `closeAllRedisClients()` has already drained.
  // `--detectOpenHandles` reaches the same full passing summary without naming
  // an owner, because both are created inside native/vendored code rather than
  // from our stack frames. `forceExit` is therefore a deliberate, scoped
  // concession: the process is torn down after a green summary. It is set here
  // rather than in the `test` script so the release gate, coverage runs and the
  // credit subsets all behave identically.
  //
  // Deliberately NOT re-adding `--detectOpenHandles=false` (removed in e2afc1d)
  // — the leak must stay observable so it can be diagnosed if it ever grows.
  forceExit: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/__tests__/**',
    '!src/index.ts',
  ],
};

export default config;
