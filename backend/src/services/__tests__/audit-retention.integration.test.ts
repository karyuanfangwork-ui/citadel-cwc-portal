import prisma from '../../utils/prisma';
import { PlatformAuditChainService } from '../platformAuditChain.service';
import { RetentionPolicyService } from '../retentionPolicy.service';

describe('Task 20 audit and retention controls', () => {
  let requestId: string;
  let originalSummary: string;
  let actorId: string | null = null;
  let tenantId: string;
  let departmentId: string;
  const createdEventIds = new Set<string>();

  beforeAll(async () => {
    const request = await (prisma as any).request.findFirst({
      where: { tenantId: { not: null }, departmentId: { not: null } },
      select: { id: true, summary: true, requesterId: true, tenantId: true, departmentId: true },
    });

    if (!request) {
      throw new Error('Task 20 integration test requires at least one seeded request with tenant and department ownership');
    }

    requestId = request.id;
    originalSummary = request.summary;
    actorId = request.requesterId;
    tenantId = request.tenantId!;
    departmentId = request.departmentId!;

    // Restore the append-only guard when a local database was restored from a
    // dump that retained the table but not its trigger/function objects.
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION prevent_platform_audit_event_mutation()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'platform_audit_events is append-only';
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS trg_platform_audit_events_append_only ON platform_audit_events');
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER trg_platform_audit_events_append_only
      BEFORE UPDATE OR DELETE ON platform_audit_events
      FOR EACH ROW EXECUTE FUNCTION prevent_platform_audit_event_mutation()
    `);
  });

  afterEach(async () => {
    await prisma.request.update({ where: { id: requestId }, data: { summary: originalSummary } }).catch(() => undefined);
  });

  afterAll(async () => {
    for (const id of createdEventIds) {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS trg_platform_audit_events_append_only ON platform_audit_events').catch(() => undefined);
      await (prisma as any).platformAuditEvent.delete({ where: { id } }).catch(() => undefined);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER trg_platform_audit_events_append_only
        BEFORE UPDATE OR DELETE ON platform_audit_events
        FOR EACH ROW EXECUTE FUNCTION prevent_platform_audit_event_mutation()
      `).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('rolls back privileged mutations when the audit append fails', async () => {
    await expect(
      PlatformAuditChainService.runPrivilegedAuditedMutation(
        async (tx: any) => {
          await tx.request.update({
            where: { id: requestId },
            data: { summary: 'TASK20 SHOULD ROLLBACK' },
          });
        },
        async () => {
          throw new Error('synthetic audit failure');
        },
      ),
    ).rejects.toThrow('synthetic audit failure');

    const reloaded = await prisma.request.findUnique({ where: { id: requestId }, select: { summary: true } });
    expect(reloaded?.summary).toBe(originalSummary);
  });

  it('appends tamper-evident platform audit events and detects modified events', async () => {
    const eventId = await PlatformAuditChainService.appendEvent({
      tenantId,
      departmentId,
      actorId,
      action: 'REQUEST_EXPORT',
      resourceType: 'Request',
      resourceId: requestId,
      correlationId: 'task20-correlation-a',
      oldValues: { status: 'SUBMITTED' },
      newValues: { exportFormat: 'csv', rowCount: 1 },
      metadata: { purpose: 'integration-test' },
    });
    createdEventIds.add(eventId);

    await expect(
      (prisma as any).platformAuditEvent.update({
        where: { id: eventId },
        data: { action: 'TAMPERED' },
      }),
    ).rejects.toThrow();

    const verification = await PlatformAuditChainService.verifyChain({
      tenantId,
      resourceType: 'Request',
      resourceId: requestId,
    });
    expect(verification.valid).toBe(true);

    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS trg_platform_audit_events_append_only ON platform_audit_events');
    await (prisma as any).platformAuditEvent.update({
      where: { id: eventId },
      data: { action: 'TAMPERED' },
    });

    const tampered = await PlatformAuditChainService.verifyChain({
      tenantId,
      resourceType: 'Request',
      resourceId: requestId,
    });
    expect(tampered.valid).toBe(false);
    expect(tampered.brokenAt).toBe(eventId);

    await (prisma as any).platformAuditEvent.delete({ where: { id: eventId } });
    createdEventIds.delete(eventId);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER trg_platform_audit_events_append_only
      BEFORE UPDATE OR DELETE ON platform_audit_events
      FOR EACH ROW EXECUTE FUNCTION prevent_platform_audit_event_mutation()
    `);
  });

  it('blocks legal-hold retention actions and audits DLP/export evidence', async () => {
    const held = RetentionPolicyService.evaluateRetentionAction({
      resourceType: 'RequestAttachment',
      retentionUntil: new Date('2025-01-01T00:00:00Z'),
      legalHoldAt: new Date('2026-01-01T00:00:00Z'),
      now: new Date('2026-07-23T00:00:00Z'),
    });
    expect(held.action).toBe('BLOCKED_LEGAL_HOLD');
    expect(held.allowed).toBe(false);

    const expired = RetentionPolicyService.evaluateRetentionAction({
      resourceType: 'RequestAttachment',
      retentionUntil: new Date('2025-01-01T00:00:00Z'),
      legalHoldAt: null,
      now: new Date('2026-07-23T00:00:00Z'),
    });
    expect(expired.action).toBe('ARCHIVE_ELIGIBLE');
    expect(expired.allowed).toBe(true);

    const exportEventId = await RetentionPolicyService.recordDlpExportAudit({
      tenantId,
      departmentId,
      actorId,
      resourceType: 'Request',
      resourceId: requestId,
      reportType: 'request_export',
      format: 'csv',
      rowCount: 1,
      filters: { requestId },
      correlationId: 'task20-dlp-export',
    });
    createdEventIds.add(exportEventId);

    const event = await (prisma as any).platformAuditEvent.findUnique({ where: { id: exportEventId } });
    expect(event.action).toBe('DLP_EXPORT');
    expect(event.newValueHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
