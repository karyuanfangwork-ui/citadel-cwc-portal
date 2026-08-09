/**
 * LOS-013 — Chain ordering must not depend on createdAt.
 *
 * Regression test for the defect Phase 6 verification surfaced: appendEvent
 * picked its predecessor with ORDER BY createdAt DESC while verifyChain walked
 * ORDER BY createdAt ASC. createdAt is millisecond-precision, so two appends
 * inside one fast transaction tied, the two orderings disagreed, and the chain
 * forked. 10 of 17 seeded applications failed verification.
 *
 * Requires a database: the whole point is that appends race in real Postgres.
 */
import { randomUUID } from 'crypto';
import prisma from '../../utils/prisma';
import { AuditChainService } from '../services/auditChain.service';

const RUN = process.env.DATABASE_URL ? describe : describe.skip;

RUN('LOS-013 — audit chain ordering', () => {
  let applicationId: string;
  const created: string[] = [];

  beforeAll(async () => {
    const app = await prisma.creditApplication.findFirst({ where: { deletedAt: null } });
    if (!app) throw new Error('Seed credit fixtures first: npm run prisma:seed:credit -- --demo');
    applicationId = app.id;
  });

  afterAll(async () => {
    if (created.length) {
      await AuditChainService.withImmutabilityBypass(async (tx) => {
        for (const id of created) {
          await tx.$executeRaw`DELETE FROM credit_audit_events WHERE id = ${id}::uuid`;
        }
      });
    }
    await prisma.$disconnect();
  });

  it('keeps the chain verifiable when several events share a millisecond', async () => {
    // Freeze the clock so every append inside this transaction stamps the exact
    // same createdAt. This is the condition that broke 10 of 17 chains in
    // practice; timing it by luck makes the test flaky, so we force it. Only
    // Date is faked — timers and I/O must keep working for Prisma.
    jest.useFakeTimers({
      doNotFake: [
        'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
        'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask',
        'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'hrtime',
      ],
    });
    jest.setSystemTime(new Date('2026-08-10T12:00:00.000Z'));

    let ids: string[];
    try {
      ids = await prisma.$transaction(async (tx) => {
        const out: string[] = [];
        for (let i = 0; i < 10; i++) {
          out.push(
            await AuditChainService.appendEvent(
              applicationId, 'TEST', null, `ordering_probe_${i}`, null, null, { i }, tx,
            ),
          );
        }
        return out;
      });
    } finally {
      jest.useRealTimers();
    }
    created.push(...ids);

    const events = await prisma.creditAuditEvent.findMany({
      where: { id: { in: ids } },
      select: { createdAt: true, sequence: true },
      orderBy: { sequence: 'asc' },
    });

    // The precondition this test exists for: timestamps genuinely collide.
    const distinctTimestamps = new Set(events.map((e) => e.createdAt.getTime()));
    expect(distinctTimestamps.size).toBe(1);

    // Sequence is strictly increasing regardless.
    const sequences = events.map((e) => e.sequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
    expect(new Set(sequences).size).toBe(sequences.length);

    // And the chain still verifies.
    await expect(AuditChainService.verifyChain(applicationId)).resolves.toEqual({ valid: true });
  });

  it('walks by sequence even when createdAt disagrees with write order', async () => {
    // The decisive test. Build a chain whose createdAt order is the REVERSE of
    // its write order, hashing in write (sequence) order. Verification ordered
    // by sequence passes; verification ordered by createdAt walks the chain
    // backwards and cannot reproduce the hashes. Ties alone don't prove this —
    // Postgres often returns tied rows in insertion order by luck, which is why
    // the original defect only bit some applications.
    const base = new Date('2026-08-10T13:00:00.000Z').getTime();
    const rows: { id: string; sequence: number; createdAt: Date; hash: string; action: string }[] = [];
    let previousHash = '';

    for (let i = 0; i < 5; i++) {
      const id = randomUUID();
      // Descending timestamps: written first, stamped latest.
      const createdAt = new Date(base + (5 - i) * 1000);
      const hash = await AuditChainService.computeHash({
        id,
        applicationId,
        eventType: 'TEST',
        actorId: null,
        action: `reverse_probe_${i}`,
        oldState: null,
        newState: null,
        metadata: null,
        createdAt,
        previousHash,
        hashVersion: 2,
      });
      rows.push({ id, sequence: 10_000 + i, createdAt, hash, action: `reverse_probe_${i}` });
      previousHash = hash;
    }

    // Isolate: verifyChain covers the whole application, so use an application
    // that has no other events. Create a scratch one rather than polluting a
    // seeded chain.
    const scratch = await prisma.creditAuditEvent.findMany({
      where: { applicationId }, select: { id: true }, take: 1,
    });
    if (scratch.length) {
      // The seeded application already has events; splice ours on top instead by
      // rebuilding from its real tail so the chain stays continuous.
      const tail = await prisma.creditAuditEvent.findFirst({
        where: { applicationId }, orderBy: { sequence: 'desc' },
      });
      previousHash = tail?.hash || '';
      const maxSeq = tail?.sequence ?? 0;
      for (let i = 0; i < rows.length; i++) {
        rows[i].sequence = maxSeq + 1 + i;
        rows[i].hash = await AuditChainService.computeHash({
          id: rows[i].id,
          applicationId,
          eventType: 'TEST',
          actorId: null,
          action: rows[i].action,
          oldState: null,
          newState: null,
          metadata: null,
          createdAt: rows[i].createdAt,
          previousHash,
          hashVersion: 2,
        });
        previousHash = rows[i].hash;
      }
    }

    for (const r of rows) {
      await prisma.$executeRaw`
        INSERT INTO credit_audit_events
          (id, application_id, event_type, actor_id, action, old_state, new_state, metadata, hash, hash_version, sequence, created_at)
        VALUES
          (${r.id}::uuid, ${applicationId}::uuid, 'TEST', NULL, ${r.action}, NULL, NULL, NULL, ${r.hash}, 2, ${r.sequence}, ${r.createdAt})`;
      created.push(r.id);
    }

    // Sanity: the two orderings genuinely disagree for these rows.
    const byCreatedAt = await prisma.creditAuditEvent.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      orderBy: { createdAt: 'asc' },
      select: { sequence: true },
    });
    expect(byCreatedAt.map((r) => r.sequence)).not.toEqual(
      [...byCreatedAt.map((r) => r.sequence)].sort((a, b) => a - b),
    );

    await expect(AuditChainService.verifyChain(applicationId)).resolves.toEqual({ valid: true });
  });

  it('assigns every event a unique sequence per application', async () => {
    const dupes: { c: bigint }[] = await prisma.$queryRawUnsafe(`
      SELECT count(*) c FROM (
        SELECT application_id, sequence FROM credit_audit_events
        GROUP BY 1, 2 HAVING count(*) > 1
      ) t`);
    expect(Number(dupes[0].c)).toBe(0);
  });

  it('verifies every seeded application chain', async () => {
    const apps = await prisma.creditApplication.findMany({
      where: { deletedAt: null }, select: { id: true },
    });
    const broken: string[] = [];
    for (const app of apps) {
      const r = await AuditChainService.verifyChain(app.id);
      if (!r.valid) broken.push(`${app.id}@${r.brokenAt}`);
    }
    expect(broken).toEqual([]);
  });
});
