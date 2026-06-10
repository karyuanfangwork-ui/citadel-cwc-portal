import prisma from '../utils/prisma';

// Mock puppeteer-core ESM module so tests that import through app.ts
// don't crash on Jest's CJS transform of the ESM-only package.
jest.mock('puppeteer-core', () => ({
  __esModule: true,
  default: {
    launch: jest.fn(),
  },
}));

afterAll(async () => {
  await prisma.$disconnect();
});