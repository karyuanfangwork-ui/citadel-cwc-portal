import express from 'express';
import request from 'supertest';
import authRoutes from '../routes/auth.routes';
import { errorHandler } from '../middleware/error.middleware';
import prisma from '../utils/prisma';

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
app.use(errorHandler);

const TEST_EMAIL = 'test-auth@test.com';
const TEST_PASSWORD = 'TestPass123!';

beforeAll(async () => {
  // Clean up any existing test user
  await prisma.session.deleteMany({ where: { user: { email: TEST_EMAIL } } });
  await prisma.userRole.deleteMany({ where: { user: { email: TEST_EMAIL } } });
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
});

afterAll(async () => {
  await prisma.session.deleteMany({ where: { user: { email: TEST_EMAIL } } });
  await prisma.userRole.deleteMany({ where: { user: { email: TEST_EMAIL } } });
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
});

describe('POST /auth/register', () => {
  it('registers a new user and returns tokens', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        firstName: 'Test',
        lastName: 'User',
      });

    expect(res.status).toBe(201);
    const body = res.body.data ?? res.body;
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    const userEmail = body.user?.email ?? body.email;
    expect(userEmail).toBe(TEST_EMAIL);
  });

  it('rejects duplicate email with 409 or 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        firstName: 'Test',
        lastName: 'User',
      });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'incomplete@test.com' });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('POST /auth/login', () => {
  it('logs in with valid credentials and returns accessToken', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    const body = res.body.data ?? res.body;
    expect(body.accessToken).toBeDefined();
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
