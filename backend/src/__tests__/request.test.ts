import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import routes from '../routes/index';
import { errorHandler } from '../middleware/error.middleware';
import { config } from '../config';
import prisma from '../utils/prisma';

const app = express();
app.use(express.json());
app.use('/api/v1', routes);
app.use(errorHandler);

const TEST_EMAIL = 'test-request@test.com';
const TEST_PASSWORD = 'TestPass123!';

let authToken: string;
let testUserId: string;
let testRequestId: string;
let serviceDeskId: string;
let requestTypeId: string;

beforeAll(async () => {
  // Clean up any pre-existing test data
  await prisma.requestActivity.deleteMany({
    where: { request: { requester: { email: TEST_EMAIL } } },
  });
  await prisma.request.deleteMany({
    where: { requester: { email: TEST_EMAIL } },
  });
  await prisma.session.deleteMany({ where: { user: { email: TEST_EMAIL } } });
  await prisma.userRole.deleteMany({ where: { user: { email: TEST_EMAIL } } });
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });

  // Create test user
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {},
    create: {
      email: TEST_EMAIL,
      passwordHash,
      firstName: 'Test',
      lastName: 'RequestUser',
      isActive: true,
    },
  });
  testUserId = user.id;

  // Generate JWT with jti claim (required by auth middleware)
  const jti = crypto.randomUUID();
  authToken = jwt.sign(
    { userId: user.id, email: user.email, jti },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  // Get first service desk for test requests
  const serviceDesk = await prisma.serviceDesk.findFirst();
  if (!serviceDesk) {
    throw new Error('No service desk found in database. Run seed first.');
  }
  serviceDeskId = serviceDesk.id;

  // Get first request type for that service desk
  const requestType = await prisma.requestType.findFirst({
    where: {
      serviceCategory: {
        serviceDeskId: serviceDesk.id,
      },
    },
  });
  if (!requestType) {
    throw new Error('No request type found for service desk. Run seed first.');
  }
  requestTypeId = requestType.id;
});

afterAll(async () => {
  await prisma.requestActivity.deleteMany({
    where: { request: { requester: { email: TEST_EMAIL } } },
  });
  await prisma.request.deleteMany({
    where: { requester: { email: TEST_EMAIL } },
  });
  await prisma.session.deleteMany({ where: { user: { email: TEST_EMAIL } } });
  await prisma.userRole.deleteMany({ where: { user: { email: TEST_EMAIL } } });
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
});

describe('POST /api/v1/requests', () => {
  it('creates a request and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        serviceDeskId,
        requestTypeId,
        summary: 'Test request summary',
        description: 'Test request description',
        priority: 'MEDIUM',
      });

    expect(res.status).toBe(201);
    const body = res.body.data ?? res.body;
    expect(body.request).toBeDefined();
    testRequestId = body.request.id;
  });
});

describe('GET /api/v1/requests/:id', () => {
  it('gets a request by ID and returns 200', async () => {
    const res = await request(app)
      .get(`/api/v1/requests/${testRequestId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const body = res.body.data ?? res.body;
    expect(body.request).toBeDefined();
    expect(body.request.id).toBe(testRequestId);
  });
});

describe('GET /api/v1/requests', () => {
  it('lists requests and returns 200 with at least one result', async () => {
    const res = await request(app)
      .get('/api/v1/requests')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const body = res.body.data ?? res.body;
    const requests = body.requests ?? body;
    expect(Array.isArray(requests)).toBe(true);
    expect(requests.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects request without auth token with 401', async () => {
    const res = await request(app).get('/api/v1/requests');

    expect(res.status).toBe(401);
  });
});

describe('PUT /api/v1/requests/:id', () => {
  it('updates a request and returns 200', async () => {
    const res = await request(app)
      .put(`/api/v1/requests/${testRequestId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        summary: 'Updated test request summary',
        priority: 'HIGH',
      });

    expect(res.status).toBe(200);
    const body = res.body.data ?? res.body;
    expect(body.request).toBeDefined();
  });
});

describe('GET /api/v1/requests with requestTypeId filter', () => {
  it('returns only requests matching the given requestTypeId', async () => {
    const res = await request(app)
      .get('/api/v1/requests')
      .query({ requestTypeId })
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const body = res.body.data ?? res.body;
    const requests = body.requests ?? body;
    expect(Array.isArray(requests)).toBe(true);
    expect(requests.length).toBeGreaterThanOrEqual(1);
    // Every returned request must have the matching requestTypeId
    requests.forEach((r: any) => {
      expect(r.requestType?.id ?? r.requestTypeId).toBe(requestTypeId);
    });
  });

  it('returns empty list when no requests match the given requestTypeId', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .get('/api/v1/requests')
      .query({ requestTypeId: nonExistentId })
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const body = res.body.data ?? res.body;
    const requests = body.requests ?? body;
    expect(Array.isArray(requests)).toBe(true);
    expect(requests.length).toBe(0);
  });
});
