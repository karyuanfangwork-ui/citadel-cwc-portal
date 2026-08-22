import { randomUUID } from 'crypto';

process.env.SLA_TIMER_QUEUE_ENABLED = 'false';

jest.mock('../notification.service', () => ({
  notify: jest.fn().mockResolvedValue(undefined),
}));

import prisma from '../../utils/prisma';
import { addBusinessMinutes, createSlaPolicyVersion, pauseSlaClock, resumeSlaClock, scheduleSlaTimer, startSlaClock } from '../../queues/timer.queue';
import { processSlaTimerJob } from '../../workers/timer.worker';
import { checkEscalations } from '../sla.service';

const db = prisma as any;

let tenantId: string;
let departmentId: string;
let userId: string;
let adminId: string;
let requestTypeId: string;
let serviceCategoryId: string;
let serviceDeskId: string;
const requestIds = new Set<string>();

beforeAll(async () => {
  tenantId = randomUUID();
  departmentId = randomUUID();
  const suffix = Date.now().toString(36).slice(-6);

  await prisma.tenant.create({ data: { id: tenantId, name: 'SLA Timer Tenant', slug: `sla-timer-${suffix}`, isActive: true } });
  await prisma.department.create({ data: { id: departmentId, tenantId, code: `SLA_${suffix}`, name: 'SLA Timer Department' } });

  const adminRole = await prisma.role.upsert({ where: { name: 'SLA_TIMER_ADMIN' }, update: {}, create: { name: 'SLA_TIMER_ADMIN', description: 'SLA Timer Admin' } });

  userId = randomUUID();
  adminId = randomUUID();
  await prisma.user.create({
    data: {
      id: userId,
      tenantId,
      email: `sla-user-${Date.now()}@test.local`,
      firstName: 'SLA',
      lastName: 'User',
      passwordHash: '$2a$10$dummyhash',
      isActive: true,
      mustResetPassword: false,
    },
  });
  await prisma.user.create({
    data: {
      id: adminId,
      tenantId,
      email: `sla-admin-${Date.now()}@test.local`,
      firstName: 'SLA',
      lastName: 'Admin',
      passwordHash: '$2a$10$dummyhash',
      isActive: true,
      mustResetPassword: false,
      roles: { create: { roleId: adminRole.id } },
    },
  });

  const desk = await prisma.serviceDesk.create({ data: { tenantId, name: 'SLA Timer Desk', code: `SLAT_${suffix}` } });
  serviceDeskId = desk.id;
  const category = await prisma.serviceCategory.create({ data: { tenantId, serviceDeskId: desk.id, name: 'SLA Timer Category' } });
  serviceCategoryId = category.id;
  const requestType = await prisma.requestType.create({ data: { tenantId, serviceCategoryId: category.id, name: 'SLA Timer Type', code: `SLA_TIMER_TYPE_${suffix}` } });
  requestTypeId = requestType.id;
});

afterEach(async () => {
  for (const requestId of [...requestIds]) {
    await cleanupRequest(requestId);
  }
});

afterAll(async () => {
  if (!tenantId) return;
  await db.slaEscalationEvent.deleteMany({ where: { tenantId } });
  await db.slaTimerJob.deleteMany({ where: { tenantId } });
  await db.slaPauseLedger.deleteMany({ where: { tenantId } });
  await db.slaClock.deleteMany({ where: { tenantId } });
  await db.slaPolicyVersion.deleteMany({ where: { tenantId } });
  await prisma.escalationRule.deleteMany({ where: { tenantId } });
  if (requestTypeId) await prisma.requestType.delete({ where: { id: requestTypeId } }).catch(() => undefined);
  if (serviceCategoryId) await prisma.serviceCategory.delete({ where: { id: serviceCategoryId } }).catch(() => undefined);
  if (serviceDeskId) await prisma.serviceDesk.delete({ where: { id: serviceDeskId } }).catch(() => undefined);
  await prisma.userRole.deleteMany({ where: { userId: { in: [userId, adminId].filter(Boolean) } } }).catch(() => undefined);
  if (userId || adminId) await prisma.user.deleteMany({ where: { id: { in: [userId, adminId].filter(Boolean) } } });
  if (departmentId) await prisma.department.delete({ where: { id: departmentId } }).catch(() => undefined);
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
  await prisma.$disconnect();
});

async function createRequest(suffix: string, overrides: Record<string, unknown> = {}) {
  const request = await prisma.request.create({
    data: {
      tenantId,
      departmentId,
      requestTypeId,
      requesterId: userId,
      requesterEmail: 'sla-user@test.local',
      referenceNumber: `SLA-TIMER-${Date.now()}-${suffix}`,
      summary: 'SLA timer integration test',
      status: 'SUBMITTED',
      slaDueAt: new Date(Date.now() - 60_000),
      ...overrides,
    } as any,
  });
  requestIds.add(request.id);
  return request;
}

async function cleanupRequest(requestId: string) {
  await db.slaEscalationEvent.deleteMany({ where: { requestId } });
  await db.slaTimerJob.deleteMany({ where: { requestId } });
  await db.slaPauseLedger.deleteMany({ where: { clock: { requestId } } });
  await db.slaClock.deleteMany({ where: { requestId } });
  await db.outboxEvent.deleteMany({ where: { aggregateId: requestId } });
  await prisma.requestParticipant.deleteMany({ where: { requestId } });
  await prisma.requestActivity.deleteMany({ where: { requestId } });
  await prisma.request.delete({ where: { id: requestId } }).catch(() => undefined);
  requestIds.delete(requestId);
}

