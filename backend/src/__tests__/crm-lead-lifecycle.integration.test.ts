import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import prisma from '../utils/prisma';
import { config } from '../config';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const fixturePrefix = '[TEST] Lead Lifecycle ';
const testEmailPrefix = 'crm-test-lead-lifecycle-';
// Roles are varchar(50); keep the test-only marker short enough for the run ID.
const rolePrefix = 'TEST_LL_';
const email = `${testEmailPrefix}${suffix}@test.local`;
let userId: string;
let token: string;
let accountId: string;

const auth = () => ({ Authorization: `Bearer ${token}` });

async function cleanupLeadLifecycleFixtures() {
  const roles = await prisma.role.findMany({ where: { name: { startsWith: rolePrefix } }, select: { id: true } });
  const roleIds = roles.map((role) => role.id);
  const users = await prisma.user.findMany({ where: { email: { startsWith: testEmailPrefix } }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  if (userIds.length) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  }
  await prisma.crmActivity.deleteMany({ where: { account: { name: { startsWith: fixturePrefix } } } });
  await prisma.crmLead.deleteMany({ where: { account: { name: { startsWith: fixturePrefix } } } });
  await prisma.crmAccount.deleteMany({ where: { name: { startsWith: fixturePrefix } } });
  if (userIds.length || roleIds.length) {
    await prisma.userRole.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { roleId: { in: roleIds } }] } });
  }
  if (userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
}

async function createLead(status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'LOST' | 'UNQUALIFIED' | 'CONVERTED' = 'NEW') {
  return prisma.crmLead.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001', title: `${fixturePrefix}Lead ${status} ${suffix}`,
      companyName: `${fixturePrefix}Company ${suffix}`, ownerId: userId, accountId, status,
      ...(status === 'LOST' ? { lostAt: new Date(), lostReason: 'Existing loss' } : {}),
      ...(status === 'CONVERTED' ? { convertedAt: new Date() } : {}),
    },
  });
}

beforeAll(async () => {
  await cleanupLeadLifecycleFixtures();
  const permissions = await Promise.all(['crm:read', 'crm:write'].map((name) => prisma.permission.upsert({
    where: { name }, update: {}, create: { name, resource: 'crm', action: name.split(':')[1] },
  })));
  const role = await prisma.role.create({ data: { name: `${rolePrefix}${suffix}` } });
  await prisma.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })) });
  const user = await prisma.user.create({ data: {
    tenantId: '00000000-0000-0000-0000-000000000001', email, passwordHash: 'test-hash', firstName: 'Lifecycle', lastName: 'Test', isActive: true,
    roles: { create: { roleId: role.id } },
  } });
  userId = user.id;
  token = jwt.sign({ userId, email, jti: `crm-lead-lifecycle-${suffix}` }, config.jwt.secret, { expiresIn: '1h' });
  const account = await prisma.crmAccount.create({ data: { tenantId: '00000000-0000-0000-0000-000000000001', name: `${fixturePrefix}Account ${suffix}`, ownerId: userId } });
  accountId = account.id;
});

afterAll(async () => {
  await cleanupLeadLifecycleFixtures();
});

