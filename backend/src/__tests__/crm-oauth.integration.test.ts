import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../services/crm-email-sync.service', () => ({
  handleOAuthCallback: jest.fn().mockResolvedValue(undefined),
  getOAuthUrl: jest.fn(),
}));

import app from '../app';
import prisma from '../utils/prisma';
import { config } from '../config';
import * as emailSyncService from '../services/crm-email-sync.service';
import { createOAuthState } from '../services/oauth-state.service';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const callbackUserEmail = `crm-oauth-user-${suffix}@test.local`;
const otherUserEmail = `crm-oauth-other-${suffix}@test.local`;

let callbackUserToken: string;
let otherUserId: string;

const signToken = (userId: string, email: string) =>
  jwt.sign({ userId, email, jti: `crm-oauth-${userId}-${suffix}` }, config.jwt.secret, { expiresIn: '1h' });

beforeAll(async () => {
  const role = await prisma.role.upsert({
    where: { name: `CRM_OAUTH_TEST_${suffix}` },
    update: {},
    create: { name: `CRM_OAUTH_TEST_${suffix}` },
  });

  const [callbackUser, otherUser] = await Promise.all([
    prisma.user.create({
      data: {
        email: callbackUserEmail,
        passwordHash: 'test-hash',
        firstName: 'OAuth',
        lastName: 'User',
        isActive: true,
        roles: { create: { roleId: role.id } },
      },
    }),
    prisma.user.create({
      data: {
        email: otherUserEmail,
        passwordHash: 'test-hash',
        firstName: 'OAuth',
        lastName: 'Other',
        isActive: true,
        roles: { create: { roleId: role.id } },
      },
    }),
  ]);

  callbackUserToken = signToken(callbackUser.id, callbackUser.email);
  otherUserId = otherUser.id;
});

afterAll(async () => {
  await prisma.userRole.deleteMany({ where: { user: { email: { in: [callbackUserEmail, otherUserEmail] } } } });
  await prisma.user.deleteMany({ where: { email: { in: [callbackUserEmail, otherUserEmail] } } });
  await prisma.role.deleteMany({ where: { name: `CRM_OAUTH_TEST_${suffix}` } });
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CRM OAuth callback session binding', () => {
  it('rejects a Google callback state signed for another user', async () => {
    const state = createOAuthState(otherUserId, 'GOOGLE');

    const res = await request(app)
      .get('/api/v1/crm/integrations/google/callback')
      .set('Authorization', `Bearer ${callbackUserToken}`)
      .query({ code: 'google-code', state });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('OAuth state does not match session user');
    expect(emailSyncService.handleOAuthCallback).not.toHaveBeenCalled();
  });

  it('rejects an Outlook callback state signed for another user', async () => {
    const state = createOAuthState(otherUserId, 'OUTLOOK');

    const res = await request(app)
      .get('/api/v1/crm/integrations/outlook/callback')
      .set('Authorization', `Bearer ${callbackUserToken}`)
      .query({ code: 'outlook-code', state });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('OAuth state does not match session user');
    expect(emailSyncService.handleOAuthCallback).not.toHaveBeenCalled();
  });
});
