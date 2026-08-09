// Phase 6a — a broken audit chain must escalate
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Phase 6a — a broken audit chain must escalate', () => {
  it('the retention job does more than log when the chain is broken', () => {
    const source = readFileSync(
      join(__dirname, '..', 'jobs', 'auditRetention.job.ts'), 'utf8',
    );
    const brokenBranch = source.indexOf('if (!chainValid)');
    expect(brokenBranch).toBeGreaterThan(-1);
    const branchBody = source.slice(brokenBranch, brokenBranch + 1200);
    // The docstring has always claimed an EarlyWarningSignal is raised. Make it true.
    expect(branchBody).toMatch(/earlyWarningSignal|createSignal/);
  });

  it('exports a pre-disbursement chain assertion', async () => {
    const { AuditChainService } = await import('../services/auditChain.service');
    expect(typeof (AuditChainService as any).assertChainIntact).toBe('function');
  });

  it('disbursement asserts chain integrity before booking', () => {
    const source = readFileSync(
      join(__dirname, '..', 'services', 'disbursement.service.ts'), 'utf8',
    );
    const assertAt = source.indexOf('assertChainIntact');
    expect(assertAt).toBeGreaterThan(-1);
    // It must run before the booking call, not after it.
    const bookAt = source.indexOf('bookLoan');
    if (bookAt > -1) expect(assertAt).toBeLessThan(bookAt);
  });
});