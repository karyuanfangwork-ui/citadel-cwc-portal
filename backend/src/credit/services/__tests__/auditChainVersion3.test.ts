import { AuditChainService } from '../auditChain.service';
import prisma from '../../../utils/prisma';
import { AppError, errorHandler } from '../../../middleware/error.middleware';

jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: { creditAuditEvent: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() } },
}));
const db = prisma as unknown as { creditAuditEvent: { create: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock } };
const date = new Date('2026-01-01T00:00:00Z');
const base = { id: 'e1', sequence: 1, applicationId: 'app-1', eventType: 'AML_RESCREEN_QUEUED',
  actorId: null, action: 'aml_rescreen_queued', oldState: null, newState: null, createdAt: date, hashVersion: 2 };
const amlSource = { provider: 'AML_RESCREEN', reason: 'quarterly_rescreen', rescreenIntervalDays: 90 };
const amlReadback = { reason: 'quarterly_rescreen', provider: 'AML_RESCREEN', rescreenIntervalDays: 90 };

beforeEach(() => {
  jest.resetAllMocks();
  db.creditAuditEvent.findFirst.mockResolvedValue(null);
  db.creditAuditEvent.create.mockResolvedValue({ id: 'new' });
});

describe('audit hash v3 and restricted legacy diagnosis', () => {
  it('v3 hashes nested JSON independently of object key insertion order', async () => {
    const input = { ...base, hashVersion: 3, metadata: { z: [{ longKey: 'value', a: 1 }], a: { last: true, first: null } } };
    const reordered = { ...input, metadata: { a: { first: null, last: true }, z: [{ a: 1, longKey: 'value' }] } };
    expect(await AuditChainService.computeHash(input)).toBe(await AuditChainService.computeHash(reordered));
    expect(await AuditChainService.computeHash({ ...input, metadata: { ...input.metadata, z: [{ a: 2, longKey: 'value' }] } }))
      .not.toBe(await AuditChainService.computeHash(input));
  });

  it('writes v3 and refuses unsupported hash versions', async () => {
    await AuditChainService.appendEvent('app-1', 'TEST', null, 'test', null, null, { z: 1, a: 2 });
    expect(db.creditAuditEvent.create.mock.calls[0][0].data.hashVersion).toBe(3);
    await expect(AuditChainService.computeHash({ ...base, hashVersion: 999 })).rejects.toThrow('Unsupported audit hash version');
  });

  it('strictly rejects legacy mismatches while the opt-in diagnostic recognizes only source-order AML', async () => {
    const hash = await AuditChainService.computeHash({ ...base, metadata: amlSource, previousHash: '' });
    db.creditAuditEvent.findMany.mockResolvedValue([{ ...base, metadata: amlReadback, hash }]);
    await expect(AuditChainService.verifyChain('app-1')).resolves.toEqual({ valid: false, brokenAt: 'e1' });
    await expect(AuditChainService.verifyChainWithLegacyCompatibility('app-1')).resolves.toEqual({ valid: true, legacyCompatibleEvents: 1 });
    let refusal: unknown;
    try { await AuditChainService.assertChainIntact('app-1'); } catch (error) { refusal = error; }
    expect(refusal).toBeInstanceOf(AppError);
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    errorHandler(refusal as AppError,
      { originalUrl: '/api/v1/credit/disbursements', method: 'POST', ip: '127.0.0.1' } as Parameters<typeof errorHandler>[1],
      res as unknown as Parameters<typeof errorHandler>[2], jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    for (const changed of [
      { metadata: { ...amlReadback, rescreenIntervalDays: 91 } },
      { metadata: { ...amlReadback, unreviewed: 'extra' } },
      { eventType: 'OTHER' }, { actorId: 'user-1' },
    ]) {
      db.creditAuditEvent.findMany.mockResolvedValue([{ ...base, metadata: amlReadback, hash, ...changed }]);
      await expect(AuditChainService.verifyChainWithLegacyCompatibility('app-1')).resolves.toEqual({ valid: false, brokenAt: 'e1' });
    }
  });

  it('diagnoses nested evidence mapping followed by AML without modifying either hash', async () => {
    const mapping = { fieldKey: 'income', fieldLabel: 'Income', sourceType: 'MANUAL_ENTRY',
      documentId: null, documentLabel: null, note: 'fixture', autoPopulated: false,
      ocrExtracted: false, confidence: 'HIGH' };
    const first = { ...base, eventType: 'EVIDENCE_MAPPING', action: 'upsert_evidence_mapping',
      actorId: 'user-1', metadata: { version: 1, mappings: [{ note: 'fixture', fieldKey: 'income',
        confidence: 'HIGH', documentId: null, fieldLabel: 'Income', sourceType: 'MANUAL_ENTRY',
        ocrExtracted: false, autoPopulated: false, documentLabel: null }], sourceSummary: null } };
    const firstHash = await AuditChainService.computeHash({ ...first,
      metadata: { sourceSummary: null, mappings: [mapping], version: 1 }, previousHash: '' });
    const second = { ...base, id: 'e2', sequence: 2, createdAt: new Date('2026-01-02T00:00:00Z'),
      metadata: amlReadback };
    const secondHash = await AuditChainService.computeHash({ ...second, metadata: amlSource, previousHash: firstHash });
    db.creditAuditEvent.findMany.mockResolvedValue([{ ...first, hash: firstHash }, { ...second, hash: secondHash }]);
    await expect(AuditChainService.verifyChainWithLegacyCompatibility('app-1')).resolves.toEqual({ valid: true, legacyCompatibleEvents: 2 });
    await expect(AuditChainService.verifyChain('app-1')).resolves.toEqual({ valid: false, brokenAt: 'e1' });
  });

  it('diagnoses a v3 event linked to a legacy-v2 predecessor but keeps the strict gate closed', async () => {
    const firstHash = await AuditChainService.computeHash({ ...base, metadata: amlSource, previousHash: '' });
    const first = { ...base, metadata: amlReadback, hash: firstHash };
    const next = { ...base, id: 'e2', sequence: 2, hashVersion: 3,
      createdAt: new Date('2026-01-02T00:00:00Z'), metadata: { z: 'value', a: true } };
    const secondHash = await AuditChainService.computeHash({ ...next, previousHash: firstHash });
    db.creditAuditEvent.findMany.mockResolvedValue([first, { ...next, hash: secondHash }]);
    await expect(AuditChainService.verifyChainWithLegacyCompatibility('app-1')).resolves.toEqual({
      valid: true, legacyCompatibleEvents: 1,
    });
    await expect(AuditChainService.verifyChain('app-1')).resolves.toEqual({ valid: false, brokenAt: 'e1' });
  });
});
