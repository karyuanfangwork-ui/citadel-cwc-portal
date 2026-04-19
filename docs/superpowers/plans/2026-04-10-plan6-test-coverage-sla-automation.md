# Plan 6: Test Coverage & SLA Automation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add critical test coverage for auth and request CRUD flows, and implement SLA due date calculation on request creation plus a scheduled SLA breach detection job.

**Architecture:** Jest tests using Prisma with a test database. SLA calculation runs at request creation time based on `RequestType.slaHours`. A lightweight cron-style function checks for breached SLAs and creates notifications.

**Tech Stack:** Jest, ts-jest, Prisma, Node.js, Express

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/jest.config.ts` | Jest configuration |
| Create | `backend/src/__tests__/setup.ts` | Test setup and teardown |
| Create | `backend/src/__tests__/auth.test.ts` | Auth endpoint tests |
| Create | `backend/src/__tests__/request.test.ts` | Request CRUD tests |
| Modify | `backend/src/controllers/request.controller.ts` | Calculate SLA due date on create |
| Create | `backend/src/services/sla.service.ts` | SLA breach detection + notification |
| Create | `backend/src/jobs/sla-checker.ts` | Scheduled SLA check runner |
| Modify | `backend/src/index.ts` | Start SLA checker on boot |

---

### Task 1: Jest Configuration

**Files:**
- Create: `backend/jest.config.ts`
- Create: `backend/src/__tests__/setup.ts`

- [ ] **Step 1: Create `backend/jest.config.ts`**

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterSetup: ['<rootDir>/src/__tests__/setup.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/__tests__/**',
    '!src/index.ts',
  ],
};

export default config;
```

- [ ] **Step 2: Create `backend/src/__tests__/setup.ts`**

```typescript
import prisma from '../utils/prisma';

afterAll(async () => {
  await prisma.$disconnect();
});
```

- [ ] **Step 3: Commit**

```bash
git add backend/jest.config.ts backend/src/__tests__/setup.ts
git commit -m "feat: add Jest configuration for backend tests"
```

---

### Task 2: Auth Tests

**Files:**
- Create: `backend/src/__tests__/auth.test.ts`

- [ ] **Step 1: Create `backend/src/__tests__/auth.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import prisma from '../utils/prisma';

// Build a minimal app for testing
let app: express.Express;

beforeAll(async () => {
  // Dynamic import to avoid circular deps
  const { default: authRoutes } = await import('../routes/auth.routes');
  const { errorHandler } = await import('../middleware/error.middleware');

  app = express();
  app.use(express.json());
  app.use('/auth', authRoutes);
  app.use(errorHandler);

  // Clean test user if exists
  await prisma.user.deleteMany({ where: { email: 'test-auth@test.com' } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: 'test-auth@test.com' } });
});

describe('POST /auth/register', () => {
  it('should register a new user', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'test-auth@test.com',
      password: 'TestPassword123',
      firstName: 'Test',
      lastName: 'User',
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data.user.email).toBe('test-auth@test.com');
  });

  it('should reject duplicate email', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'test-auth@test.com',
      password: 'TestPassword123',
      firstName: 'Test',
      lastName: 'User',
    });

    expect(res.status).toBe(409);
  });

  it('should reject missing fields', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'bad@test.com',
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('POST /auth/login', () => {
  it('should login with valid credentials', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'test-auth@test.com',
      password: 'TestPassword123',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
  });

  it('should reject wrong password', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'test-auth@test.com',
      password: 'WrongPassword',
    });

    expect(res.status).toBe(401);
  });

  it('should reject non-existent user', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'nobody@test.com',
      password: 'whatever',
    });

    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Install supertest**

Run: `cd backend && npm install -D supertest @types/supertest`

- [ ] **Step 3: Run the tests**

Run: `cd backend && npm test -- --testPathPattern=auth`
Expected: All 6 tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/src/__tests__/auth.test.ts backend/package.json backend/package-lock.json
git commit -m "test: add auth endpoint tests (register, login, validation)"
```

---

### Task 3: Request CRUD Tests

**Files:**
- Create: `backend/src/__tests__/request.test.ts`

