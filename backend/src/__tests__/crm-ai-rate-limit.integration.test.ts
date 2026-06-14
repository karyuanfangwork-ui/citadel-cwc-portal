import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../services/crm-ai.service', () => ({
  generateDailyBriefing: jest.fn().mockResolvedValue({ summary: 'ok' }),
}));

import app from '../app';
import prisma from '../utils/prisma';
import { config } from '../config';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const aiUserEmail = `crm-ai-rate-${suffix}@test.local`;

let aiUserToken: string;

const signToken = (userId: string, email: string) =>
  jwt.sign({ userId, email, jti: `crm-ai-rate-${userId}-${suffix}` }, config.jwt.secret, { expiresIn: '1h' });

beforeAll(async () => {
  const permission = await prisma.permission.upsert({
    where: { name: 'crm:read' },
    update: {},
    create: { name: 'crm:read', resource: 'crm', action: 'read' },
  });

  const role = await prisma.role.upsert({
    where: { name: `CRM_AI_RATE_TEST_${suffix}` },
    update: {},
    create: { name: `CRM_AI_RATE_TEST_${suffix}` },
  });

  await prisma.rolePermission.create({
    data: { roleId: role.id, permissionId: permission.id },
  });

  const user = await prisma.user.create({
    data: {
      email: aiUserEmail,
      passwordHash: 'test-hash',
      firstName: 'AI',
      lastName: 'Limiter',
      isActive: true,
      roles: { create: { roleId: role.id } },
    },
  });

  aiUserToken = signToken(user.id, user.email);
});

afterAll(async () => {
  await prisma.userRole.deleteMany({ where: { user: { email: aiUserEmail } } });
  await prisma.user.deleteMany({ where: { email: aiUserEmail } });
  await prisma.role.deleteMany({ where: { name: `CRM_AI_RATE_TEST_${suffix}` } });
});

describe('CRM AI rate limiting', () => {
  it('returns 429 after the per-user CRM AI limit is exceeded', async () => {
    const responses = [];
    for (let index = 0; index < 11; index += 1) {
      responses.push(await request(app)
        .get('/api/v1/crm/ai/dashboard/briefing')
        .set('Authorization', `Bearer ${aiUserToken}`));
    }

    responses.slice(0, 10).forEach((res) => {
      expect(res.status).toBe(200);
    });

    expect(responses[10].status).toBe(429);
    expect(responses[10].body.message).toContain('CRM AI rate limit exceeded');
  });
});
