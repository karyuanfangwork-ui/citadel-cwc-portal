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
  await prisma.$disconnect();
});