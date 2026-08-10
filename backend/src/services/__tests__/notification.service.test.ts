const mockPrisma = {
  $transaction: jest.fn((fn: any) => fn(mockPrisma)),
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  departmentMembership: {
    findMany: jest.fn(),
  },
  notificationDomainEvent: {
    upsert: jest.fn(),
  },
  notificationDelivery: {
    createMany: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  notification: {
    upsert: jest.fn(),
  },
  notificationTemplate: {
    findFirst: jest.fn(),
  },
  request: {
    findUnique: jest.fn(),
  },
  systemSetting: {
    findUnique: jest.fn(),
  },
};

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../email.service', () => ({
  sendEmail: jest.fn(),
  renderTemplate: jest.fn((template: string, vars: Record<string, string>) =>
    template.replace(/\{\{(\w+)\}\}/g, (_match, key) => vars[key] ?? ''),
  ),
}));

jest.mock('../../utils/sseClients', () => ({
  pushToUser: jest.fn(),
}));

jest.mock('../../config', () => ({
  config: { app: { url: 'http://localhost:3000' }, redis: { url: 'redis://localhost:6379' } },
}));

jest.mock('../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock('../../controllers/systemSetting.controller', () => ({
  registerEmailEnabledCacheInvalidator: jest.fn(),
}));

const {
  notify,
  notifyMultiple,
  publishDomainEvent,
  deliverNotification,
} = require('../notification.service');
const { sendEmail } = require('../email.service');
const { pushToUser } = require('../../utils/sseClients');
const { logger } = require('../../utils/logger');

