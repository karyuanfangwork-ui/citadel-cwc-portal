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
  TEST_PASSWORD_HASH = await bcrypt.hash(TEST_PASSWORD, 10);
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
    const hasCookieToken = (res.headers['set-cookie'] as string[])?.some?.(
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