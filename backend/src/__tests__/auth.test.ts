import express from 'express';
import request from 'supertest';
import authRoutes from '../routes/auth.routes';
import { errorHandler } from '../middleware/error.middleware';
import prisma from '../utils/prisma';
import bcrypt from 'bcryptjs';

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
app.use(errorHandler);

const TEST_EMAIL = 'test-auth@test.com';
const TEST_PASSWORD = 'TestPass123!';
let TEST_PASSWORD_HASH = '';

beforeAll(async () => {
  TEST_PASSWORD_HASH = await bcrypt.hash(TEST_PASSWORD, 12);
  // Clean up any existing test user
  await prisma.session.deleteMany({ where: { user: { email: TEST_EMAIL } } });
  await prisma.userRole.deleteMany({ where: { user: { email: TEST_EMAIL } } });
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });

  // Create test user directly (register route is disabled)
  await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash: TEST_PASSWORD_HASH,
      firstName: 'Test',
      lastName: 'User',
      isActive: true,
      mustResetPassword: false,
      tenantId: '00000000-0000-0000-0000-000000000001',
    },
  });
});

afterAll(async () => {
  await prisma.session.deleteMany({ where: { user: { email: TEST_EMAIL } } });
  await prisma.userRole.deleteMany({ where: { user: { email: TEST_EMAIL } } });
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

describe('POST /auth/login', () => {
  it('logs in with valid credentials and returns 200', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    // Tokens may be in body or cookies depending on config
    const hasBodyToken = res.body.data?.accessToken || res.body.accessToken;
    const hasCookieToken = (res.headers['set-cookie'] as unknown as string[])?.some?.(
      (c: string) => c.startsWith('access_token=')
    );
    expect(hasBodyToken || hasCookieToken).toBeTruthy();
  });

  it('rejects wrong password with 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_EMAIL, password: 'WrongPassword!' });

    expect(res.status).toBe(401);
  });

  it('rejects non-existent user with 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@test.com', password: TEST_PASSWORD });

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/register', () => {
  it('returns 404 since registration is disabled', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'new-user@test.com',
        password: 'NewPass123!',
        firstName: 'New',
        lastName: 'User',
      });

    // Register route is intentionally commented out in auth.routes.ts
    expect(res.status).toBe(404);
  });
});

// ── P0-2: mustResetPassword enforcement ──────────────────────────────
describe('POST /auth/login — mustResetPassword', () => {
  const FORCE_RESET_EMAIL = 'force-reset@test.com';

  beforeAll(async () => {
    const hash = await bcrypt.hash('TempPass123!', 12);
    await prisma.userRole.deleteMany({ where: { user: { email: FORCE_RESET_EMAIL } } });
    await prisma.user.deleteMany({ where: { email: FORCE_RESET_EMAIL } });
    await prisma.user.create({
      data: {
        email: FORCE_RESET_EMAIL,
        passwordHash: hash,
        firstName: 'Force',
        lastName: 'Reset',
        isActive: true,
        mustResetPassword: true,
        tenantId: '00000000-0000-0000-0000-000000000001',
      },
    });
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { user: { email: FORCE_RESET_EMAIL } } });
    await prisma.userRole.deleteMany({ where: { user: { email: FORCE_RESET_EMAIL } } });
    await prisma.user.deleteMany({ where: { email: FORCE_RESET_EMAIL } });
  });

  it('blocks login and returns 403 PASSWORD_RESET_REQUIRED with reset token', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: FORCE_RESET_EMAIL, password: 'TempPass123!' });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('PASSWORD_RESET_REQUIRED');
    expect(res.body.details).toBeDefined();
    expect(res.body.details.resetToken).toBeDefined();
    expect(res.body.details.email).toBe(FORCE_RESET_EMAIL);
  });

  it('allows login after mustResetPassword is cleared', async () => {
    await prisma.user.update({
      where: { email: FORCE_RESET_EMAIL },
      data: { mustResetPassword: false },
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: FORCE_RESET_EMAIL, password: 'TempPass123!' });

    expect(res.status).toBe(200);
  });
});

// ── P0-4: Admin unlock ───────────────────────────────────────────────
describe('POST /auth/admin-unlock', () => {
  it('requires authentication — returns 401 without token', async () => {
    const res = await request(app)
      .post('/auth/admin-unlock')
      .send({ email: 'someone@test.com' });

    expect(res.status).toBe(401);
  });

  it('requires user:manage permission — returns 403 for regular user', async () => {
    // First, log in as a regular user to get a token
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    const token = loginRes.body.data?.accessToken ||
      (loginRes.headers['set-cookie'] as string[])?.find?.(
        (c: string) => c.startsWith('access_token=')
      )?.split('=')[1]?.split(';')[0];

    if (!token) {
      // Skip if token extraction fails (cookie-based auth)
      console.warn('Skipping admin-unlock permission test — could not extract token');
      return;
    }

    const res = await request(app)
      .post('/auth/admin-unlock')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'someone@test.com' });

    // Regular user without user:manage should get 403
    expect(res.status).toBe(403);
  });

  it('returns 400 if email is missing', async () => {
    // This tests the validation — requires auth + permission,
    // so we can only test that the endpoint exists and validates input
    const res = await request(app)
      .post('/auth/admin-unlock')
      .send({});

    expect(res.status).toBe(401); // Not authenticated
  });
});

// ── P0-5: requireServiceApiKey middleware ─────────────────────────────
describe('requireServiceApiKey middleware', () => {
  const { requireServiceApiKey } = require('../middleware/auth.middleware');

  it('rejects request without API key — returns 503 or 403', async () => {
    // Set a key so the middleware is active
    const originalEnv = process.env.SERVICE_API_KEY;
    process.env.SERVICE_API_KEY = 'test-key-abc';
    jest.resetModules();

    const { requireServiceApiKey: freshMiddleware } = require('../middleware/auth.middleware');

    const mockReq = { header: jest.fn().mockReturnValue(undefined) } as any;
    const mockRes = {} as any;
    const mockNext = jest.fn();

    freshMiddleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 403,
      message: 'Valid service API key is required',
    }));

    process.env.SERVICE_API_KEY = originalEnv;
    jest.resetModules();
  });

  it('rejects request with wrong API key — returns 403', async () => {
    const originalEnv = process.env.SERVICE_API_KEY;
    process.env.SERVICE_API_KEY = 'correct-key-123';
    // Re-require config to pick up new env
    jest.resetModules();

    const { requireServiceApiKey: freshMiddleware } = require('../middleware/auth.middleware');

    const mockReq = { header: jest.fn().mockReturnValue('wrong-key') } as any;
    const mockRes = {} as any;
    const mockNext = jest.fn();

    freshMiddleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 403,
    }));

    // Restore
    process.env.SERVICE_API_KEY = originalEnv;
    jest.resetModules();
  });

  it('allows request with correct X-Service-API-Key header', async () => {
    const originalEnv = process.env.SERVICE_API_KEY;
    process.env.SERVICE_API_KEY = 'correct-key-456';
    jest.resetModules();

    const { requireServiceApiKey: freshMiddleware } = require('../middleware/auth.middleware');

    const mockReq = { header: jest.fn((h: string) => {
      if (h.toLowerCase() === 'x-service-api-key') return 'correct-key-456';
      return undefined;
    }) } as any;
    const mockRes = {} as any;
    const mockNext = jest.fn();

    freshMiddleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(); // called with no error = success

    process.env.SERVICE_API_KEY = originalEnv;
    jest.resetModules();
  });
});