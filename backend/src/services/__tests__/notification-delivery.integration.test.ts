process.env.NOTIFICATION_QUEUE_ENABLED = 'false';

import prisma from '../../utils/prisma';
import {
  deliverNotification,
  publishDomainEvent,
} from '../notification.service';
import { sendEmail, renderTemplate } from '../email.service';
import { pushToUser } from '../../utils/sseClients';

jest.mock('../email.service', () => ({
  sendEmail: jest.fn(),
  renderTemplate: jest.fn((template: string, vars: Record<string, string>) =>
    template.replace(/\{\{(\w+)\}\}/g, (_match, key) => vars[key] ?? ''),
  ),
}));

jest.mock('../../utils/sseClients', () => ({
  pushToUser: jest.fn(),
}));

jest.mock('../../controllers/systemSetting.controller', () => ({
  registerEmailEnabledCacheInvalidator: jest.fn(),
}));

const db = prisma as any;
const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const roleName = `TASK18_NOTIFY_ROLE_${suffix}`;
const hrCode = `TASK18_HR_${suffix}`.slice(0, 50);
const itCode = `TASK18_IT_${suffix}`.slice(0, 50);
const hrEmail = `task18-hr-${suffix}@test.local`;
const itEmail = `task18-it-${suffix}@test.local`;

let roleId: string;
let hrDepartmentId: string;
let itDepartmentId: string;
let hrUserId: string;
let itUserId: string;

async function cleanupEvent(eventKey: string) {
  await db.notification.deleteMany({ where: { delivery: { event: { eventKey } } } }).catch(() => {});
  await db.notificationDelivery.deleteMany({ where: { event: { eventKey } } }).catch(() => {});
  await db.notificationDomainEvent.deleteMany({ where: { eventKey } }).catch(() => {});
}

