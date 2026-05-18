import * as crypto from 'crypto';
import prisma from '../../utils/prisma';

export class AuditChainService {
  static async computeHash(event: {
    id: string;
    applicationId: string;
    eventType: string;
    action: string;
    createdAt: Date;
    previousHash?: string;
  }): Promise<string> {
    const payload = `${event.id}|${event.applicationId}|${event.eventType}|${event.action}|${event.createdAt.toISOString()}|${event.previousHash || ''}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  static async appendEvent(
    applicationId: string,
    eventType: string,
    actorId: string | null,
    action: string,
    oldState?: string,
    newState?: string,
    metadata?: any,
  ): Promise<void> {
    const lastEvent = await prisma.creditAuditEvent.findFirst({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    });
    const previousHash = lastEvent?.hash || '';
    const tempId = crypto.randomUUID();
    const hash = await this.computeHash({
      id: tempId,
      applicationId,
      eventType,
      action,
      createdAt: new Date(),
      previousHash,
    });
    await prisma.creditAuditEvent.create({
      data: {
        id: tempId,
        applicationId,
        eventType,
        actorId,
        action,
        oldState,
        newState,
        metadata,
        hash,
      },
    });
  }

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
        action: event.action,
        createdAt: event.createdAt,
        previousHash,
      });
      if (event.hash !== expected) {
        return { valid: false, brokenAt: event.id };
      }
      previousHash = event.hash;
    }
    return { valid: true };
  }
}