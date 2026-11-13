import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import app from '../app';
import prisma from '../utils/prisma';
import { config } from '../config';
import { withDatabaseScope } from '../lib/database-scope';
import { executeWorkflowCommand } from '../services/workflowCommand.service';

// Explicit opt-in: never run fixture writes against the restored help_center DB.
const isolated = process.env.HR_EXECUTIVE_INTEGRATION_TEST === '1';
const describeIsolated = isolated ? describe : describe.skip;

describeIsolated('isolated HR executive HTTP journey', () => {
  let tenantId: string;
  let departmentId: string;
  let deskId: string;
  let typeId: string;
  let workflowId: string;
  let originalLifecycleStatus: 'DRAFT' | 'PUBLISHED' | 'DEPRECATED' | 'RETIRED';
  let requester: any;
  let agent: any;
  let ceo: any;
  let dceo: any;
  const requestIds: string[] = [];
  const transitionIds: string[] = [];
  const auth = (user: { id: string; email: string }) => `Bearer ${jwt.sign({ userId: user.id, email: user.email, jti: crypto.randomUUID() }, config.jwt.secret, { expiresIn: '1h' })}`;

  beforeAll(async () => {
    const database = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
    if (database[0]?.name !== 'help_center_test') throw new Error('Integration fixtures require exact help_center_test DB');
    const type = await prisma.requestType.findFirstOrThrow({ where: { code: 'NEW_HIRING' }, include: { serviceCategory: { include: { serviceDesk: true } } } });
    typeId = type.id;
    originalLifecycleStatus = type.lifecycleStatus;
    workflowId = type.workflowTypeId!;
    deskId = type.serviceCategory.serviceDesk.id;
    tenantId = type.serviceCategory.serviceDesk.tenantId!;
    departmentId = type.serviceCategory.serviceDesk.departmentId!;
    requester = await prisma.user.findFirstOrThrow({ where: { tenantId, isActive: true, roles: { some: { role: { name: 'HIRING_MANAGER' } } }, executiveRole: null }, select: { id: true, email: true } });
    agent = await prisma.user.findFirstOrThrow({ where: { tenantId, isActive: true, agentTeam: 'HR', roles: { some: { role: { name: 'AGENT' } } } }, select: { id: true, email: true } });
    ceo = await prisma.user.findFirstOrThrow({ where: { tenantId, isActive: true, roles: { some: { role: { name: 'CEO' } } } }, select: { id: true, email: true } });
    dceo = await prisma.user.findFirstOrThrow({ where: { tenantId, isActive: true, roles: { some: { role: { name: 'GROUP_DCEO' } } } }, select: { id: true, email: true } });
    for (const [fromStatus, toStatus, allowedRoles, requiresComment] of [
      ['SUBMITTED', 'PENDING_CEO_APPROVAL', ['AGENT', 'ADMIN'], false],
      ['SUBMITTED', 'PENDING_GROUP_DCEO_APPROVAL', ['AGENT', 'ADMIN'], false],
      ['PENDING_CEO_APPROVAL', 'CEO_APPROVED', ['CEO'], false],
      ['PENDING_CEO_APPROVAL', 'CEO_REJECTED', ['CEO'], true],
      ['PENDING_GROUP_DCEO_APPROVAL', 'GROUP_DCEO_APPROVED', ['GROUP_DCEO'], false],
      ['PENDING_GROUP_DCEO_APPROVAL', 'GROUP_DCEO_REJECTED', ['GROUP_DCEO'], true],
      ['CEO_APPROVED', 'JOB_POSTED', ['AGENT', 'ADMIN'], false],
      ['GROUP_DCEO_APPROVED', 'JOB_POSTED', ['AGENT', 'ADMIN'], false],
    ] as [string, string, string[], boolean][]) {
      const row = await prisma.workflowTransition.create({ data: { workflowTypeId: workflowId, fromStatus, toStatus, allowedRoles, requiresComment, transitionLabel: 'TEST_HR', isActive: true } });
      transitionIds.push(row.id);
    }
  });

  afterAll(async () => {
    if (!isolated || !tenantId) return;
    await prisma.workflowTransition.deleteMany({ where: { id: { in: transitionIds } } });
    for (const id of requestIds) {
      await withDatabaseScope({ tenantId, departmentIds: [departmentId], actorId: agent.id }, async tx => {
        await tx.outboxEvent.deleteMany({ where: { aggregateId: id } });
        await tx.request.delete({ where: { id } });
      });
    }
    if (typeId) await prisma.requestType.update({ where: { id: typeId }, data: { lifecycleStatus: originalLifecycleStatus } });
  });

  async function createFixture(role?: 'CEO' | 'GROUP_DCEO') {
    const ref = `HR-TEST-${crypto.randomUUID()}`;
    const row = await withDatabaseScope({ tenantId, departmentIds: [departmentId], actorId: requester.id }, tx => tx.request.create({ data: {
      tenantId, departmentId, referenceNumber: ref, requestTypeId: typeId, serviceDeskId: deskId,
      requesterId: requester.id, requesterEmail: requester.email, summary: 'Disposable HR choice fixture',
      status: 'SUBMITTED', assignedToId: agent.id, assignedTeam: 'HR', tags: [],
      executiveApproverId: role ? (role === 'CEO' ? ceo.id : dceo.id) : null,
      executiveApproverRole: role ?? null,
    } }));
    requestIds.push(row.id);
    return row.id;
  }

  test('authenticated candidates and new submissions save the named choice without routing', async () => {
    const candidates = await request(app).get('/api/v1/users/eligible-executives').set('Authorization', auth(requester));
    expect(candidates.status).toBe(200);
    expect(candidates.body.data.executives).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: ceo.id, executiveApproverRole: 'CEO' }),
      expect.objectContaining({ id: dceo.id, executiveApproverRole: 'GROUP_DCEO' }),
    ]));
    await prisma.requestType.update({ where: { id: typeId }, data: { lifecycleStatus: 'PUBLISHED' } });
    for (const [role, selected] of [['CEO', ceo], ['GROUP_DCEO', dceo]] as const) {
      const payload = { serviceDeskId: deskId, requestTypeId: typeId, formVersion: 1,
        summary: 'Disposable new hiring', customFields: { position: 'Analyst', department: 'CG', headcount: 'Junior Executive', employmentType: 'Permanent' },
        executiveApproverId: selected.id, executiveApproverRole: role };
      const response = await request(app).post('/api/v1/requests').set('Authorization', auth(requester)).send(payload);
      expect(response.status).toBe(201);
      const id = response.body.data.request.id;
      requestIds.push(id);
      const saved = await prisma.request.findUniqueOrThrow({ where: { id }, include: { approvals: true, workflowHistory: true } });
      expect(saved).toMatchObject({ status: 'SUBMITTED', executiveApproverId: selected.id, executiveApproverRole: role, assignedTeam: 'HR' });
      expect(saved.approvals).toHaveLength(0);
      expect(saved.workflowHistory).toHaveLength(0);
    }
  });

  test.each(['CEO', 'GROUP_DCEO'] as const)('%s selection routes to exactly one pending approval and reaches job posting', async role => {
    const id = await createFixture();
    const selected = role === 'CEO' ? ceo : dceo;
    const target = role === 'CEO' ? 'route-to-ceo' : 'route-to-group-dceo-hr';
    const decisionTarget = role === 'CEO' ? 'ceo-decision' : 'group-dceo-decision-hr';
    const routeBody = role === 'CEO' ? { ceoId: selected.id } : { groupDceoId: selected.id };
    const before = await request(app).post(`/api/v1/approvals/requests/${id}/${target}`).set('Authorization', auth(agent)).send(routeBody);
    expect(before.status).toBe(409);
    expect((await prisma.requestApproval.count({ where: { requestId: id } }))).toBe(0);

    const choice = await request(app).put(`/api/v1/requests/${id}/executive-approver-choice`).set('Authorization', auth(requester))
      .send({ executiveApproverId: selected.id, executiveApproverRole: role, version: 1 });
    expect(choice.status).toBe(200);
    expect(choice.body.data.request.version).toBe(2);
    const other = role === 'CEO' ? dceo : ceo;
    const unauthorized = await request(app).post(`/api/v1/approvals/requests/${id}/${target}`).set('Authorization', auth(other)).send(routeBody);
    expect(unauthorized.status).toBe(403);
    const routed = await request(app).post(`/api/v1/approvals/requests/${id}/${target}`).set('Authorization', auth(agent)).send(routeBody);
    expect(routed.status).toBe(200);
    const state = await prisma.request.findUniqueOrThrow({ where: { id }, include: { approvals: true, workflowHistory: true } });
    expect(state.status).toBe(role === 'CEO' ? 'PENDING_CEO_APPROVAL' : 'PENDING_GROUP_DCEO_APPROVAL');
    expect(state.assignedToId).toBe(selected.id);
    expect(state.slaPausedAt).not.toBeNull();
    expect(state.approvals).toEqual([expect.objectContaining({ approverType: role, approverId: selected.id, status: 'PENDING' })]);
    expect(state.workflowHistory).toHaveLength(1);
    const queued = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: id, eventType: 'REQUEST_STATUS_CHANGED', aggregateVersion: state.version } });
    expect(queued.payload).toMatchObject({ hrExecutiveApproverId: selected.id, hrExecutiveApproverRole: role });
    const replay = await request(app).post(`/api/v1/approvals/requests/${id}/${target}`).set('Authorization', auth(agent)).send(routeBody);
    expect(replay.status).toBe(409);
    const denied = await request(app).post(`/api/v1/approvals/requests/${id}/${decisionTarget}`).set('Authorization', auth(other)).send({ decision: 'APPROVED' });
    expect(denied.status).toBe(403);
    const approved = await request(app).post(`/api/v1/approvals/requests/${id}/${decisionTarget}`).set('Authorization', auth(selected)).send({ decision: 'APPROVED' });
    expect(approved.status).toBe(200);
    const after = await prisma.request.findUniqueOrThrow({ where: { id }, include: { approvals: true, workflowHistory: true } });
    expect(after.status).toBe(role === 'CEO' ? 'CEO_APPROVED' : 'GROUP_DCEO_APPROVED');
    expect(after.assignedToId).toBe(agent.id);
    expect(after.slaPausedAt).toBeNull();
    expect(after.approvals).toHaveLength(1);
    expect(after.approvals[0].status).toBe('APPROVED');
    expect(after.workflowHistory).toHaveLength(2);
    const replayDecision = await request(app).post(`/api/v1/approvals/requests/${id}/${decisionTarget}`).set('Authorization', auth(selected)).send({ decision: 'APPROVED' });
    expect(replayDecision.status).toBe(409);
    const nonHrPosting = await request(app).post(`/api/v1/approvals/requests/${id}/mark-job-posted`).set('Authorization', auth(other)).send({ jobPostingUrl: 'https://example.test/job' });
    expect(nonHrPosting.status).toBe(403);
    const posted = await request(app).post(`/api/v1/approvals/requests/${id}/mark-job-posted`).set('Authorization', auth(agent)).send({ jobPostingUrl: 'https://example.test/job' });
    expect(posted.status).toBe(200);
    expect((await prisma.request.findUniqueOrThrow({ where: { id } })).status).toBe('JOB_POSTED');
  });

  test('a no-op approval mutation rolls the whole route command back', async () => {
    const id = await createFixture('CEO');
    await expect(withDatabaseScope({ tenantId, departmentIds: [departmentId], actorId: agent.id },
      () => executeWorkflowCommand({
        requestId: id, tenantId, fromStatus: 'SUBMITTED', toStatus: 'PENDING_CEO_APPROVAL',
        expectedVersion: 1, actorId: agent.id, actorName: 'HR Agent', source: 'hr-integration-rollback',
        requestPatch: { assignedToId: ceo.id }, transactionMutations: async () => {},
      }))).rejects.toMatchObject({ statusCode: 409 });
    const after = await prisma.request.findUniqueOrThrow({ where: { id }, include: { approvals: true, workflowHistory: true } });
    expect(after).toMatchObject({ status: 'SUBMITTED', version: 1, assignedToId: agent.id });
    expect(after.approvals).toHaveLength(0);
    expect(after.workflowHistory).toHaveLength(0);
    expect(await prisma.outboxEvent.count({ where: { aggregateId: id } })).toBe(0);
  });

  test.each(['CEO', 'GROUP_DCEO'] as const)('%s rejection returns to HR without another pending approver', async role => {
    const id = await createFixture(role);
    const selected = role === 'CEO' ? ceo : dceo;
    const target = role === 'CEO' ? 'route-to-ceo' : 'route-to-group-dceo-hr';
    const decisionTarget = role === 'CEO' ? 'ceo-decision' : 'group-dceo-decision-hr';
    const routeBody = role === 'CEO' ? { ceoId: selected.id } : { groupDceoId: selected.id };
    expect((await request(app).post(`/api/v1/approvals/requests/${id}/${target}`).set('Authorization', auth(agent)).send(routeBody)).status).toBe(200);
    expect((await request(app).post(`/api/v1/approvals/requests/${id}/${decisionTarget}`).set('Authorization', auth(selected)).send({ decision: 'REJECTED', comments: 'Insufficient justification' })).status).toBe(200);
    const after = await prisma.request.findUniqueOrThrow({ where: { id }, include: { approvals: true, workflowHistory: true } });
    expect(after).toMatchObject({ status: role === 'CEO' ? 'CEO_REJECTED' : 'GROUP_DCEO_REJECTED', assignedToId: agent.id });
    expect(after.approvals).toEqual([expect.objectContaining({ approverType: role, approverId: selected.id, status: 'REJECTED' })]);
    expect(after.workflowHistory).toHaveLength(2);
  });
});