describe('notification durable delivery pipeline', () => {
  beforeAll(async () => {
    const role = await prisma.role.create({ data: { name: roleName, description: 'Task 18 notification delivery test role' } });
    roleId = role.id;

    const [hrDepartment, itDepartment] = await Promise.all([
      prisma.department.create({ data: { tenantId: TEST_TENANT_ID, code: hrCode, name: `Task18 HR ${suffix}` } }),
      prisma.department.create({ data: { tenantId: TEST_TENANT_ID, code: itCode, name: `Task18 IT ${suffix}` } }),
    ]);
    hrDepartmentId = hrDepartment.id;
    itDepartmentId = itDepartment.id;

    const [hrUser, itUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: hrEmail,
          tenantId: TEST_TENANT_ID,
          passwordHash: 'test-hash',
          firstName: 'HR',
          lastName: 'Recipient',
          isActive: true,
        },
      }),
      prisma.user.create({
        data: {
          email: itEmail,
          tenantId: TEST_TENANT_ID,
          passwordHash: 'test-hash',
          firstName: 'IT',
          lastName: 'Recipient',
          isActive: true,
        },
      }),
    ]);
    hrUserId = hrUser.id;
    itUserId = itUser.id;

    await Promise.all([
      prisma.departmentMembership.create({ data: { tenantId: TEST_TENANT_ID, departmentId: hrDepartmentId, userId: hrUserId, roleId } }),
      prisma.departmentMembership.create({ data: { tenantId: TEST_TENANT_ID, departmentId: itDepartmentId, userId: itUserId, roleId } }),
    ]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (sendEmail as jest.Mock).mockResolvedValue(true);
    (renderTemplate as jest.Mock).mockImplementation((template: string, vars: Record<string, string>) =>
      template.replace(/\{\{(\w+)\}\}/g, (_match, key) => vars[key] ?? ''),
    );
  });

  afterAll(async () => {
    await db.notification.deleteMany({ where: { userId: { in: [hrUserId, itUserId].filter(Boolean) } } }).catch(() => {});
    await db.notificationDelivery.deleteMany({ where: { recipientId: { in: [hrUserId, itUserId].filter(Boolean) } } }).catch(() => {});
    await db.notificationDomainEvent.deleteMany({ where: { eventKey: { startsWith: `task18:${suffix}` } } }).catch(() => {});
    await prisma.departmentMembership.deleteMany({ where: { userId: { in: [hrUserId, itUserId].filter(Boolean) } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { in: [hrEmail, itEmail] } } }).catch(() => {});
    await prisma.department.deleteMany({ where: { id: { in: [hrDepartmentId, itDepartmentId].filter(Boolean) } } }).catch(() => {});
    await prisma.role.deleteMany({ where: { id: roleId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('deduplicates a repeated domain event into one in-app delivery row per recipient/channel', async () => {
    const eventKey = `task18:${suffix}:duplicate`;
    await cleanupEvent(eventKey);

    await prisma.$transaction((tx) => publishDomainEvent(tx, {
      eventKey,
      tenantId: TEST_TENANT_ID,
      eventType: 'TASK18_DUPLICATE',
      classification: 'INTERNAL',
      resourceType: 'request',
      payload: { variables: { subject: 'Duplicate' } },
      recipientIds: [hrUserId],
      channels: ['IN_APP'],
    }));
    await prisma.$transaction((tx) => publishDomainEvent(tx, {
      eventKey,
      tenantId: TEST_TENANT_ID,
      eventType: 'TASK18_DUPLICATE',
      classification: 'INTERNAL',
      resourceType: 'request',
      payload: { variables: { subject: 'Duplicate' } },
      recipientIds: [hrUserId],
      channels: ['IN_APP'],
    }));

    const deliveries = await db.notificationDelivery.findMany({ where: { event: { eventKey }, recipientId: hrUserId, channel: 'IN_APP' } });
    expect(deliveries).toHaveLength(1);
  });

  it('keeps provider failure retryable instead of marking delivery successful', async () => {
    const eventKey = `task18:${suffix}:retry`;
    await cleanupEvent(eventKey);
    await prisma.systemSetting.upsert({
      where: { key: 'email_notifications_enabled' },
      update: { value: 'true' },
      create: { key: 'email_notifications_enabled', value: 'true' },
    });
    (sendEmail as jest.Mock).mockResolvedValue(false);

    const result = await prisma.$transaction((tx) => publishDomainEvent(tx, {
      eventKey,
      tenantId: TEST_TENANT_ID,
      eventType: 'TASK18_RETRY',
      classification: 'INTERNAL',
      resourceType: 'request',
      payload: { variables: { userName: 'HR Recipient' } },
      recipientIds: [hrUserId],
      channels: ['EMAIL'],
    }));

    await deliverNotification(result.deliveryIds[0]);

    const delivery = await db.notificationDelivery.findUnique({ where: { id: result.deliveryIds[0] } });
    const notificationCount = await prisma.notification.count({ where: { deliveryId: result.deliveryIds[0] } as any });
    expect(delivery.status).toBe('RETRYING');
    expect(delivery.attemptCount).toBe(1);
    expect(delivery.nextAttemptAt).toBeTruthy();
    expect(notificationCount).toBe(0);
  });

  it('does not materialize HR-confidential content for an IT recipient', async () => {
    const eventKey = `task18:${suffix}:leakage`;
    await cleanupEvent(eventKey);

    const result = await prisma.$transaction((tx) => publishDomainEvent(tx, {
      eventKey,
      tenantId: TEST_TENANT_ID,
      departmentId: hrDepartmentId,
      eventType: 'TASK18_HR_CONFIDENTIAL',
      classification: 'HR_CONFIDENTIAL',
      resourceType: 'request',
      payload: { variables: { secret: 'salary-data' } },
      recipientIds: [hrUserId, itUserId],
      channels: ['IN_APP'],
    }));

    expect(result.deliveryIds).toHaveLength(1);
    const deliveries = await db.notificationDelivery.findMany({ where: { event: { eventKey } } });
    expect(deliveries.map((delivery: any) => delivery.recipientId)).toEqual([hrUserId]);
    expect(deliveries.some((delivery: any) => delivery.recipientId === itUserId)).toBe(false);
  });

  it('commits inbox state before SSE wake-up so cursor replay can recover missed rows', async () => {
    const eventKey = `task18:${suffix}:replay`;
    await cleanupEvent(eventKey);

    const result = await prisma.$transaction((tx) => publishDomainEvent(tx, {
      eventKey,
      tenantId: TEST_TENANT_ID,
      eventType: 'TASK18_REPLAY',
      classification: 'INTERNAL',
      resourceType: 'request',
      payload: { variables: { foo: 'bar' } },
      recipientIds: [hrUserId],
      channels: ['IN_APP'],
    }));

    await deliverNotification(result.deliveryIds[0]);

    expect(pushToUser).toHaveBeenCalledWith(hrUserId, 'notification', expect.objectContaining({ cursor: expect.any(String) }));
    const wakeup = (pushToUser as jest.Mock).mock.calls[0][2];
    const persisted = await prisma.notification.findFirst({ where: { id: wakeup.cursor, userId: hrUserId, channel: 'IN_APP' } });
    expect(persisted).toBeTruthy();
  });
});
