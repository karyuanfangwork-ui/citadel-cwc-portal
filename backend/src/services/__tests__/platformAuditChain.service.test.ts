import { PlatformAuditChainService } from '../platformAuditChain.service';

describe('PlatformAuditChainService', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';
  const departmentId = '22222222-2222-2222-2222-222222222222';
  const actorId = '33333333-3333-3333-3333-333333333333';
  const resourceId = '44444444-4444-4444-4444-444444444444';

  it('falls back to raw SQL when the transaction client is missing the platformAuditEvent delegate', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };

    const eventId = await PlatformAuditChainService.appendEvent({
      tenantId,
      departmentId,
      actorId,
      actorEmail: 'admin@test.local',
      action: 'REQUEST_CREATED',
      resourceType: 'request',
      resourceId,
      oldValues: null,
      newValues: { status: 'SUBMITTED' },
      metadata: { ipAddress: '::1' },
    }, tx);

    expect(eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('uses the Prisma model delegate when available', async () => {
    const tx = {
      platformAuditEvent: {
        findFirst: jest.fn().mockResolvedValue({ hash: 'a'.repeat(64) }),
        create: jest.fn().mockResolvedValue({}),
      },
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };

    await PlatformAuditChainService.appendEvent({
      tenantId,
      action: 'REQUEST_CREATED',
      resourceType: 'request',
      resourceId,
      newValues: { status: 'SUBMITTED' },
    }, tx);

    expect(tx.platformAuditEvent.findFirst).toHaveBeenCalledTimes(1);
    expect(tx.platformAuditEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
});