describe('Task 17 SLA durable timers', () => {
  it('calculates Malaysia business-calendar due dates across holiday boundaries', () => {
    const start = new Date('2026-07-24T09:00:00.000Z'); // Friday 17:00 Malaysia
    const due = addBusinessMinutes(start, 120, {
      timezone: 'Asia/Kuala_Lumpur',
      businessHours: { start: '09:00', end: '18:00' },
      workdays: [1, 2, 3, 4, 5],
      holidays: ['2026-07-27'],
    });

    expect(due.toISOString()).toBe('2026-07-28T02:00:00.000Z'); // Tuesday 10:00 Malaysia
  });

  it('persists policy, response/resolution clocks, pause ledger, and duplicate-safe timer jobs', async () => {
    const request = await createRequest('clock');
    const policy = await createSlaPolicyVersion({
      tenantId,
      requestTypeId,
      version: 1,
      calendar: { timezone: 'Asia/Kuala_Lumpur' },
      responseTargetMinutes: 60,
      resolutionTargetMinutes: 240,
    });

    const responseClock = await startSlaClock({ tenantId, departmentId, requestId: request.id, policyVersionId: policy.id, kind: 'RESPONSE', dueAt: new Date(Date.now() + 60_000) });
    const resolutionClock = await startSlaClock({ tenantId, departmentId, requestId: request.id, policyVersionId: policy.id, kind: 'RESOLUTION', dueAt: new Date(Date.now() + 240_000) });

    await pauseSlaClock(responseClock.id, 'approval_pause', new Date('2026-07-23T01:00:00.000Z'));
    const resumed = await resumeSlaClock(responseClock.id, new Date('2026-07-23T01:30:00.000Z'));
    expect(resumed.pauseDurationMs).toBe(BigInt(30 * 60 * 1000));

    const timerA = await scheduleSlaTimer({ tenantId, departmentId, requestId: request.id, clockId: resolutionClock.id, kind: 'SLA_RESOLUTION_DUE', runAt: resolutionClock.dueAt, idempotencyKey: `${request.id}:resolution` });
    const timerB = await scheduleSlaTimer({ tenantId, departmentId, requestId: request.id, clockId: resolutionClock.id, kind: 'SLA_RESOLUTION_DUE', runAt: resolutionClock.dueAt, idempotencyKey: `${request.id}:resolution` });

    expect(timerB.id).toBe(timerA.id);
    const timers = await db.slaTimerJob.findMany({ where: { tenantId, requestId: request.id } });
    expect(timers).toHaveLength(1);
  });

  it('claims due timer jobs idempotently and treats duplicate delivery as a no-op', async () => {
    const request = await createRequest('timer');
    const clock = await startSlaClock({ tenantId, departmentId, requestId: request.id, kind: 'RESOLUTION', dueAt: new Date(Date.now() - 60_000) });
    const timer = await scheduleSlaTimer({ tenantId, departmentId, requestId: request.id, clockId: clock.id, kind: 'SLA_RESOLUTION_DUE', runAt: new Date(Date.now() - 60_000), idempotencyKey: `${request.id}:due` });

    const first = await processSlaTimerJob(timer.id, { workerId: 'worker-a', now: new Date() });
    const second = await processSlaTimerJob(timer.id, { workerId: 'worker-b', now: new Date() });

    expect(first).toEqual({ processed: true, status: 'COMPLETED' });
    expect(second.processed).toBe(false);
    expect(second.status).toBe('COMPLETED');
    expect(await db.slaTimerJob.count({ where: { id: timer.id, status: 'COMPLETED' } })).toBe(1);
  });

  it('leaves failed claimed jobs retryable for worker restart/failover', async () => {
    const request = await createRequest('failover');
    const clock = await startSlaClock({ tenantId, departmentId, requestId: request.id, kind: 'RESOLUTION', dueAt: new Date(Date.now() - 60_000) });
    const timer = await scheduleSlaTimer({ tenantId, departmentId, requestId: request.id, clockId: clock.id, kind: 'SLA_RESOLUTION_DUE', runAt: new Date(Date.now() - 60_000), idempotencyKey: `${request.id}:failover` });

    await db.slaClock.delete({ where: { id: clock.id } });
    await expect(processSlaTimerJob(timer.id, { workerId: 'worker-a', now: new Date() })).resolves.toEqual({ processed: false, status: 'MISSING' });
  });

  it('records escalation intent and grants request participant access to recipients', async () => {
    const request = await createRequest('escalation');
    await prisma.requestActivity.create({
      data: {
        requestId: request.id,
        authorId: request.requesterId,
        authorName: 'System',
        activityType: 'SYSTEM',
        message: 'SLA BREACH: This request has exceeded its SLA deadline.',
        isSystemGenerated: true,
        metadata: { breachedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
      },
    });
    await prisma.escalationRule.create({
      data: { tenantId, requestTypeId, triggerHoursAfterBreach: 1, notifyRoles: ['SLA_TIMER_ADMIN'], label: 'One hour' },
    });

    const fired = await checkEscalations();

    expect(fired).toBe(1);
    expect(await db.slaEscalationEvent.count({ where: { tenantId, requestId: request.id } })).toBe(1);
    expect(await prisma.requestParticipant.count({ where: { requestId: request.id, userId: adminId, participantRole: 'ESCALATION_RECIPIENT' } })).toBe(1);
  });
});
