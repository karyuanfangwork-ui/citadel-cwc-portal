import { applyRetention, buildRetentionReport, runRetention } from '../scripts/retain-crm-leads';

const tenantId = '00000000-0000-0000-0000-000000000001';
const retainedEmails = [
  ' Rohani.Munir@CitadelGroup.com.my ',
  'thasha.shaharis@citadelgroup.com.my',
  'cristel.erguiza@citadelgroup.com.my',
];

const rawLeads = [
  { id: 'keep-1', title: 'Keep me', status: 'NEW', ownerId: 'rohani', contactEmail: 'keep@example.com', deletedAt: null, owner: { email: 'rohani.munir@citadelgroup.com.my' } },
  { id: 'keep-2', title: 'Keep converted', status: 'CONVERTED', ownerId: 'thasha', contactEmail: 'converted@example.com', deletedAt: null, owner: { email: 'thasha.shaharis@citadelgroup.com.my' } },
  { id: 'archive-1', title: 'Archive me', status: 'QUALIFIED', ownerId: 'other', contactEmail: 'archive@example.com', deletedAt: null, owner: { email: 'other@example.com' } },
  { id: 'archive-2', title: 'Archive lost', status: 'LOST', ownerId: 'other', contactEmail: null, deletedAt: null, owner: { email: 'other@example.com' } },
  { id: 'already-deleted', title: 'Already deleted', status: 'NEW', ownerId: 'other', contactEmail: null, deletedAt: new Date('2026-01-01'), owner: { email: 'other@example.com' } },
];

function createDb() {
  const tx = {
    crmLead: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
  };
  const db = {
    user: { findMany: jest.fn().mockResolvedValue([
      { id: 'rohani', email: 'rohani.munir@citadelgroup.com.my' },
      { id: 'thasha', email: 'thasha.shaharis@citadelgroup.com.my' },
      { id: 'cristel', email: 'cristel.erguiza@citadelgroup.com.my' },
    ]) },
    crmLead: { findMany: jest.fn().mockResolvedValue(rawLeads), updateMany: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<number>) => callback(tx)),
  };
  return { db, tx };
}

describe('CRM lead retention operation', () => {
  it('normalizes the allowlist and reports only active non-allowlisted candidates', async () => {
    const { db } = createDb();
    const { report } = await buildRetentionReport(db as any, tenantId, retainedEmails);

    expect(report.allowlistedEmails).toEqual([
      'rohani.munir@citadelgroup.com.my',
      'thasha.shaharis@citadelgroup.com.my',
      'cristel.erguiza@citadelgroup.com.my',
    ]);
    expect(report.totalRows).toBe(5);
    expect(report.activeRows).toBe(4);
    expect(report.alreadyDeletedRows).toBe(1);
    expect(report.retainedActiveRows).toBe(2);
    expect(report.candidateCount).toBe(2);
    expect(report.candidateStatusCounts).toEqual({ QUALIFIED: 1, LOST: 1 });
    expect(report.candidates.map(candidate => candidate.id)).toEqual(['archive-1', 'archive-2']);
    expect(db.crmLead.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId } }));
  });

  it('does not write during dry-run', async () => {
    const { db, tx } = createDb();
    const report = await runRetention({ db: db as any, tenantId, retainedOwnerEmails: retainedEmails });

    expect(report.applied).toBe(false);
    expect(db.crmLead.updateMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('soft-deletes the exact candidate set and writes one audit record per lead', async () => {
    const { db, tx } = createDb();
    const report = await runRetention({
      db: db as any,
      tenantId,
      retainedOwnerEmails: retainedEmails,
      apply: true,
      expectedCandidates: 2,
    });

    expect(report.applied).toBe(true);
    expect(report.archivedCount).toBe(2);
    expect(tx.crmLead.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId, id: { in: ['archive-1', 'archive-2'] }, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    }));
    expect(tx.auditLog.create).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId, resourceType: 'CrmLead', action: 'DELETE' }),
    }));
  });

  it('fails closed when an allowlisted owner is missing', async () => {
    const { db } = createDb();
    db.user.findMany.mockResolvedValueOnce([{ id: 'rohani', email: 'rohani.munir@citadelgroup.com.my' }]);

    await expect(buildRetentionReport(db as any, tenantId, retainedEmails))
      .rejects.toThrow('RETENTION_OWNER_NOT_FOUND');
    expect(db.crmLead.findMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an apply when the expected candidate count is stale', async () => {
    const { db } = createDb();
    await expect(applyRetention(db as any, tenantId, rawLeads.slice(2, 4).map(({ owner, ...lead }) => ({ ...lead, ownerEmail: owner.email })), 21))
      .rejects.toThrow('RETENTION_EXPECTED_COUNT_MISMATCH');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
