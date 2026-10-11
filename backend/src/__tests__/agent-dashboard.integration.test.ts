import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { config } from '../config';
import { runWithExecutionScope } from '../lib/execution-scope';
import { tokenService } from '../services/token.service';
import { permissionService } from '../services/permission.service';
import requestRoutes from '../routes/request.routes';
import { errorHandler } from '../middleware/error.middleware';

const FIXTURE_DATABASE = 'help_center_test';
const runFixture = process.env.AGENT_DASHBOARD_FIXTURE_DB === FIXTURE_DATABASE ? describe : describe.skip;
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const team = `IT-${suffix.slice(-6).toUpperCase()}`;
const app = express();
app.set('json replacer', (_key: string, value: unknown) => typeof value === 'bigint' ? Number(value) : value);
app.use(express.json());
app.use('/api/v1/requests', requestRoutes);
app.use(errorHandler);

runFixture('GET /api/v1/requests/agent-dashboard mounted authorization integration', () => {
  let tenantA: string;
  let tenantB: string;
  let agentId: string;
  let endUserId: string;
  let roleAgentId: string;
  let roleEndUserId: string;
  const deskIds: string[] = [];
  const categoryIds: string[] = [];
  const requestTypeIds: string[] = [];
  const userIds: string[] = [];
  const requestIds: Record<string, string> = {};
  let agentToken = '';
  let endUserToken = '';
  let permissionSpy: jest.SpyInstance;
  let revokedSpy: jest.SpyInstance;
  let revokedAtSpy: jest.SpyInstance;

  async function getOrCreateDesk(tenantId: string, code: string, name: string) {
    const existing = await prisma.serviceDesk.findFirst({ where: { tenantId, code } });
    if (existing) return existing;
    const desk = await prisma.serviceDesk.create({ data: { tenantId, name, code, isActive: true } });
    deskIds.push(desk.id);
    return desk;
  }

  async function createType(tenantId: string, deskId: string, name: string) {
    const category = await prisma.serviceCategory.create({
      data: { tenantId, serviceDeskId: deskId, name: `${name} Category ${suffix}` },
    });
    categoryIds.push(category.id);
    const type = await prisma.requestType.create({
      data: { tenantId, serviceCategoryId: category.id, name, code: `${suffix}-${requestTypeIds.length}` },
    });
    requestTypeIds.push(type.id);
    return type;
  }

  async function createUser(tenantId: string, emailPrefix: string, assignedTeam: string | null = null) {
    const user = await prisma.user.create({
      data: {
        tenantId, email: `${emailPrefix}-${suffix}@test.local`, passwordHash: 'fixture-not-for-login',
        firstName: emailPrefix, lastName: 'Dashboard Test', agentTeam: assignedTeam, isActive: true,
      },
    });
    userIds.push(user.id);
    return user;
  }

  async function createRequest(input: {
    key: string; tenantId: string; deskId: string; requestTypeId: string; requesterId: string;
    assignedToId?: string | null; confidential?: boolean; priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    assignedTeam?: string | null; dueAt?: Date | null;
  }) {
    const row = await prisma.request.create({
      data: {
        tenantId: input.tenantId, serviceDeskId: input.deskId, requestTypeId: input.requestTypeId,
        requesterId: input.requesterId, requesterEmail: `requester-${suffix}@test.local`,
        referenceNumber: `AUTH-${suffix.slice(-6)}-${input.key}`, summary: `Authorization fixture ${input.key}`,
        priority: input.priority ?? 'MEDIUM', status: 'IN_PROGRESS', assignedToId: input.assignedToId ?? null,
        assignedTeam: input.assignedTeam ?? null, isConfidential: input.confidential ?? false, tags: [],
        slaDueAt: input.dueAt ?? null,
      },
    });
    requestIds[input.key] = row.id;
    return row;
  }

  function tokenFor(userId: string, email: string, tenantId: string) {
    return jwt.sign({ userId, email, tenantId, jti: `dashboard-${suffix}-${userId}` }, config.jwt.secret, { expiresIn: '5m' });
  }

  beforeAll(async () => {
    const db = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    if (db[0]?.db !== FIXTURE_DATABASE) throw new Error(`Refusing fixture writes outside ${FIXTURE_DATABASE}`);

    permissionSpy = jest.spyOn(permissionService, 'getUserPermissions').mockResolvedValue([]);
    revokedSpy = jest.spyOn(tokenService, 'isJtiRevoked').mockResolvedValue(false);
    revokedAtSpy = jest.spyOn(tokenService, 'getUserRevocationTimestamp').mockResolvedValue(0);

    tenantA = (await prisma.tenant.create({ data: { name: `Dashboard API A ${suffix}`, slug: `dashboard-api-a-${suffix}` } })).id;
    tenantB = (await prisma.tenant.create({ data: { name: `Dashboard API B ${suffix}`, slug: `dashboard-api-b-${suffix}` } })).id;
    roleAgentId = (await prisma.role.create({ data: { name: 'AGENT', description: 'Dashboard integration fixture role' } })).id;
    roleEndUserId = (await prisma.role.create({ data: { name: 'END_USER', description: 'Dashboard integration fixture role' } })).id;

    await runWithExecutionScope({ kind: 'tenant', tenantId: tenantA }, async () => {
      const agent = await createUser(tenantA, 'dashboard-agent', team);
      agentId = agent.id;
      const endUser = await createUser(tenantA, 'dashboard-enduser');
      endUserId = endUser.id;
      const outsiderA = await createUser(tenantA, 'dashboard-outsider-a');
      const teamDesk = await getOrCreateDesk(tenantA, team, `Dashboard Team Desk ${suffix}`);
      const otherDesk = await getOrCreateDesk(tenantA, `OTHER-${suffix.slice(-6)}`, `Dashboard Other Desk ${suffix}`);
      const visibleType = await createType(tenantA, teamDesk.id, `Visible ${suffix}`);
      const personalType = await createType(tenantA, otherDesk.id, `Personal ${suffix}`);
      const hiddenType = await createType(tenantA, teamDesk.id, `SecretOnly ${suffix}`);
      const assignedType = await createType(tenantA, teamDesk.id, `PrivateAssigned ${suffix}`);
      const participantType = await createType(tenantA, teamDesk.id, `PrivateParticipant ${suffix}`);
      const approverType = await createType(tenantA, teamDesk.id, `PrivateApprover ${suffix}`);
      await prisma.userRole.createMany({ data: [
        { userId: agentId, roleId: roleAgentId },
        { userId: endUserId, roleId: roleEndUserId },
      ] });

      const duePast = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await createRequest({ key: 'team-public', tenantId: tenantA, deskId: teamDesk.id, requestTypeId: visibleType.id, requesterId: outsiderA.id, assignedTeam: team });
      await createRequest({ key: 'personal-cross-team', tenantId: tenantA, deskId: otherDesk.id, requestTypeId: personalType.id, requesterId: outsiderA.id, assignedToId: agentId, assignedTeam: `OTHER-${suffix.slice(-6)}` });
      await createRequest({ key: 'confidential-hidden', tenantId: tenantA, deskId: teamDesk.id, requestTypeId: hiddenType.id, requesterId: outsiderA.id, confidential: true, priority: 'CRITICAL', assignedTeam: team, dueAt: duePast });
      await createRequest({ key: 'confidential-assigned', tenantId: tenantA, deskId: teamDesk.id, requestTypeId: assignedType.id, requesterId: outsiderA.id, assignedToId: agentId, confidential: true });
      await createRequest({ key: 'confidential-owner', tenantId: tenantA, deskId: otherDesk.id, requestTypeId: personalType.id, requesterId: agentId, confidential: true, assignedTeam: `OTHER-${suffix.slice(-6)}` });
      const participantRequest = await createRequest({ key: 'confidential-participant', tenantId: tenantA, deskId: teamDesk.id, requestTypeId: participantType.id, requesterId: outsiderA.id, confidential: true, assignedTeam: team });
      const approverRequest = await createRequest({ key: 'confidential-approver', tenantId: tenantA, deskId: teamDesk.id, requestTypeId: approverType.id, requesterId: outsiderA.id, confidential: true, assignedTeam: team });
      await prisma.requestParticipant.create({ data: { requestId: participantRequest.id, userId: agentId } });
      await prisma.requestApproval.create({ data: { requestId: approverRequest.id, approverType: 'CFO', approverId: agentId } });
    });

    await runWithExecutionScope({ kind: 'tenant', tenantId: tenantB }, async () => {
      const outsiderB = await createUser(tenantB, 'dashboard-outsider-b');
      const desk = await getOrCreateDesk(tenantB, team, `Other Tenant Desk ${suffix}`);
      const type = await createType(tenantB, desk.id, `OtherTenantType ${suffix}`);
      await createRequest({ key: 'other-tenant', tenantId: tenantB, deskId: desk.id, requestTypeId: type.id, requesterId: outsiderB.id, priority: 'CRITICAL', assignedTeam: team, dueAt: new Date(Date.now() - 24 * 60 * 60 * 1000) });
    });

    agentToken = tokenFor(agentId, `dashboard-agent-${suffix}@test.local`, tenantA);
    endUserToken = tokenFor(endUserId, `dashboard-enduser-${suffix}@test.local`, tenantA);
  }, 60_000);

  afterAll(async () => {
    permissionSpy?.mockRestore();
    revokedSpy?.mockRestore();
    revokedAtSpy?.mockRestore();
    for (const tenantId of [tenantA, tenantB]) {
      if (!tenantId) continue;
      await runWithExecutionScope({ kind: 'tenant', tenantId }, async () => {
        await prisma.request.deleteMany({ where: { tenantId } });
        for (const id of requestTypeIds) await prisma.requestType.deleteMany({ where: { id } });
        for (const id of categoryIds) await prisma.serviceCategory.deleteMany({ where: { id } });
        for (const id of deskIds) await prisma.serviceDesk.deleteMany({ where: { id } });
        for (const id of userIds) await prisma.user.deleteMany({ where: { id } });
      });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
    if (roleAgentId) await prisma.role.deleteMany({ where: { id: roleAgentId } });
    if (roleEndUserId) await prisma.role.deleteMany({ where: { id: roleEndUserId } });
  }, 60_000);

  it('allows an agent without report:read and keeps every response section tenant/confidentiality scoped', async () => {
    const response = await request(app)
      .get('/api/v1/requests/agent-dashboard?scope=team&queue=all&page=1&limit=25&sort=urgency')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(response.status).toBe(200);
    const data = response.body.data;
    expect(data.pagination.total).toBe(5);
    expect(data.queueCounts.all).toBe(5);
    expect(data.requestTypes.map((type: { name: string }) => type.name)).not.toContain(`OtherTenantType ${suffix}`);
    expect(data.requestTypes.map((type: { name: string }) => type.name)).not.toContain(`SecretOnly ${suffix}`);
    expect(data.tickets.map((ticket: { id: string }) => ticket.id).sort()).toEqual([
      requestIds['team-public'], requestIds['personal-cross-team'], requestIds['confidential-assigned'],
      requestIds['confidential-participant'], requestIds['confidential-approver'],
    ].sort());
    expect(data.metrics.breached).toBe(0);
    expect(data.attention.total).toBe(0);
  });

  it('preserves My work for personal cross-team assignments and keeps Unassigned team scope working', async () => {
    const mine = await request(app)
      .get('/api/v1/requests/agent-dashboard?scope=mine&queue=open&page=1&limit=25&sort=urgency')
      .set('Authorization', `Bearer ${agentToken}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data.tickets.map((ticket: { id: string }) => ticket.id).sort()).toEqual([
      requestIds['personal-cross-team'], requestIds['confidential-assigned'],
    ].sort());

    const unassigned = await request(app)
      .get('/api/v1/requests/agent-dashboard?scope=team&queue=unassigned&page=1&limit=25&sort=urgency')
      .set('Authorization', `Bearer ${agentToken}`);
    expect(unassigned.status).toBe(200);
    expect(unassigned.body.data.tickets.map((ticket: { id: string }) => ticket.id).sort()).toEqual([
      requestIds['team-public'], requestIds['confidential-participant'], requestIds['confidential-approver'],
    ].sort());
  });

  it('denies end users, admin-only scope tampering, invalid queries, and export without permission', async () => {
    const endUser = await request(app)
      .get('/api/v1/requests/agent-dashboard?scope=mine&queue=open')
      .set('Authorization', `Bearer ${endUserToken}`);
    expect(endUser.status).toBe(403);

    const tampered = await request(app)
      .get('/api/v1/requests/agent-dashboard?scope=accessible&queue=all')
      .set('Authorization', `Bearer ${agentToken}`);
    expect(tampered.status).toBe(403);

    const invalid = await request(app)
      .get('/api/v1/requests/agent-dashboard?page=not-a-number')
      .set('Authorization', `Bearer ${agentToken}`);
    expect(invalid.status).toBe(400);

    const exportAttempt = await request(app)
      .post('/api/v1/requests/export/xlsx')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ requestIds: [requestIds['team-public']] });
    expect(exportAttempt.status).toBe(403);
  });
});
