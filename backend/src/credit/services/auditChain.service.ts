import * as crypto from 'crypto';
import prisma from '../../utils/prisma';

// TransactionClient accepts both raw PrismaClient and the extended tenant-aware client.
// Using `any` here avoids excessive stack depth when comparing Prisma's complex generic types.
type TransactionClient = any;

/**
 * Hash payload for v2 includes actorId, oldState, newState, metadata.
 * v1 (legacy) only included id|applicationId|eventType|action|createdAt|previousHash.
 * The hashVersion column (default 1) tracks which formula was used.
 */
const HASH_VERSION = 2;

/**
 * Convert an applicationId (UUID string) to a signed int64 for use with
 * pg_advisory_xact_lock. Takes the first 8 bytes of the UUID and interprets
 * them as a BigInt, then converts to a JS number (safe for int53; truncation
 * to 32 bits for advisory lock key space is intentional — collisions just
 * mean two different applications share a lock, which is acceptable since
 * the lock only serializes, it doesn't gate access).
 */
function applicationIdToLockKey(applicationId: string): number {
  // Use a stable hash of the applicationId to produce a 32-bit integer.
  // This is sufficient for advisory lock key space (int32).
  const hash = crypto.createHash('sha256').update(applicationId).digest();
  return hash.readUInt32BE(0) & 0x7FFFFFFF; // positive int32
}

export class AuditChainService {
  /**
   * Compute the hash for an audit event.
   * v2 payload: id|applicationId|eventType|actorId|action|oldState|newState|metadata|createdAt|previousHash
   */
  static async computeHash(event: {
    id: string;
    applicationId: string;
    eventType: string;
    actorId: string | null;
    action: string;
    oldState?: string | null;
    newState?: string | null;
    metadata?: any;
    createdAt: Date;
    previousHash?: string;
    hashVersion?: number;
  }): Promise<string> {
    const version = event.hashVersion ?? HASH_VERSION;

    if (version === 1) {
      // Legacy v1 formula: id|applicationId|eventType|action|createdAt|previousHash
      const payload = `${event.id}|${event.applicationId}|${event.eventType}|${event.action}|${event.createdAt.toISOString()}|${event.previousHash || ''}`;
      return crypto.createHash('sha256').update(payload).digest('hex');
    }

    // v2 formula: id|applicationId|eventType|actorId|action|oldState|newState|metadata|createdAt|previousHash
    const metadataStr = typeof event.metadata === 'string'
      ? event.metadata
      : JSON.stringify(event.metadata ?? null);
    const payload = [
      event.id,
      event.applicationId,
      event.eventType,
      event.actorId ?? '',
      event.action,
      event.oldState ?? '',
      event.newState ?? '',
      metadataStr,
      event.createdAt.toISOString(),
      event.previousHash || '',
    ].join('|');
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Append an audit event to the chain for a given application.
   * This is the canonical way to create audit events — never use raw prisma.creditAuditEvent.create.
   *
   * LOS-009/LOS-013: When called inside a transaction (tx provided), acquires a
   * per-application advisory lock to serialize concurrent appends, preventing
   * chain forks. The lock is automatically released on transaction commit/rollback.
   */
  static async appendEvent(
    applicationId: string,
    eventType: string,
    actorId: string | null,
    action: string,
    oldState?: string | null,
    newState?: string | null,
    metadata?: any,
    tx?: TransactionClient,
  ): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = tx ?? prisma;

    // LOS-013 — Serialize appends per application within the transaction.
    // pg_advisory_xact_lock is held until the transaction commits/rolls back,
    // preventing concurrent appends for the same application from reading the
    // same predecessor and forking the chain. Only acquired when inside a tx;
    // non-transactional callers rely on the (applicationId, sequence) unique
    // constraint plus the retry loop below instead.
    if (tx) {
      const lockKey = applicationIdToLockKey(applicationId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;
    }

    // LOS-013 — Chain position is defined by `sequence`, never by createdAt.
    // createdAt is millisecond-precision and ties within a single fast
    // transaction; ordering by it made the predecessor lookup here and the walk
    // in verifyChain disagree, which forks the chain.
    //
    // A unique index on (applicationId, sequence) makes a lost race impossible
    // rather than merely unlikely: the loser gets P2002 and retries against the
    // now-current tail. Inside a transaction the advisory lock means the retry
    // never fires; outside one it is the only guard, so it must exist.
    const maxAttempts = tx ? 1 : 5;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const lastEvent = await client.creditAuditEvent.findFirst({
        where: { applicationId },
        orderBy: { sequence: 'desc' },
      });
      const previousHash = lastEvent?.hash || '';
      const sequence = (lastEvent?.sequence ?? 0) + 1;
      const tempId = crypto.randomUUID();
      const createdAt = new Date();
      const hash = await this.computeHash({
        id: tempId,
        applicationId,
        eventType,
        actorId,
        action,
        oldState: oldState ?? null,
        newState: newState ?? null,
        metadata,
        createdAt,
        previousHash,
        hashVersion: HASH_VERSION,
      });

      try {
        await client.creditAuditEvent.create({
          data: {
            id: tempId,
            applicationId,
            eventType,
            actorId,
            action,
            oldState: oldState ?? null,
            newState: newState ?? null,
            metadata,
            hash,
            hashVersion: HASH_VERSION,
            sequence,
            createdAt,   // must match the timestamp used in hash computation
          },
        });
        return tempId;
      } catch (error: any) {
        // P2002 = unique constraint violation: another append claimed this
        // sequence first. Re-read the tail and rebuild on top of it.
        if (error?.code !== 'P2002') throw error;
        lastError = error;
      }
    }

    throw Object.assign(
      new Error(
        `Failed to append audit event for application ${applicationId} after ${maxAttempts} attempts ` +
        `due to concurrent chain writes. The chain was not modified.`,
      ),
      { cause: lastError },
    );
  }