describe('notification.service durable pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ tenantId: 'tenant-1', email: 'recipient@test.local' });
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1' }]);
    mockPrisma.departmentMembership.findMany.mockResolvedValue([{ userId: 'user-1' }]);
    mockPrisma.notificationDomainEvent.upsert.mockResolvedValue({ id: 'event-1' });
    mockPrisma.notificationDelivery.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.notificationDelivery.findMany.mockResolvedValue([{ id: 'delivery-in-app' }, { id: 'delivery-email' }]);
    mockPrisma.notificationDelivery.findUnique.mockImplementation(({ where }: any) => Promise.resolve({
      id: where.id,
      eventId: 'event-1',
      tenantId: 'tenant-1',
      recipientId: 'user-1',
      channel: where.id === 'delivery-email' ? 'EMAIL' : 'IN_APP',
      status: 'PENDING',
      attemptCount: 0,
      event: {
        id: 'event-1',
        eventKey: 'event-key',
        tenantId: 'tenant-1',
        departmentId: null,
        eventType: 'REQUEST_CREATED',
        classification: 'INTERNAL',
        resourceType: 'request',
        resourceId: null,
        payload: { variables: { custom: 'value' }, relatedRequestId: null, wrapInLayout: true },
      },
      recipient: { id: 'user-1', email: 'recipient@test.local', firstName: 'Jane', lastName: 'Doe', tenantId: 'tenant-1' },
      notification: null,
    }));
    mockPrisma.notificationDelivery.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.notificationTemplate.findFirst.mockResolvedValue({
      pushTitle: 'Hello {{userName}}',
      pushBody: 'Body {{custom}}',
      emailSubject: 'Email {{userName}}',
      emailBody: 'Email body {{custom}}',
    });
    mockPrisma.request.findUnique.mockResolvedValue(null);
    mockPrisma.systemSetting.findUnique.mockResolvedValue({ value: 'true' });
    mockPrisma.notification.upsert.mockResolvedValue({
      id: 'notification-1',
      subject: 'Hello Jane Doe',
      body: 'Body value',
      relatedRequestId: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    mockPrisma.notificationDelivery.update.mockResolvedValue({});
    (sendEmail as jest.Mock).mockResolvedValue(true);
  });

  it('publishDomainEvent creates an idempotent event and unique delivery rows', async () => {
    const result = await publishDomainEvent(mockPrisma, {
      eventKey: 'event-key',
      tenantId: 'tenant-1',
      eventType: 'REQUEST_CREATED',
      classification: 'INTERNAL',
      resourceType: 'request',
      payload: { variables: {} },
      recipientIds: ['user-1', 'user-1'],
      channels: ['IN_APP'],
    });

    expect(mockPrisma.notificationDomainEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId_eventKey: { tenantId: 'tenant-1', eventKey: 'event-key' } },
      update: {},
    }));
    expect(mockPrisma.notificationDelivery.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(result).toEqual({ eventId: 'event-1', deliveryIds: ['delivery-in-app', 'delivery-email'] });
  });

  it('deliverNotification persists inbox state before SSE wake-up', async () => {
    await deliverNotification('delivery-in-app');

    expect(mockPrisma.notification.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { deliveryId: 'delivery-in-app' },
      create: expect.objectContaining({ channel: 'IN_APP', status: 'SENT' }),
    }));
    expect(mockPrisma.notificationDelivery.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'delivery-in-app' },
      data: expect.objectContaining({ status: 'SENT' }),
    }));
    expect(pushToUser).toHaveBeenCalledWith('user-1', 'notification', expect.objectContaining({ cursor: 'notification-1' }));
  });

  it('deliverNotification leaves failed provider delivery retryable', async () => {
    (sendEmail as jest.Mock).mockResolvedValue(false);

    await deliverNotification('delivery-email');

    expect(mockPrisma.notification.upsert).not.toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ channel: 'EMAIL' }),
    }));
    expect(mockPrisma.notificationDelivery.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'delivery-email' },
      data: expect.objectContaining({ status: 'RETRYING', nextAttemptAt: expect.any(Date) }),
    }));
  });

  it('does not call the provider when another worker owns the delivery lease', async () => {
    mockPrisma.notificationDelivery.updateMany.mockResolvedValue({ count: 0 });

    await deliverNotification('delivery-email');

    expect(sendEmail).not.toHaveBeenCalled();
    expect(mockPrisma.notificationDelivery.update).not.toHaveBeenCalled();
  });

  it('renders approval reminder emails with request details instead of the event fallback', async () => {
    mockPrisma.notificationDelivery.findUnique.mockImplementation(({ where }: any) => Promise.resolve({
      id: where.id,
      eventId: 'event-1',
      tenantId: 'tenant-1',
      recipientId: 'user-1',
      channel: 'EMAIL',
      status: 'PENDING',
      attemptCount: 0,
      event: {
        id: 'event-1',
        eventKey: 'event-key',
        tenantId: 'tenant-1',
        departmentId: null,
        eventType: 'APPROVAL_REMINDER_FIRST',
        classification: 'INTERNAL',
        resourceType: 'request',
        resourceId: 'request-1',
        payload: {
          variables: { hours: '24' },
          relatedRequestId: 'request-1',
          wrapInLayout: true,
        },
      },
      recipient: { id: 'user-1', email: 'recipient@test.local', firstName: 'Jane', lastName: 'Doe', tenantId: 'tenant-1' },
      notification: null,
    }));
    mockPrisma.notificationTemplate.findFirst.mockResolvedValue({
      pushTitle: 'Approval Reminder',
      pushBody: 'Approval is still pending for request #{{requestId}} ({{hours}} hours).',
      emailSubject: 'Approval Reminder — Request #{{requestId}}',
      emailBody: 'Approval is still pending for request <strong>#{{requestId}} — {{requestTitle}}</strong> after {{hours}} hours. <a href="{{appUrl}}/request/{{requestUuid}}">Review &amp; Approve</a>',
    });
    mockPrisma.request.findUnique.mockResolvedValue({
      referenceNumber: 'IT-00007',
      summary: 'M365 License Renewal',
      status: 'PENDING',
      priority: 'MEDIUM',
      requester: { firstName: 'John', lastName: 'Smith' },
      assignedTo: null,
      serviceDesk: { name: 'IT Support' },
      requestType: { name: 'Software' },
    });

    await deliverNotification('delivery-email');

    expect(sendEmail).toHaveBeenCalledWith(
      'recipient@test.local',
      'Approval Reminder — Request #IT-00007',
      expect.stringContaining('#IT-00007 — M365 License Renewal'),
      { wrapInLayout: true },
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.stringContaining('24 hours'),
      expect.any(Object),
    );
  });

  it('notify compatibility wrapper publishes and drains created deliveries without fallback tenant UUID', async () => {
    await notify({ userId: 'user-1', eventType: 'REQUEST_CREATED', variables: { foo: 'bar' } });

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'user-1' } }));
    expect(mockPrisma.notificationDomainEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ tenantId: 'tenant-1' }),
    }));
    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('tenantless'), expect.anything());
  });

  it('notifyMultiple logs rejected compatibility wrapper deliveries instead of swallowing success', async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ tenantId: 'tenant-1', email: null })
      .mockRejectedValueOnce(new Error('boom'));

    await notifyMultiple(['user-1', 'user-2'], 'REQUEST_CREATED', {});

    expect(logger.error).toHaveBeenCalledWith('Failed to create notification in notifyMultiple', expect.objectContaining({
      error: expect.any(Error),
      eventType: 'REQUEST_CREATED',
    }));
  });
});
