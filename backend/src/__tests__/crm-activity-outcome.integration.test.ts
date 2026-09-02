import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import prisma from '../utils/prisma';
import { config } from '../config';

/**
 * Covers the seam the unit suites step over: the frontend activity forms mock
 * crmService, and the backend unit tests never post the payload the forms
 * actually send. These tests drive the real HTTP route with the real validator.
 */
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const tenantId = '00000000-0000-0000-0000-000000000001';

let token: string;
let userId: string;
let roleId: string;
let leadId: string;

beforeAll(async () => {
  const permissions = await Promise.all(['crm:read', 'crm:write'].map(name =>
    prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name, resource: 'crm', action: name.split(':')[1]! },
    })));
  const role = await prisma.role.create({ data: { name: `CRM_OUTCOME_${suffix}` } });
  roleId = role.id;
  for (const permission of permissions) {
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
  }
  const user = await prisma.user.create({
    data: {
      tenantId,
      email: `crm-outcome-${suffix}@test.local`,
      passwordHash: 'test-hash',
      firstName: 'Outcome',
      lastName: 'Rep',
      isActive: true,
      roles: { create: { roleId: role.id } },
    },
  });
  userId = user.id;
  token = jwt.sign({ userId: user.id, email: user.email, jti: `crm-outcome-${suffix}` }, config.jwt.secret, { expiresIn: '1h' });
  const lead = await prisma.crmLead.create({
    data: { tenantId, title: `Outcome Lead ${suffix}`, source: 'OTHER', status: 'NEW', ownerId: user.id },
  });
  leadId = lead.id;
});

afterAll(async () => {
  // Guard every id before it reaches a `where`. Prisma treats `undefined` in a
  // filter as "no filter", so if beforeAll throws and leaves these unset, an
  // unguarded deleteMany becomes an unfiltered delete of the whole table.
  if (userId) {
    await prisma.crmActivity.deleteMany({ where: { userId } });
    await prisma.auditLog.deleteMany({ where: { userId } });
  }
  if (leadId) await prisma.crmLead.deleteMany({ where: { id: leadId } });
  if (userId) {
    await prisma.userRole.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  if (roleId) {
    await prisma.rolePermission.deleteMany({ where: { roleId } });
    await prisma.role.deleteMany({ where: { id: roleId } });
  }
});

const post = (body: Record<string, unknown>) =>
  request(app).post('/api/v1/crm/activities').set('Authorization', `Bearer ${token}`).send(body);

describe('activity outcome round trip over HTTP', () => {
  it('accepts the payload the forms send when an outcome is left unset', async () => {
    // Exactly what CrmLeadDetail/CrmOpportunityDetail send with Engagement on
    // "Not recorded": an explicit null, not an omitted field.
    const res = await post({
      activityType: 'CALL', callCategory: 'NEW_CALL', callOutcome: 'ANSWERED',
      engagementOutcome: null, subject: `Unset engagement ${suffix}`, leadId,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.activity.engagementOutcome).toBeNull();
    // callOutcome was set, so the activity is stamped on that.
    expect(res.body.data.activity.outcomeRecordedAt).not.toBeNull();
  });

  it('accepts nulls for every outcome field', async () => {
    const res = await post({
      activityType: 'NOTE', subject: `All null ${suffix}`, leadId,
      callCategory: null, callOutcome: null, emailOutcome: null,
      meetingOutcome: null, engagementOutcome: null,
    });
    expect(res.status).toBe(201);
    // Nothing was recorded, so there is no outcome date to report on.
    expect(res.body.data.activity.outcomeRecordedAt).toBeNull();
  });

  it('stamps outcomeRecordedAt when an outcome is first set', async () => {
    const res = await post({
      activityType: 'MEETING', meetingOutcome: 'ARRANGED',
      engagementOutcome: null, subject: `Arranged ${suffix}`, leadId,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.activity.outcomeRecordedAt).not.toBeNull();
  });

  it('clears a recorded outcome and re-stamps when the form sends null', async () => {
    const created = await post({
      activityType: 'CALL', callCategory: 'NEW_CALL', callOutcome: 'ANSWERED',
      engagementOutcome: 'INTERESTED', subject: `Clearable ${suffix}`, leadId,
    });
    expect(created.status).toBe(201);
    const stampedAt = created.body.data.activity.outcomeRecordedAt;
    expect(stampedAt).not.toBeNull();

    const cleared = await request(app)
      .patch(`/api/v1/crm/activities/${created.body.data.activity.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ engagementOutcome: null });

    expect(cleared.status).toBe(200);
    expect(cleared.body.data.activity.engagementOutcome).toBeNull();
    expect(new Date(cleared.body.data.activity.outcomeRecordedAt).getTime())
      .toBeGreaterThanOrEqual(new Date(stampedAt).getTime());
  });

  it('still rejects a value outside the enum', async () => {
    const res = await post({
      activityType: 'CALL', engagementOutcome: 'MAYBE',
      subject: `Bad enum ${suffix}`, leadId,
    });
    expect(res.status).toBe(400);
  });
});
