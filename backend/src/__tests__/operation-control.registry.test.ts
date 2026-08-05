/**
 * Operation Control Registry Tests — P02/P03 Task 10
 *
 * Validates that every entry in the registry has complete security metadata
 * and that critical domains are covered. This test will be expanded as
 * more route families are migrated.
 */

import { operationControls } from '../security/operation-control.registry';

describe('Operation Control Registry', () => {
  it('rejects an operation without auth, policy, validation, response and audit metadata', () => {
    for (const control of operationControls) {
      expect(control.authentication).toBeDefined();
      expect(control.resourcePolicy).toBeTruthy();
      expect(control.validation).toBeTruthy();
      expect(control.responseSchema).toBeTruthy();
      expect(control.rateTier).toBeDefined();
      expect(control.auditEvent).toBeTruthy();
    }
  });

  it('has no duplicate method+path entries', () => {
    const keys = operationControls.map((c) => `${c.method} ${c.path}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('covers critical user endpoints (findings #6, #35)', () => {
    const userPaths = operationControls.filter((c) =>
      c.path.startsWith('/users'),
    );
    expect(userPaths.length).toBeGreaterThanOrEqual(11);
  });

  it('covers auth endpoints (findings #6, #35)', () => {
    const authPaths = operationControls.filter((c) =>
      c.path.startsWith('/auth'),
    );
    expect(authPaths.length).toBeGreaterThanOrEqual(5);
  });

  it('covers file download/upload (findings #7, #83, #84)', () => {
    const fileOps = operationControls.filter((c) =>
      c.path.startsWith('/files'),
    );
    expect(fileOps.length).toBeGreaterThanOrEqual(2);
  });

  it('covers request domain endpoints (findings #8–#18, #55)', () => {
    const requestOps = operationControls.filter((c) =>
      c.path.startsWith('/requests'),
    );
    // GET /, POST /, GET /pending-approvals, POST /bulk-action,
    // GET /recent-services, POST /export/xlsx, GET /:id, PUT /:id,
    // DELETE /:id, GET /:id/export/pdf, GET /:id/activities,
    // POST /:id/activities, POST /:id/attachments,
    // GET /:id/attachments/:attachmentId, DELETE /:id/attachments/:attachmentId,
    // PUT /:id/assign, PUT /:id/status, GET /:id/participants,
    // POST /:id/participants, DELETE /:id/participants/:userId
    expect(requestOps.length).toBeGreaterThanOrEqual(20);
  });

  it('covers request activities and participants (findings #13–#16)', () => {
    const activityOps = operationControls.filter((c) =>
      c.path.includes('/activities'),
    );
    expect(activityOps.length).toBeGreaterThanOrEqual(2);

    const participantOps = operationControls.filter((c) =>
      c.path.includes('/participants'),
    );
    expect(participantOps.length).toBeGreaterThanOrEqual(3);
  });

  it('covers notification mutations (findings #17, #18)', () => {
    const notifOps = operationControls.filter((c) =>
      c.path.startsWith('/notifications'),
    );
    expect(notifOps.length).toBeGreaterThanOrEqual(5);
  });

  it('covers PDF jobs and request exports (findings #35, #83, #84)', () => {
    const pdfOps = operationControls.filter((c) =>
      c.path.startsWith('/pdf-jobs'),
    );
    expect(pdfOps.length).toBeGreaterThanOrEqual(1);

    const exportOps = operationControls.filter((c) =>
      c.path.includes('/export'),
    );
    expect(exportOps.length).toBeGreaterThanOrEqual(2);
  });

  it('covers department endpoints (findings #1–#2, #29–#30)', () => {
    const deptOps = operationControls.filter((c) =>
      c.path.startsWith('/departments'),
    );
    expect(deptOps.length).toBeGreaterThanOrEqual(7);
  });

  it('covers announcement endpoints', () => {
    const ops = operationControls.filter((c) =>
      c.path.startsWith('/announcements'),
    );
    expect(ops.length).toBeGreaterThanOrEqual(12);
  });

  it('covers approval domain endpoints', () => {
    const approvalOps = operationControls.filter((c) =>
      c.path.startsWith('/approvals') || c.path.startsWith('/approval-'),
    );
    expect(approvalOps.length).toBeGreaterThanOrEqual(14);
  });

  it('covers asset management endpoints', () => {
    const ops = operationControls.filter((c) =>
      c.path.startsWith('/assets'),
    );
    expect(ops.length).toBeGreaterThanOrEqual(12);
  });

  it('covers tenant management endpoints (findings #1–#2)', () => {
    const ops = operationControls.filter((c) =>
      c.path.startsWith('/admin/tenants'),
    );
    expect(ops.length).toBeGreaterThanOrEqual(6);
  });

  it('covers knowledge base endpoints', () => {
    const ops = operationControls.filter((c) =>
      c.path.startsWith('/kb'),
    );
    expect(ops.length).toBeGreaterThanOrEqual(7);
  });

  it('covers search endpoints', () => {
    const ops = operationControls.filter((c) =>
      c.path.startsWith('/search'),
    );
    expect(ops.length).toBeGreaterThanOrEqual(4);
  });

  it('covers service desk endpoints', () => {
    const ops = operationControls.filter((c) =>
      c.path.startsWith('/service-desks'),
    );
    expect(ops.length).toBeGreaterThanOrEqual(7);
  });

  it('covers report endpoints', () => {
    const ops = operationControls.filter((c) =>
      c.path.startsWith('/reports'),
    );
    expect(ops.length).toBeGreaterThanOrEqual(6);
  });

  it('every request endpoint with :id has resourcePolicy set', () => {
    const requestOpsWithId = operationControls.filter((c) =>
      c.path.startsWith('/requests') && c.path.includes(':id'),
    );
    for (const op of requestOpsWithId) {
      expect(op.resourcePolicy).toBeTruthy();
      expect(op.resourcePolicy).not.toBe('none');
    }
  });

  it('covers CRM endpoints (findings #63, #75–#84)', () => {
    const crmOps = operationControls.filter((c) =>
      c.path.startsWith('/crm'),
    );
    expect(crmOps.length).toBeGreaterThanOrEqual(100);

    const crmAccounts = operationControls.filter((c) =>
      c.path.startsWith('/crm/accounts'),
    );
    expect(crmAccounts.length).toBeGreaterThanOrEqual(4);

    const crmContacts = operationControls.filter((c) =>
      c.path.startsWith('/crm/contacts'),
    );
    expect(crmContacts.length).toBeGreaterThanOrEqual(4);
  });

  it('covers credit module endpoints', () => {
    const creditOps = operationControls.filter((c) =>
      c.path.startsWith('/credit'),
    );
    expect(creditOps.length).toBeGreaterThanOrEqual(300);

    const appOps = operationControls.filter((c) =>
      c.path.includes('/applications'),
    );
    expect(appOps.length).toBeGreaterThanOrEqual(50);

    const borrowerOps = operationControls.filter((c) =>
      c.path.includes('/borrowers'),
    );
    expect(borrowerOps.length).toBeGreaterThanOrEqual(10);
  });

  it('sensitive and auth rate tiers are only used appropriately', () => {
    const authOps = operationControls.filter((c) => c.rateTier === 'auth');
    // Only auth-related operations should use 'auth' rate tier
    for (const op of authOps) {
      expect(op.path.startsWith('/auth') || op.auditEvent.startsWith('auth.')).toBe(true);
    }

    const sensitiveOps = operationControls.filter((c) => c.rateTier === 'sensitive');
    // Sensitive tier should be for deletes, exports, file downloads, privilege operations,
    // and platform-admin-only reads (audit logs, tenant admin)
    for (const op of sensitiveOps) {
      const isDelete = op.method === 'DELETE';
      const isExport = op.path.includes('/export');
      const isFileDownload = op.path.includes('/download') || op.path.includes('/attachments/:attachmentId');
      const isAdminDelete = op.path.startsWith('/users') && op.method === 'DELETE';
      const isDeptDelete = op.path.startsWith('/departments') && op.method === 'DELETE';
      const isPrivilegeOp = op.path.includes('/roles') || op.path.includes('/password');
      const isAdminRead = op.authentication === 'platform-admin' && op.method === 'GET';
      const isAssetDelete = op.path.startsWith('/assets') && op.method === 'DELETE';
      expect(
        isDelete || isExport || isFileDownload || isAdminDelete || isDeptDelete || isPrivilegeOp || isAdminRead || isAssetDelete,
      ).toBe(true);
    }
  });
});