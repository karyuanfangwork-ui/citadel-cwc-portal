import * as crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';

// TransactionClient accepts both raw PrismaClient and the tenant-aware extended client.
type TransactionClient = any;

const HASH_VERSION = 1;

type JsonRecord = Record<string, unknown> | null | undefined;

export interface PlatformAuditAppendInput {
  tenantId: string;
  departmentId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  correlationId?: string | null;
  oldValues?: JsonRecord;
  newValues?: JsonRecord;
  metadata?: JsonRecord;
}

export interface PlatformAuditVerificationScope {
  tenantId: string;
  resourceType?: string;
  resourceId?: string | null;
  correlationId?: string | null;
}

export class PlatformAuditChainService {
  static stableStringify(value: unknown): string {
    if (value === undefined) return 'null';
    if (value === null) return 'null';
    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.stableStringify(entry)).join(',')}]`;
    }
    if (value instanceof Date) {
      return JSON.stringify(value.toISOString());
    }
    if (typeof value === 'object') {
      return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${this.stableStringify((value as Record<string, unknown>)[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  static valueHash(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    return crypto.createHash('sha256').update(this.stableStringify(value)).digest('hex');
  }

  static computeHash(event: {
    id: string;
    tenantId: string;
    departmentId?: string | null;
    actorId?: string | null;
    actorEmail?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    correlationId?: string | null;
    oldValueHash?: string | null;
    newValueHash?: string | null;
    metadata?: unknown;
    createdAt: Date;
    previousHash?: string;
    hashVersion?: number;
  }): string {
    const metadataStr = this.stableStringify(event.metadata ?? null);
    const payload = [
      event.id,
      event.tenantId,
      event.departmentId ?? '',
      event.actorId ?? '',
      event.actorEmail ?? '',
      event.action,
      event.resourceType,
      event.resourceId ?? '',
      event.correlationId ?? '',
      event.oldValueHash ?? '',
      event.newValueHash ?? '',
      metadataStr,
      event.createdAt.toISOString(),
      event.previousHash ?? '',
      event.hashVersion ?? HASH_VERSION,
    ].join('|');
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  static async appendEvent(input: PlatformAuditAppendInput, tx?: TransactionClient): Promise<string> {
    const client = tx ?? prisma;
    const where: Record<string, unknown> = {
      tenantId: input.tenantId,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
    };
    const lastEvent = await client.platformAuditEvent.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    });
    const previousHash = lastEvent?.hash ?? '';
    const id = crypto.randomUUID();
    const createdAt = new Date();
    const oldValueHash = this.valueHash(input.oldValues);
    const newValueHash = this.valueHash(input.newValues);
    const hash = this.computeHash({
      id,
      tenantId: input.tenantId,
      departmentId: input.departmentId ?? null,
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      correlationId: input.correlationId ?? null,
      oldValueHash,
      newValueHash,
      metadata: input.metadata ?? null,
      createdAt,
      previousHash,
      hashVersion: HASH_VERSION,
    });

    await client.platformAuditEvent.create({
      data: {
        id,
        tenantId: input.tenantId,
        departmentId: input.departmentId ?? null,
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        correlationId: input.correlationId ?? null,
        oldValueHash,
        newValueHash,
        metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
        hash,
        hashVersion: HASH_VERSION,
        createdAt,
      },
    });

    return id;
  }

  static async verifyChain(scope: PlatformAuditVerificationScope): Promise<{ valid: boolean; brokenAt?: string }> {
    const events = await (prisma as any).platformAuditEvent.findMany({
      where: {
        tenantId: scope.tenantId,
        ...(scope.resourceType ? { resourceType: scope.resourceType } : {}),
        ...(scope.resourceId !== undefined ? { resourceId: scope.resourceId } : {}),
        ...(scope.correlationId ? { correlationId: scope.correlationId } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    let previousHash = '';
    for (const event of events) {
      const expected = this.computeHash({
        id: event.id,
        tenantId: event.tenantId,
        departmentId: event.departmentId,
        actorId: event.actorId,
        actorEmail: event.actorEmail,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        correlationId: event.correlationId,
        oldValueHash: event.oldValueHash,
        newValueHash: event.newValueHash,
        metadata: event.metadata,
        createdAt: event.createdAt,
        previousHash,
        hashVersion: event.hashVersion ?? HASH_VERSION,
      });
      if (event.hash !== expected) {
        return { valid: false, brokenAt: event.id };
      }
      previousHash = event.hash;
    }

    return { valid: true };
  }

  static async runPrivilegedAuditedMutation<T>(
    mutation: (tx: TransactionClient) => Promise<T>,
    audit: (tx: TransactionClient) => Promise<unknown>,
  ): Promise<T> {
    return prisma.$transaction(async (tx) => {
      const result = await mutation(tx);
      await audit(tx);
      return result;
    });
  }
}
