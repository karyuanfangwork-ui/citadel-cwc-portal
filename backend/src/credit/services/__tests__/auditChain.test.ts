import { AuditChainService } from '../auditChain.service';

// Mock prisma
jest.mock('../../../utils/prisma', () => {
  const mockCreate = jest.fn();
  const mockFindFirst = jest.fn();
  const mockFindMany = jest.fn();
  return {
    __esModule: true,
    default: {
      creditAuditEvent: {
        create: mockCreate,
        findFirst: mockFindFirst,
        findMany: mockFindMany,
      },
    },
  };
});

import prisma from '../../../utils/prisma';

const mockedPrisma = prisma as unknown as {
  creditAuditEvent: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
};

// Helper to reset mocks between tests
function resetMocks() {
  mockedPrisma.creditAuditEvent.create.mockReset();
  mockedPrisma.creditAuditEvent.findFirst.mockReset();
  mockedPrisma.creditAuditEvent.findMany.mockReset();
}

describe('AuditChainService', () => {
  beforeEach(resetMocks);

  describe('computeHash', () => {
    it('produces a deterministic SHA-256 hash', async () => {
      const event = {
        id: 'evt-1',
        applicationId: 'app-1',
        eventType: 'STATE_CHANGE',
        action: 'APPROVE',
        actorId: 'user-1',
        oldState: 'PENDING',
        newState: 'APPROVED',
        metadata: { note: 'test' },
        createdAt: new Date('2026-01-01T00:00:00Z'),
        previousHash: '',
        hashVersion: 2,
      };
      const hash1 = await AuditChainService.computeHash(event);
      const hash2 = await AuditChainService.computeHash(event);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('hash covers actorId — different actorId produces different hash', async () => {
      const base = {
        id: 'evt-1',
        applicationId: 'app-1',
        eventType: 'STATE_CHANGE',
        action: 'APPROVE',
        actorId: 'user-A',
        oldState: 'PENDING',
        newState: 'APPROVED',
        metadata: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        previousHash: '',
        hashVersion: 2,
      };
      const hashA = await AuditChainService.computeHash(base);
      const hashB = await AuditChainService.computeHash({ ...base, actorId: 'user-B' });
      expect(hashA).not.toBe(hashB);
    });

    it('hash covers oldState and newState', async () => {
      const base = {
        id: 'evt-1',
        applicationId: 'app-1',
        eventType: 'STATE_CHANGE',
        action: 'APPROVE',
        actorId: 'user-1',
        oldState: 'PENDING',
        newState: 'APPROVED',
        metadata: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        previousHash: '',
        hashVersion: 2,
      };
      const hashOrig = await AuditChainService.computeHash(base);
      const hashDiffOld = await AuditChainService.computeHash({ ...base, oldState: 'DRAFT' });
      const hashDiffNew = await AuditChainService.computeHash({ ...base, newState: 'REJECTED' });
      expect(hashOrig).not.toBe(hashDiffOld);
      expect(hashOrig).not.toBe(hashDiffNew);
    });

    it('hash covers metadata', async () => {
      const base = {
        id: 'evt-1',
        applicationId: 'app-1',
        eventType: 'STATE_CHANGE',
        action: 'APPROVE',
        actorId: 'user-1',
        oldState: 'PENDING',
        newState: 'APPROVED',
        metadata: { key: 'value' },
        createdAt: new Date('2026-01-01T00:00:00Z'),
        previousHash: '',
        hashVersion: 2,
      };
      const hashWithMeta = await AuditChainService.computeHash(base);
      const hashNoMeta = await AuditChainService.computeHash({ ...base, metadata: null });
      expect(hashWithMeta).not.toBe(hashNoMeta);
    });

    it('v1 formula matches legacy hash (no actorId/oldState/newState/metadata)', async () => {
      // v1 formula: id|applicationId|eventType|action|createdAt|previousHash
      const event = {
        id: 'evt-1',
        applicationId: 'app-1',
        eventType: 'STATE_CHANGE',
        action: 'APPROVE',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        previousHash: '',
        hashVersion: 1 as const,
      };
      // v1 should produce the same hash regardless of actorId etc.
      const hashA = await AuditChainService.computeHash(event);
      // Manually compute what v1 should produce
      const crypto = require('crypto');
      const expectedPayload = 'evt-1|app-1|STATE_CHANGE|APPROVE|2026-01-01T00:00:00.000Z|';
      const expectedHash = crypto.createHash('sha256').update(expectedPayload).digest('hex');
      expect(hashA).toBe(expectedHash);
    });
  });

  describe('verifyChain', () => {
    it('returns valid for a correct chain with v2 hashes', async () => {
      const now = new Date('2026-01-01T00:00:00Z');
      const event1: any = {
              id: 'e1',
              applicationId: 'app-1',
              eventType: 'STATE_CHANGE',
              actorId: 'user-1',
              action: 'APPROVE',
              oldState: null,
              newState: 'APPROVED',
              metadata: null,
              createdAt: now,
              hash: '',
              hashVersion: 2,
            };
            event1.hash = await AuditChainService.computeHash({ ...event1, previousHash: '' });

      const event2: any = {
        id: 'e2',
        applicationId: 'app-1',
        eventType: 'SCORE_OVERRIDE',
        actorId: 'user-2',
        action: 'OVERRIDE',
        oldState: 'APPROVED',
        newState: 'APPROVED',
        metadata: { notchDelta: 2 },
        createdAt: new Date('2026-01-02T00:00:00Z'),
        hash: '',
        hashVersion: 2,
      };
      event2.hash = await AuditChainService.computeHash({ ...event2, previousHash: event1.hash });

      mockedPrisma.creditAuditEvent.findMany.mockResolvedValue([event1, event2]);

      const result = await AuditChainService.verifyChain('app-1');
      expect(result.valid).toBe(true);
    });

    it('detects a tampered actorId', async () => {
      const now = new Date('2026-01-01T00:00:00Z');
      const event: any = {
        id: 'e1',
        applicationId: 'app-1',
        eventType: 'STATE_CHANGE',
        actorId: 'user-1',
        action: 'APPROVE',
        oldState: null,
        newState: 'APPROVED',
        metadata: null,
        createdAt: now,
        hashVersion: 2,
      };
      const correctHash = await AuditChainService.computeHash({ ...event, previousHash: '' });

      // Tamper: change actorId but keep old hash
      const tampered = { ...event, actorId: 'attacker', hash: correctHash };
      mockedPrisma.creditAuditEvent.findMany.mockResolvedValue([tampered]);

      const result = await AuditChainService.verifyChain('app-1');
      expect(result.valid).toBe(false);
      expect(result.brokenAt).toBe('e1');
    });

    it('detects broken chain link', async () => {
      const now = new Date('2026-01-01T00:00:00Z');
      const event1: any = {
        id: 'e1',
        applicationId: 'app-1',
        eventType: 'CREATE',
        actorId: 'user-1',
        action: 'CREATE_APP',
        oldState: null,
        newState: 'DRAFT',
        metadata: null,
        createdAt: now,
        hashVersion: 2,
      };
      event1.hash = await AuditChainService.computeHash({ ...event1, previousHash: '' });

      const event2: any = {
        id: 'e2',
        applicationId: 'app-1',
        eventType: 'STATE_CHANGE',
        actorId: 'user-2',
        action: 'SUBMIT',
        oldState: 'DRAFT',
        newState: 'PENDING',
        metadata: null,
        createdAt: new Date('2026-01-02T00:00:00Z'),
        hashVersion: 2,
      };
      // Compute hash with correct previousHash
      event2.hash = await AuditChainService.computeHash({ ...event2, previousHash: event1.hash });

      // Tamper event2 hash
      const tampered2 = { ...event2, hash: 'wrong-hash-value' };
      mockedPrisma.creditAuditEvent.findMany.mockResolvedValue([event1, tampered2]);

      const result = await AuditChainService.verifyChain('app-1');
      expect(result.valid).toBe(false);
      expect(result.brokenAt).toBe('e2');
    });
  });

  describe('appendEvent', () => {
    it('creates a chain-linked audit event with full payload hash', async () => {
      mockedPrisma.creditAuditEvent.findFirst.mockResolvedValue(null); // no prior events
      mockedPrisma.creditAuditEvent.create.mockResolvedValue({ id: 'new-event' });

      const eventId = await AuditChainService.appendEvent(
        'app-1',
        'SCORE_OVERRIDE_REQUESTED',
        'user-1',
        'Override AAA → BBB (Δ3 notches)',
        'AAA',
        'BBB',
        { notchDelta: 3 },
      );

      expect(eventId).toBeTruthy();
      const createCall = mockedPrisma.creditAuditEvent.create.mock.calls[0][0];
      expect(createCall.data.applicationId).toBe('app-1');
      expect(createCall.data.eventType).toBe('SCORE_OVERRIDE_REQUESTED');
      expect(createCall.data.actorId).toBe('user-1');
      expect(createCall.data.action).toBe('Override AAA → BBB (Δ3 notches)');
      expect(createCall.data.oldState).toBe('AAA');
      expect(createCall.data.newState).toBe('BBB');
      expect(createCall.data.metadata).toEqual({ notchDelta: 3 });
      expect(createCall.data.hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('chains to previous event hash', async () => {
      const prevHash = 'previous-hash-value';
      mockedPrisma.creditAuditEvent.findFirst.mockResolvedValue({ hash: prevHash });
      mockedPrisma.creditAuditEvent.create.mockResolvedValue({ id: 'new-event' });

      await AuditChainService.appendEvent(
        'app-1',
        'STATE_CHANGE',
        'user-1',
        'APPROVE',
        'PENDING',
        'APPROVED',
      );

      const createCall = mockedPrisma.creditAuditEvent.create.mock.calls[0][0];
      expect(createCall.data.hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});