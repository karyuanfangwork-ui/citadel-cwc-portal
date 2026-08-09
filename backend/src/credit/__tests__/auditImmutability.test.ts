// backend/src/credit/__tests__/auditImmutability.test.ts
import prisma from '../../utils/prisma';
import { AuditChainService } from '../services/auditChain.service';

const RUN = process.env.DATABASE_URL ? describe : describe.skip;

RUN('LOS-013 — credit_audit_events is immutable at the database level', () => {
  let applicationId: string;
  let eventId: string;

  beforeAll(async () => {
    const app = await prisma.creditApplication.findFirst({ where: { deletedAt: null } });
    if (!app) throw new Error('Seed the credit fixtures first: npm run prisma:seed:credit');
    applicationId = app.id;
    eventId = await prisma.$transaction((tx) =>
      AuditChainService.appendEvent(applicationId, 'TEST', null, 'immutability_probe', null, null, {}, tx),
    );
  });

  afterAll(async () => {
    await AuditChainService.withImmutabilityBypass(async (tx) => {
      await tx.$executeRaw`DELETE FROM credit_audit_events WHERE id = ${eventId}::uuid`;
    });
    await prisma.$disconnect();
  });

  it('rejects UPDATE', async () => {
    await expect(
      prisma.$executeRaw`UPDATE credit_audit_events SET action = 'tampered' WHERE id = ${eventId}::uuid`,
    ).rejects.toThrow(/append-only/i);
  });

  it('rejects DELETE', async () => {
    await expect(
      prisma.$executeRaw`DELETE FROM credit_audit_events WHERE id = ${eventId}::uuid`,
    ).rejects.toThrow(/append-only/i);
  });

  it('leaves the row untouched after a rejected UPDATE', async () => {
    const row = await prisma.creditAuditEvent.findUnique({ where: { id: eventId } });
    expect(row?.action).toBe('immutability_probe');
  });

  it('still allows INSERT through appendEvent', async () => {
    const id = await prisma.$transaction((tx) =>
      AuditChainService.appendEvent(applicationId, 'TEST', null, 'insert_probe', null, null, {}, tx),
    );
    expect(id).toBeTruthy();
    await AuditChainService.withImmutabilityBypass(async (tx) => {
      await tx.$executeRaw`DELETE FROM credit_audit_events WHERE id = ${id}::uuid`;
    });
  });

  it('permits maintenance writes inside withImmutabilityBypass', async () => {
    await expect(
      AuditChainService.withImmutabilityBypass(async (tx) => {
        await tx.$executeRaw`UPDATE credit_audit_events SET action = 'immutability_probe' WHERE id = ${eventId}::uuid`;
      }),
    ).resolves.not.toThrow();
  });
});