jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../lib/user-context', () => ({
  getUserContext: jest.fn(() => ({
    userId: '00000000-0000-0000-0000-000000000001',
    email: 'auditor@test.local',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  })),
}));

import { installCreditAuditMiddleware } from '../autoAudit.middleware';

describe('credit auto-audit middleware', () => {
  let middleware: any;
  let prisma: any;

  beforeEach(() => {
    middleware = undefined;
    prisma = {
      $use: jest.fn((fn) => {
        middleware = fn;
      }),
      auditLog: {
        create: jest.fn(async () => ({ id: 'audit-1' })),
      },
    };
    jest.clearAllMocks();
    installCreditAuditMiddleware(prisma);
  });

  it('audits newly covered credit configuration models', async () => {
    const next = jest.fn(async () => ({ id: 'rule-1', kind: 'REQUIRED_FIELD' }));

    const result = await middleware(
      { model: 'CreditRuleConfig', action: 'create', args: { data: {} } },
      next,
    );

    expect(result).toEqual({ id: 'rule-1', kind: 'REQUIRED_FIELD' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'CREDIT_CREATE',
        resourceType: 'CreditRuleConfig',
        resourceId: 'rule-1',
        newValues: { id: 'rule-1', kind: 'REQUIRED_FIELD' },
      }),
    });
  });

  it('fails closed when audit log write fails', async () => {
    const auditError = new Error('audit db unavailable');
    prisma.auditLog.create.mockRejectedValueOnce(auditError);
    const next = jest.fn(async () => ({ id: 'band-1' }));

    await expect(
      middleware({ model: 'RatingBandConfig', action: 'create', args: { data: {} } }, next),
    ).rejects.toThrow('audit db unavailable');

    expect(next).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
