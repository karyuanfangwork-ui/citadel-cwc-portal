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
    // same previousHash and forking the chain. Only acquired when inside a tx;
    // non-transactional callers (informational audit) don't need serialization.
    if (tx) {
      const lockKey = applicationIdToLockKey(applicationId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;
    }

    const lastEvent = await client.creditAuditEvent.findFirst({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    });
    const previousHash = lastEvent?.hash || '';
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
        createdAt,   // must match the timestamp used in hash computation
      },
    });
    return tempId;
  }

  /**
   * Verify the hash-chain integrity of all audit events for an application.
   * Uses per-event hashVersion to select the correct formula.
   * Returns { valid: boolean, brokenAt?: string } — brokenAt is the id of the first tampered event.
   */
  static async verifyChain(
    applicationId: string,
  ): Promise<{ valid: boolean; brokenAt?: string }> {
    const events = await prisma.creditAuditEvent.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'asc' },
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
}