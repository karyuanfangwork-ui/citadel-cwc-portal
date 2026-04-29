// ── Mocks (hoisted by Jest before module evaluation) ────────────────────

const mockPrisma = {
  notificationTemplate: {
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  request: {
    findUnique: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
};

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../email.service', () => ({
  sendEmail: jest.fn(),
  renderTemplate: jest.fn(),
}));

jest.mock('../../utils/sseClients', () => ({
  pushToUser: jest.fn(),
}));

jest.mock('../../config', () => ({
  config: { app: { url: 'http://localhost:3000' } },
}));

jest.mock('../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

// ── Import AFTER mocks ──────────────────────────────────────────────────

const { notify, notifyMultiple } = require('../notification.service');
const { sendEmail, renderTemplate } = require('../email.service');
const { pushToUser } = require('../../utils/sseClients');
const { logger } = require('../../utils/logger');

// ── Tests ───────────────────────────────────────────────────────────────

describe('notification.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Sensible defaults so every test doesn't have to set up the full chain
    mockPrisma.notificationTemplate.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
    });
    mockPrisma.request.findUnique.mockResolvedValue(null);
    mockPrisma.notification.create.mockResolvedValue({
      id: 'notif-1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    (sendEmail as jest.Mock).mockResolvedValue(true);
    (renderTemplate as jest.Mock).mockImplementation(
      (_tpl: string, vars: Record<string, string>) => {
        // Simple stub: replace {{key}} with value
        return _tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
      },
    );
  });

  // ─────────────────────────────────────────────────────────────────────
  // 1. Template found → renders subject and body via renderTemplate
  // ─────────────────────────────────────────────────────────────────────
  it('creates in-app notification with rendered subject/body when template found', async () => {
    const template = {
      emailSubject: 'Hello {{userName}}',
      emailBody: 'Body for {{userName}}',
    };
    mockPrisma.notificationTemplate.findFirst.mockResolvedValue(template);

    await notify({
      userId: 'user-1',
      eventType: 'REQUEST_CREATED',
      variables: {},
    });

    // renderTemplate should have been called for subject and body
    expect(renderTemplate).toHaveBeenCalledTimes(2);
    expect(renderTemplate).toHaveBeenCalledWith('Hello {{userName}}', expect.any(Object));
    expect(renderTemplate).toHaveBeenCalledWith('Body for {{userName}}', expect.any(Object));

    // In-app notification created with rendered values
    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2); // IN_APP + EMAIL
    const inAppCall = mockPrisma.notification.create.mock.calls[0][0];
    expect(inAppCall.data.channel).toBe('IN_APP');
    expect(inAppCall.data.status).toBe('SENT');
    expect(inAppCall.data.subject).toBe('Hello Jane Doe');
    expect(inAppCall.data.body).toBe('Body for Jane Doe');
  });

  // ─────────────────────────────────────────────────────────────────────
  // 2. No template → falls back to default subject/body
  // ─────────────────────────────────────────────────────────────────────
  it('creates in-app notification with default subject/body when no template', async () => {
    mockPrisma.notificationTemplate.findFirst.mockResolvedValue(null);

    await notify({
      userId: 'user-1',
      eventType: 'REQUEST_UPDATED',
      variables: {},
    });

    // renderTemplate should NOT be called
    expect(renderTemplate).not.toHaveBeenCalled();

    const inAppCall = mockPrisma.notification.create.mock.calls[0][0];
    expect(inAppCall.data.subject).toBe('Notification: REQUEST_UPDATED');
    expect(inAppCall.data.body).toBe('Event: REQUEST_UPDATED');
  });

  // ─────────────────────────────────────────────────────────────────────
  // 3. relatedRequestId → enriches variables from request data
  // ─────────────────────────────────────────────────────────────────────
  it('enriches variables from related request data', async () => {
    const tpl = {
      emailSubject: '{{requestId}} {{status}}',
      emailBody: '{{requesterName}} → {{assigneeName}}',
    };
    mockPrisma.notificationTemplate.findFirst.mockResolvedValue(tpl);

    mockPrisma.request.findUnique.mockResolvedValue({
      referenceNumber: 'REF-100',
      summary: 'Fix the login bug',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      requester: { firstName: 'Alice', lastName: 'Smith' },
      assignedTo: { firstName: 'Bob', lastName: 'Jones' },
      serviceDesk: { name: 'IT Support' },
      requestType: { name: 'Incident' },
    });

    // Capture the enriched vars passed to renderTemplate
    let capturedVars: Record<string, string> = {};
    (renderTemplate as jest.Mock).mockImplementation(
      (_tpl: string, vars: Record<string, string>) => {
        capturedVars = { ...vars };
        return 'rendered';
      },
    );

    await notify({
      userId: 'user-1',
      eventType: 'REQUEST_UPDATED',
      variables: { newStatus: 'IN_PROGRESS' },
      relatedRequestId: 'req-1',
    });

    // prisma.request.findUnique was called with the right id
    expect(mockPrisma.request.findUnique).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      select: expect.any(Object),
    });

    // The enriched vars passed to renderTemplate should include request fields
    expect(capturedVars.requestId).toBe('REF-100');
    expect(capturedVars.requestTitle).toBe('Fix the login bug');
    expect(capturedVars.referenceNumber).toBe('REF-100');
    expect(capturedVars.summary).toBe('Fix the login bug');
    expect(capturedVars.status).toBe('IN_PROGRESS');
    expect(capturedVars.priority).toBe('HIGH');
    expect(capturedVars.requesterName).toBe('Alice Smith');
    expect(capturedVars.assigneeName).toBe('Bob Jones');
    expect(capturedVars.categoryName).toBe('IT Support');
    expect(capturedVars.requestTypeName).toBe('Incident');
  });

  // ─────────────────────────────────────────────────────────────────────
  // 4. User has email → sends email
  // ─────────────────────────────────────────────────────────────────────
  it('sends email when user has an email address', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
    });

    await notify({
      userId: 'user-1',
      eventType: 'REQUEST_CREATED',
      variables: {},
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.any(String),
      expect.any(String),
      { wrapInLayout: true },
    );

    // EMAIL notification record created
    const emailCall = mockPrisma.notification.create.mock.calls[1][0];
    expect(emailCall.data.channel).toBe('EMAIL');
    expect(emailCall.data.status).toBe('SENT');
    expect(emailCall.data.sentAt).toBeInstanceOf(Date);
    expect(emailCall.data.errorMessage).toBeUndefined();
  });

  // ─────────────────────────────────────────────────────────────────────
  // 5. sendEmail returns false → EMAIL record with FAILED status
  // ─────────────────────────────────────────────────────────────────────
  it('creates EMAIL record with FAILED status when sendEmail returns false', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
    });
    (sendEmail as jest.Mock).mockResolvedValue(false);

    await notify({
      userId: 'user-1',
      eventType: 'REQUEST_CREATED',
      variables: {},
    });

    const emailCall = mockPrisma.notification.create.mock.calls[1][0];
    expect(emailCall.data.channel).toBe('EMAIL');
    expect(emailCall.data.status).toBe('FAILED');
    expect(emailCall.data.sentAt).toBeUndefined();
    expect(emailCall.data.errorMessage).toBe('SMTP delivery failed');
  });

  // ─────────────────────────────────────────────────────────────────────
  // 6. User has no email → does NOT send email
  // ─────────────────────────────────────────────────────────────────────
  it('does NOT send email when user has no email address', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      firstName: 'Jane',
      lastName: 'Doe',
      email: null,
    });

    await notify({
      userId: 'user-1',
      eventType: 'REQUEST_CREATED',
      variables: {},
    });

    expect(sendEmail).not.toHaveBeenCalled();

    // Only IN_APP notification created (no EMAIL record)
    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.notification.create.mock.calls[0][0].data.channel).toBe('IN_APP');
  });

  it('does NOT send email when user record is not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await notify({
      userId: 'user-missing',
      eventType: 'REQUEST_CREATED',
      variables: {},
    });

    expect(sendEmail).not.toHaveBeenCalled();
    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
  });

  // ─────────────────────────────────────────────────────────────────────
  // 7. Pushes SSE event to user
  // ─────────────────────────────────────────────────────────────────────
  it('pushes SSE event to user after creating in-app notification', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    mockPrisma.notification.create.mockResolvedValue({
      id: 'notif-42',
      createdAt,
    });

    await notify({
      userId: 'user-1',
      eventType: 'REQUEST_CREATED',
      variables: {},
      relatedRequestId: 'req-99',
    });

    expect(pushToUser).toHaveBeenCalledTimes(1);
    expect(pushToUser).toHaveBeenCalledWith('user-1', 'notification', {
      id: 'notif-42',
      subject: expect.any(String),
      body: expect.any(String),
      relatedRequestId: 'req-99',
      createdAt,
    });
  });

  it('pushes SSE event with null relatedRequestId when none provided', async () => {
    await notify({
      userId: 'user-1',
      eventType: 'REQUEST_CREATED',
      variables: {},
    });

    expect(pushToUser).toHaveBeenCalledWith('user-1', 'notification', expect.objectContaining({
      relatedRequestId: null,
    }));
  });

  // ─────────────────────────────────────────────────────────────────────
  // 8. Catches and logs errors without throwing
  // ─────────────────────────────────────────────────────────────────────
  it('catches and logs errors without throwing', async () => {
    mockPrisma.notificationTemplate.findFirst.mockRejectedValue(
      new Error('DB connection lost'),
    );

    // Should NOT throw
    await expect(
      notify({
        userId: 'user-1',
        eventType: 'REQUEST_CREATED',
        variables: {},
      }),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to create notification for user user-1',
      expect.objectContaining({
        error: expect.any(Error),
        eventType: 'REQUEST_CREATED',
      }),
    );
  });

  // ─────────────────────────────────────────────────────────────────────
  // 9. notifyMultiple calls notify for each userId
  // ─────────────────────────────────────────────────────────────────────
  it('notifyMultiple calls notify for each userId', async () => {
    await notifyMultiple(
      ['user-a', 'user-b', 'user-c'],
      'REQUEST_CREATED',
      { key: 'val' },
      'req-1',
    );

    // prisma.notificationTemplate.findFirst called once per user (3 times)
    expect(mockPrisma.notificationTemplate.findFirst).toHaveBeenCalledTimes(3);
    // prisma.user.findUnique called once per user
    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(3);
    // request.findUnique called once per user (relatedRequestId is provided)
    expect(mockPrisma.request.findUnique).toHaveBeenCalledTimes(3);
  });

  // ─────────────────────────────────────────────────────────────────────
  // 10. Variable merge order: requestVars < caller variables < userName < appUrl
  // ─────────────────────────────────────────────────────────────────────
  it('merges variables in correct order: requestVars < caller vars < userName < appUrl', async () => {
    // requestVars provides status = 'OPEN' from the request record
    mockPrisma.request.findUnique.mockResolvedValue({
      referenceNumber: 'REF-200',
      summary: 'Original summary',
      status: 'OPEN',
      priority: 'MEDIUM',
      requester: { firstName: 'Req', lastName: 'Er' },
      assignedTo: null,
      serviceDesk: { name: 'Helpdesk' },
      requestType: { name: 'Bug' },
    });

    // Caller overrides status and adds custom var
    // Also sets appUrl (which should take precedence over config.app.url)
    const callerVars = {
      status: 'IN_PROGRESS',  // should override requestVars.status
      customComment: 'approved',  // should be present
      appUrl: 'https://custom.app',  // should override config.app.url
    };

    // Capture the enriched variables passed to renderTemplate
    let capturedVars: Record<string, string> = {};
    (renderTemplate as jest.Mock).mockImplementation(
      (_tpl: string, vars: Record<string, string>) => {
        capturedVars = { ...vars };
        return 'rendered';
      },
    );

    const template = {
      emailSubject: 'subject',
      emailBody: 'body',
    };
    mockPrisma.notificationTemplate.findFirst.mockResolvedValue(template);

    await notify({
      userId: 'user-1',
      eventType: 'STATUS_CHANGED',
      variables: callerVars,
      relatedRequestId: 'req-2',
    });

    // Caller's status overrides request-level status
    expect(capturedVars.status).toBe('IN_PROGRESS');

    // Request-level fields still present when not overridden
    expect(capturedVars.requestId).toBe('REF-200');
    expect(capturedVars.summary).toBe('Original summary');

    // Caller's custom variable present
    expect(capturedVars.customComment).toBe('approved');

    // userName always comes from DB (not caller)
    expect(capturedVars.userName).toBe('Jane Doe');

    // Caller's appUrl overrides config default
    expect(capturedVars.appUrl).toBe('https://custom.app');
  });

  it('uses config.app.url as appUrl when caller does not provide one', async () => {
    let capturedVars: Record<string, string> = {};
    (renderTemplate as jest.Mock).mockImplementation(
      (_tpl: string, vars: Record<string, string>) => {
        capturedVars = { ...vars };
        return 'rendered';
      },
    );

    mockPrisma.notificationTemplate.findFirst.mockResolvedValue({
      emailSubject: 's',
      emailBody: 'b',
    });

    await notify({
      userId: 'user-1',
      eventType: 'TEST',
      variables: {},  // no appUrl provided
    });

    expect(capturedVars.appUrl).toBe('http://localhost:3000');
  });

  // ─────────────────────────────────────────────────────────────────────
  // Additional edge-case: wrapInLayout is forwarded to sendEmail
  // ─────────────────────────────────────────────────────────────────────
  it('forwards wrapInLayout option to sendEmail', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
    });

    await notify({
      userId: 'user-1',
      eventType: 'REQUEST_CREATED',
      variables: {},
      wrapInLayout: false,
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      { wrapInLayout: false },
    );
  });

  // ─────────────────────────────────────────────────────────────────────
  // Additional edge-case: request found but optional relations are null
  // ─────────────────────────────────────────────────────────────────────
  it('handles null optional relations in related request gracefully', async () => {
    let capturedVars: Record<string, string> = {};
    (renderTemplate as jest.Mock).mockImplementation(
      (_tpl: string, vars: Record<string, string>) => {
        capturedVars = { ...vars };
        return 'rendered';
      },
    );

    mockPrisma.notificationTemplate.findFirst.mockResolvedValue({
      emailSubject: 'subject',
      emailBody: 'body',
    });

    mockPrisma.request.findUnique.mockResolvedValue({
      referenceNumber: 'REF-300',
      summary: 'No relations',
      status: 'NEW',
      priority: null,
      requester: null,
      assignedTo: null,
      serviceDesk: null,
      requestType: null,
    });

    await notify({
      userId: 'user-1',
      eventType: 'REQUEST_CREATED',
      variables: {},
      relatedRequestId: 'req-3',
    });

    expect(capturedVars.priority).toBe('');
    expect(capturedVars.requesterName).toBe('');
    expect(capturedVars.assigneeName).toBe('');
    expect(capturedVars.categoryName).toBe('');
    expect(capturedVars.requestTypeName).toBe('');
  });

  // ─────────────────────────────────────────────────────────────────────
  // Additional edge-case: relatedRequestId provided but request not found
  // ─────────────────────────────────────────────────────────────────────
  it('handles missing related request gracefully (requestVars stays empty)', async () => {
    mockPrisma.request.findUnique.mockResolvedValue(null);
    let capturedVars: Record<string, string> = {};
    (renderTemplate as jest.Mock).mockImplementation(
      (_tpl: string, vars: Record<string, string>) => {
        capturedVars = { ...vars };
        return 'rendered';
      },
    );

    mockPrisma.notificationTemplate.findFirst.mockResolvedValue({
      emailSubject: 's',
      emailBody: 'b',
    });

    await notify({
      userId: 'user-1',
      eventType: 'REQUEST_CREATED',
      variables: { foo: 'bar' },
      relatedRequestId: 'req-nonexistent',
    });

    // No request-level keys should be present
    expect(capturedVars).not.toHaveProperty('requestId');
    expect(capturedVars).not.toHaveProperty('status');
    // Caller variables still present
    expect(capturedVars.foo).toBe('bar');
  });
});