describe('Lead lifecycle endpoints', () => {
  it('rejects direct lifecycle fields but permits normal PATCH fields', async () => {
    const lead = await createLead();
    await request(app).patch(`/api/v1/crm/leads/${lead.id}`).set(auth()).send({ status: 'LOST' }).expect(400);
    await request(app).patch(`/api/v1/crm/leads/${lead.id}`).set(auth()).send({ lostReason: 'Bypass' }).expect(400);
    const normal = await request(app).patch(`/api/v1/crm/leads/${lead.id}`).set(auth()).send({ remark: 'Still editable' });
    expect(normal.status).toBe(200);
    expect(normal.body.data.lead.remark).toBe('Still editable');
  });

  it.each([
    ['NEW', 'CONTACTED'],
    ['NEW', 'QUALIFIED'],
    ['CONTACTED', 'QUALIFIED'],
  ] as const)('advances %s to %s and audits the transition', async (source, target) => {
    const lead = await createLead(source);
    const res = await request(app).post(`/api/v1/crm/leads/${lead.id}/advance-status`).set(auth()).send({ status: target });
    expect(res.status).toBe(200);
    expect(res.body.data.lead.status).toBe(target);
    const audit = await prisma.auditLog.findFirst({ where: { resourceId: lead.id, action: 'ADVANCE_STATUS' } });
    expect(audit?.oldValues).toMatchObject({ status: source });
    expect(audit?.newValues).toMatchObject({ status: target });
  });

  it.each([
    ['CONTACTED', 'NEW'],
    ['QUALIFIED', 'CONTACTED'],
    ['QUALIFIED', 'NEW'],
    ['NEW', 'NEW'],
    ['CONTACTED', 'CONTACTED'],
    ['QUALIFIED', 'QUALIFIED'],
  ] as const)('rejects backward or same active transition %s to %s', async (source, target) => {
    const lead = await createLead(source);
    await request(app).post(`/api/v1/crm/leads/${lead.id}/advance-status`).set(auth()).send({ status: target }).expect(400);
  });

  it.each(['NEW', 'LOST', 'UNQUALIFIED', 'CONVERTED'])('rejects invalid advance target %s', async (target) => {
    const lead = await createLead('NEW');
    await request(app).post(`/api/v1/crm/leads/${lead.id}/advance-status`).set(auth()).send({ status: target }).expect(400);
  });

  it.each([
    ['LOST', 'CONTACTED'], ['LOST', 'QUALIFIED'],
    ['UNQUALIFIED', 'CONTACTED'], ['UNQUALIFIED', 'QUALIFIED'],
    ['CONVERTED', 'CONTACTED'], ['CONVERTED', 'QUALIFIED'],
  ] as const)('rejects active progression from terminal %s status', async (source, target) => {
    const lead = await createLead(source);
    await request(app).post(`/api/v1/crm/leads/${lead.id}/advance-status`).set(auth()).send({ status: target }).expect(400);
  });

  it.each(['NEW', 'CONTACTED', 'QUALIFIED'] as const)('marks %s lead lost only with a nonblank reason', async (status) => {
    const lead = await createLead(status);
    await request(app).post(`/api/v1/crm/leads/${lead.id}/mark-lost`).set(auth()).send({ reason: '   ' }).expect(400);
    const res = await request(app).post(`/api/v1/crm/leads/${lead.id}/mark-lost`).set(auth()).send({ reason: '  Chose competitor  ' });
    expect(res.status).toBe(200);
    expect(res.body.data.lead).toMatchObject({ status: 'LOST', lostReason: 'Chose competitor' });
    expect(res.body.data.lead.lostAt).toBeTruthy();
    const audit = await prisma.auditLog.findFirst({ where: { resourceId: lead.id, action: 'MARK_LOST' } });
    expect(audit?.newValues).toMatchObject({ status: 'LOST', lostReason: 'Chose competitor' });
  });

  it('reopens lost leads only with a reason and clears current loss metadata', async () => {
    const lead = await createLead('LOST');
    await request(app).post(`/api/v1/crm/leads/${lead.id}/reopen`).set(auth()).send({ reason: '' }).expect(400);
    const res = await request(app).post(`/api/v1/crm/leads/${lead.id}/reopen`).set(auth()).send({ reason: 'Renewed interest' });
    expect(res.status).toBe(200);
    expect(res.body.data.lead).toMatchObject({ status: 'NEW', lostAt: null, lostReason: null });
    const audit = await prisma.auditLog.findFirst({ where: { resourceId: lead.id, action: 'REOPEN' } });
    expect(audit?.newValues).toMatchObject({ status: 'NEW', reopenReason: 'Renewed interest' });
  });

  it('marks active leads unqualified and allows reopening only from terminal non-converted states', async () => {
    const active = await createLead('CONTACTED');
    const marked = await request(app).post(`/api/v1/crm/leads/${active.id}/mark-unqualified`).set(auth()).send({});
    expect(marked.status).toBe(200);
    expect(marked.body.data.lead.status).toBe('UNQUALIFIED');
    await request(app).post(`/api/v1/crm/leads/${active.id}/reopen`).set(auth()).send({ reason: 'New information' }).expect(200);

    const converted = await createLead('CONVERTED');
    await request(app).post(`/api/v1/crm/leads/${converted.id}/mark-lost`).set(auth()).send({ reason: 'No' }).expect(400);
    await request(app).post(`/api/v1/crm/leads/${converted.id}/mark-unqualified`).set(auth()).send({}).expect(400);
    await request(app).post(`/api/v1/crm/leads/${converted.id}/reopen`).set(auth()).send({ reason: 'No' }).expect(400);
    const normalEdit = await request(app).patch(`/api/v1/crm/leads/${converted.id}`).set(auth()).send({ remark: 'Still editable after conversion' });
    expect(normalEdit.status).toBe(200);

    const activeLead = await createLead('NEW');
    await request(app).post(`/api/v1/crm/leads/${activeLead.id}/reopen`).set(auth()).send({ reason: 'Not terminal' }).expect(400);
    const lost = await createLead('LOST');
    await request(app).post(`/api/v1/crm/leads/${lost.id}/mark-lost`).set(auth()).send({ reason: 'Again' }).expect(400);
    await request(app).post(`/api/v1/crm/leads/${lost.id}/mark-unqualified`).set(auth()).send({}).expect(400);
    const unqualified = await createLead('UNQUALIFIED');
    await request(app).post(`/api/v1/crm/leads/${unqualified.id}/mark-lost`).set(auth()).send({ reason: 'Again' }).expect(400);
    await request(app).post(`/api/v1/crm/leads/${unqualified.id}/mark-unqualified`).set(auth()).send({}).expect(400);
  });
});
