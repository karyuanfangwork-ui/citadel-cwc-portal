import { applyOpportunityRetention, buildOpportunityRetentionReport, runOpportunityRetention } from '../scripts/retain-crm-opportunities';

const tenantId = '00000000-0000-0000-0000-000000000001';
const retainedEmails = [
  ' Rohani.Munir@CitadelGroup.com.my ',
  'thasha.shaharis@citadelgroup.com.my',
  'cristel.erguiza@citadelgroup.com.my',
];

const rawOpportunities = [
  { id: 'keep-1', name: 'Keep opportunity', ownerId: 'rohani', value: '100', deletedAt: null, owner: { email: 'rohani.munir@citadelgroup.com.my' }, stage: { name: 'Prospecting' } },
  { id: 'archive-1', name: 'Archive opportunity', ownerId: 'other', value: '200', deletedAt: null, owner: { email: 'other@example.com' }, stage: { name: 'Qualification' } },
  { id: 'archive-2', name: 'Archive closed won', ownerId: 'other', value: '300', deletedAt: null, owner: { email: 'other@example.com' }, stage: { name: 'Closed Won' } },
  { id: 'already-deleted', name: 'Already deleted', ownerId: 'other', value: '400', deletedAt: new Date('2026-01-01'), owner: { email: 'other@example.com' }, stage: { name: 'Closed Lost' } },
];

function createDb() {
  const tx = {
    crmOpportunity: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
  };
  const db = {
    user: { findMany: jest.fn().mockResolvedValue([
      { id: 'rohani', email: 'rohani.munir@citadelgroup.com.my' },
      { id: 'thasha', email: 'thasha.shaharis@citadelgroup.com.my' },
      { id: 'cristel', email: 'cristel.erguiza@citadelgroup.com.my' },
    ]) },
    crmOpportunity: { findMany: jest.fn().mockResolvedValue(rawOpportunities), updateMany: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<number>) => callback(tx)),
  };
  return { db, tx };
}

describe('CRM opportunity retention operation', () => {
  it('reports only active non-allowlisted opportunities', async () => {
    const { db } = createDb();
    const { report } = await buildOpportunityRetentionReport(db as any, tenantId, retainedEmails);

    expect(report.allowlistedEmails).toEqual([
      'rohani.munir@citadelgroup.com.my',
      'thasha.shaharis@citadelgroup.com.my',
      'cristel.erguiza@citadelgroup.com.my',
    ]);
    expect(report.totalRows).toBe(4);
    expect(report.activeRows).toBe(3);
    expect(report.alreadyDeletedRows).toBe(1);
    expect(report.retainedActiveRows).toBe(1);
    expect(report.candidateCount).toBe(2);
    expect(report.candidateStageCounts).toEqual({ Qualification: 1, 'Closed Won': 1 });
    expect(report.candidates.map(candidate => candidate.id)).toEqual(['archive-1', 'archive-2']);
  });

  it('does not write during dry-run', async () => {
    const { db, tx } = createDb();
    const report = await runOpportunityRetention({ db: db as any, tenantId, retainedOwnerEmails: retainedEmails });

    expect(report.applied).toBe(false);
    expect(db.crmOpportunity.updateMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('soft-deletes the exact candidate set and audits each opportunity', async () => {
    const { db, tx } = createDb();
    const report = await runOpportunityRetention({
      db: db as any,
      tenantId,
      retainedOwnerEmails: retainedEmails,
      apply: true,
      expectedCandidates: 2,
    });

    expect(report.applied).toBe(true);
    expect(report.archivedCount).toBe(2);
    expect(tx.crmOpportunity.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId, id: { in: ['archive-1', 'archive-2'] }, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    }));
    expect(tx.auditLog.create).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId, resourceType: 'CrmOpportunity', action: 'DELETE' }),
    }));
  });

  it('fails closed when an allowlisted owner is missing', async () => {
    const { db } = createDb();
    db.user.findMany.mockResolvedValueOnce([{ id: 'rohani', email: 'rohani.munir@citadelgroup.com.my' }]);

    await expect(buildOpportunityRetentionReport(db as any, tenantId, retainedEmails))
      .rejects.toThrow('RETENTION_OWNER_NOT_FOUND');
    expect(db.crmOpportunity.findMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an apply when the expected candidate count is stale', async () => {
    const { db } = createDb();
    const candidates = rawOpportunities.slice(1, 3).map(({ owner, stage, ...opportunity }) => ({
      ...opportunity,
      ownerEmail: owner.email,
      stageName: stage.name,
    }));
    await expect(applyOpportunityRetention(db as any, tenantId, candidates, 20))
      .rejects.toThrow('RETENTION_EXPECTED_COUNT_MISMATCH');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});