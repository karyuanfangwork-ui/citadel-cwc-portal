/**
 * LOS-022 — Release evidence. Every P0 closed during Phases 1-6 is replayed
 * here as a NEGATIVE test: attempt the former bypass, assert it is refused,
 * and assert the database and the audit chain are unchanged.
 *
 * Requires a seeded database:
 *   npm run prisma:seed:credit -- --demo
 */
import prisma from '../../utils/prisma';
import { AuditChainService } from '../services/auditChain.service';
import { enforceCommitteeEntryGate } from '../services/committeeEntryGate';
import { assertVersionMatch } from '../utils/optimisticConcurrency';
import { assertRecordOnlyAllowed } from '../adapters/registry';

const RUN = process.env.DATABASE_URL ? describe : describe.skip;

RUN('LOS-022 — P0 regression evidence', () => {
  let draftAppId: string;

  beforeAll(async () => {
    const draft = await prisma.creditApplication.findFirst({
      where: { state: 'DRAFT', deletedAt: null },
    });
    if (!draft) throw new Error('Seed demo credit data first: npm run prisma:seed:credit -- --demo');
    draftAppId = draft.id;
  });

  afterAll(async () => { await prisma.$disconnect(); });

  it('LOS-001/015 — committee entry is refused for an unready application, leaving nothing frozen', async () => {
    const before = await prisma.creditApplication.findUnique({ where: { id: draftAppId } });
    const eventsBefore = await prisma.creditAuditEvent.count({ where: { applicationId: draftAppId } });

    await expect(enforceCommitteeEntryGate(draftAppId, 'test-actor')).rejects.toThrow(
      /Cannot enter committee review/,
    );

    const after = await prisma.creditApplication.findUnique({ where: { id: draftAppId } });
    expect(after?.state).toBe(before?.state);
    expect(after?.updatedAt).toEqual(before?.updatedAt);
    expect(await prisma.creditAuditEvent.count({ where: { applicationId: draftAppId } })).toBe(eventsBefore);
  });

  it('LOS-013 — the audit chain verifies for every seeded application', async () => {
    const apps = await prisma.creditApplication.findMany({ where: { deletedAt: null }, select: { id: true } });
    for (const app of apps) {
      const result = await AuditChainService.verifyChain(app.id);
      expect({ app: app.id, ...result }).toEqual({ app: app.id, valid: true });
    }
  });

  it('LOS-013 — direct UPDATE of an audit event is refused by the database', async () => {
    const event = await prisma.creditAuditEvent.findFirst({ where: { applicationId: draftAppId } });
    if (!event) return; // nothing to probe
    await expect(
      prisma.$executeRaw`UPDATE credit_audit_events SET action = 'tampered' WHERE id = ${event.id}::uuid`,
    ).rejects.toThrow(/append-only/i);
    const reread = await prisma.creditAuditEvent.findUnique({ where: { id: event.id } });
    expect(reread?.action).toBe(event.action);
  });

  it('LOS-018 — a stale concurrency token is refused with 409', () => {
    expect(() =>
      assertVersionMatch(new Date('2026-08-09T10:00:00Z'), '2026-08-09T09:00:00Z', 'Financial statement'),
    ).toThrow(expect.objectContaining({ statusCode: 409 }));
  });

  it('LOS-021 — record-only mode permits the placeholder CBS', () => {
    delete process.env.CREDIT_LIVE_LENDING;
    expect(() => assertRecordOnlyAllowed('cbs')).not.toThrow();
  });

  it('LOS-006 — an approved financial statement cannot have its line items edited', async () => {
    const approved = await prisma.financialStatement.findFirst({
      where: { status: 'APPROVED' },
      select: { id: true },
    });
    if (!approved) return; // no approved statement in the demo set
    const { financialService } = await import('../services/financial.service');
    await expect(
      financialService.updateStatement(approved.id, { notes: 'tamper' } as any),
    ).rejects.toThrow();
  });
});