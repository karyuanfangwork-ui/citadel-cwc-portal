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
    expect(userPaths.length).toBeGreaterThanOrEqual(4);

    const authPaths = operationControls.filter((c) =>
      c.path.startsWith('/auth'),
    );
    expect(authPaths.length).toBeGreaterThanOrEqual(1);
  });

  it('covers file download/upload (findings #7, #83, #84)', () => {
    const fileOps = operationControls.filter((c) =>
      c.path.startsWith('/files'),
    );
    expect(fileOps.length).toBeGreaterThanOrEqual(2);
  });

  it('covers request activities and participants (findings #13–#16)', () => {
    const activityOps = operationControls.filter((c) =>
      c.path.includes('/activities'),
    );
    expect(activityOps.length).toBeGreaterThanOrEqual(1);

    const participantOps = operationControls.filter((c) =>
      c.path.includes('/participants'),
    );
    expect(participantOps.length).toBeGreaterThanOrEqual(1);
  });

  it('covers notification mutations (findings #17, #18)', () => {
    const notifOps = operationControls.filter((c) =>
      c.path.startsWith('/notifications'),
    );
    expect(notifOps.length).toBeGreaterThanOrEqual(4);
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
});