  /**
   * Verify the hash-chain integrity of all audit events for an application.
   * Uses per-event hashVersion to select the correct formula.
   * Returns { valid: boolean, brokenAt?: string } — brokenAt is the id of the first tampered event.
   */
  static async verifyChain(
    applicationId: string,
  ): Promise<{ valid: boolean; brokenAt?: string }> {
    // LOS-013 — Walk the chain in the same order it was written: by sequence.
    // Ordering by createdAt tied on millisecond-precision timestamps and broke
    // verification for any application with two appends in the same millisecond.
    const events = await prisma.creditAuditEvent.findMany({
      where: { applicationId },
      orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
    });
    let previousHash = '';
    for (const event of events) {
      const expected = await this.computeHash({
        id: event.id,
        applicationId: event.applicationId,
        eventType: event.eventType,
        actorId: event.actorId,
        action: event.action,
        oldState: event.oldState,
        newState: event.newState,
        metadata: event.metadata,
        createdAt: event.createdAt,
        previousHash,
        hashVersion: (event as any).hashVersion ?? 1, // v1 for rows that predate the column
      });
      if (event.hash !== expected) {
        return { valid: false, brokenAt: event.id };
      }
      previousHash = event.hash;
    }
    return { valid: true };
  }

  /**
   * LOS-013 — Escape hatch for maintenance operations that legitimately need to
   * rewrite the chain (hash-format migration, test teardown, `prisma migrate
   * reset`). Sets the transaction-scoped GUC the immutability trigger checks.
   * Never call this from request-handling code.
   */
  static async withImmutabilityBypass<T>(
    fn: (tx: TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(async (tx) => {
      // `true` = transaction-local; released on commit/rollback, so it cannot
      // leak to another request sharing this pooled connection.
      await tx.$executeRaw`SELECT set_config('app.audit_chain_bypass', 'on', true)`;
      return fn(tx as TransactionClient);
    });
  }
}