- [ ] **Step 1: Create `backend/src/__tests__/request.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import prisma from '../utils/prisma';
import jwt from 'jsonwebtoken';
import config from '../config';

let app: express.Express;
let authToken: string;
let testUserId: string;
let testServiceDeskId: string;
let createdRequestId: string;

beforeAll(async () => {
  const { default: routes } = await import('../routes/index');
  const { errorHandler } = await import('../middleware/error.middleware');
  const passport = await import('passport');

  app = express();
  app.use(express.json());
  app.use(passport.default.initialize());
  app.use('/api/v1', routes);
  app.use(errorHandler);

  // Create test user
  const bcrypt = await import('bcryptjs');
  const hashedPassword = await bcrypt.hash('TestPassword123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'test-request@test.com' },
    update: {},
    create: {
      email: 'test-request@test.com',
      passwordHash: hashedPassword,
      firstName: 'Request',
      lastName: 'Tester',
    },
  });
  testUserId = user.id;

  // Generate token
  authToken = jwt.sign({ sub: user.id, email: user.email }, config.jwt.secret, { expiresIn: '1h' });

  // Get a service desk
  const desk = await prisma.serviceDesk.findFirst();
  if (desk) testServiceDeskId = desk.id;
});

afterAll(async () => {
  // Clean up test data
  if (createdRequestId) {
    await prisma.requestActivity.deleteMany({ where: { requestId: createdRequestId } });
    await prisma.request.deleteMany({ where: { id: createdRequestId } });
  }
  await prisma.user.deleteMany({ where: { email: 'test-request@test.com' } });
});

describe('Request CRUD', () => {
  it('should create a request', async () => {
    const res = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        serviceDeskId: testServiceDeskId,
        summary: 'Test request from automated test',
        description: 'This is an automated test',
        priority: 'MEDIUM',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('referenceNumber');
    expect(res.body.data.summary).toBe('Test request from automated test');
    createdRequestId = res.body.data.id;
  });

  it('should get the created request', async () => {
    const res = await request(app)
      .get(`/api/v1/requests/${createdRequestId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdRequestId);
  });

  it('should list requests including the new one', async () => {
    const res = await request(app)
      .get('/api/v1/requests')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should reject request without auth', async () => {
    const res = await request(app).get('/api/v1/requests');

    expect(res.status).toBe(401);
  });

  it('should update the request', async () => {
    const res = await request(app)
      .put(`/api/v1/requests/${createdRequestId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        summary: 'Updated test request',
        priority: 'HIGH',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.summary).toBe('Updated test request');
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd backend && npm test -- --testPathPattern=request`
Expected: All 5 tests pass

- [ ] **Step 3: Commit**

```bash
git add backend/src/__tests__/request.test.ts
git commit -m "test: add request CRUD endpoint tests"
```

---

### Task 4: SLA Due Date Calculation on Request Create

**Files:**
- Modify: `backend/src/controllers/request.controller.ts`

- [ ] **Step 1: Read the `createRequest` method in `request.controller.ts`**

Find the `prisma.request.create(...)` call inside `createRequest`.

- [ ] **Step 2: Add SLA calculation before the create call**

Before the `prisma.request.create(...)`, add:

```typescript
      // Calculate SLA due date from request type
      let slaDueAt: Date | undefined;
      if (requestType?.slaHours) {
        slaDueAt = new Date();
        slaDueAt.setHours(slaDueAt.getHours() + requestType.slaHours);
      }
```

Then include `slaDueAt` in the create data:

```typescript
        data: {
          // ... existing fields ...
          slaDueAt,
        },
```

Note: You'll need to fetch the `requestType` before this. If it's not already fetched, add:

```typescript
      const requestType = requestTypeId
        ? await prisma.requestType.findUnique({ where: { id: requestTypeId } })
        : null;
```

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/request.controller.ts
git commit -m "feat: calculate SLA due date on request creation from request type slaHours"
```

---

### Task 5: SLA Breach Detection Service

**Files:**
- Create: `backend/src/services/sla.service.ts`

- [ ] **Step 1: Create `backend/src/services/sla.service.ts`**

```typescript
import prisma from '../utils/prisma';
import { notifyMultiple } from './notification.service';
import logger from '../utils/logger';

/**
 * Checks for requests that have breached their SLA and haven't been notified yet.
 * Uses a custom field flag 'slaBreachNotified' to avoid duplicate notifications.
 */
export async function checkSlaBreaches(): Promise<number> {
  const now = new Date();

  try {
    // Find open requests where SLA is breached and we haven't notified yet
    const breachedRequests = await prisma.request.findMany({
      where: {
        slaDueAt: { lte: now },
        status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'COMPLETED', 'PAYMENT_COMPLETED'] },
        // We'll track notification via an activity so we don't re-notify
      },
      include: {
        assignedTo: { select: { id: true } },
        requester: { select: { id: true } },
        activities: {
          where: { type: 'SYSTEM', content: { startsWith: 'SLA BREACH' } },
          take: 1,
        },
      },
    });

    // Filter to only those not yet notified
    const unnotified = breachedRequests.filter((r) => r.activities.length === 0);

    for (const request of unnotified) {
      // Create system activity marking the breach
      await prisma.requestActivity.create({
        data: {
          requestId: request.id,
          userId: request.requesterId, // System activity attributed to requester
          type: 'SYSTEM',
          content: `SLA BREACH: This request has exceeded its SLA deadline.`,
          metadata: { slaDueAt: request.slaDueAt?.toISOString(), breachedAt: now.toISOString() },
        },
      });

      // Notify assigned agent (if any) and all admins
      const notifyIds: string[] = [];
      if (request.assignedToId) notifyIds.push(request.assignedToId);

      const admins = await prisma.user.findMany({
        where: { roles: { some: { role: { name: 'ADMIN' } } } },
        select: { id: true },
      });
      admins.forEach((a) => {
        if (!notifyIds.includes(a.id)) notifyIds.push(a.id);
      });

      await notifyMultiple(
        notifyIds,
        'SLA_BREACHED',
        { referenceNumber: request.referenceNumber },
        request.id
      );

      logger.warn(`SLA breach detected for request ${request.referenceNumber}`);
    }

    if (unnotified.length > 0) {
      logger.info(`SLA check complete: ${unnotified.length} new breach(es) detected`);
    }

    return unnotified.length;
  } catch (error) {
    logger.error('SLA breach check failed', { error });
    return 0;
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/sla.service.ts
git commit -m "feat: add SLA breach detection service"
```

---

### Task 6: SLA Checker Job + Boot Integration

**Files:**
- Create: `backend/src/jobs/sla-checker.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create `backend/src/jobs/sla-checker.ts`**

```typescript
import { checkSlaBreaches } from '../services/sla.service';
import logger from '../utils/logger';

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startSlaChecker(): void {
  logger.info(`SLA checker started (interval: ${CHECK_INTERVAL_MS / 60000} minutes)`);

  // Run immediately on start
  checkSlaBreaches().catch(() => {});

  // Then run on interval
  intervalId = setInterval(() => {
    checkSlaBreaches().catch(() => {});
  }, CHECK_INTERVAL_MS);
}

export function stopSlaChecker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('SLA checker stopped');
  }
}
```

- [ ] **Step 2: Read `backend/src/index.ts` to find where the server starts**

- [ ] **Step 3: Add SLA checker import and start call in `index.ts`**

Add import at top:

```typescript
import { startSlaChecker } from './jobs/sla-checker';
```

After the `app.listen(...)` callback, add:

```typescript
  // Start background jobs
  startSlaChecker();
```

- [ ] **Step 4: Add SLA breach notification template to seed**

In `backend/prisma/seed.ts`, add to the notification templates array:

```typescript
    {
      name: 'sla_breached',
      eventType: 'SLA_BREACHED',
      emailSubject: 'SLA Breach Alert - Request {{referenceNumber}}',
      emailBody: 'Request {{referenceNumber}} has exceeded its SLA deadline. Please take immediate action.',
      pushTitle: 'SLA Breach',
      pushBody: 'Request {{referenceNumber}} has breached its SLA.',
    },
```

- [ ] **Step 5: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add backend/src/jobs/sla-checker.ts backend/src/index.ts backend/prisma/seed.ts
git commit -m "feat: add scheduled SLA breach checker with notifications"
```

---

## Summary

After completing all 6 tasks:
- Jest is configured with ts-jest for backend testing
- 11 tests cover auth (register, login, validation) and request CRUD (create, read, list, update, auth rejection)
- SLA due dates are automatically calculated from `RequestType.slaHours` when requests are created
- A background job checks for SLA breaches every 15 minutes
- Breached requests get a system activity entry and notifications sent to assigned agent + all admins
- Duplicate breach notifications are prevented by checking for existing system activities
