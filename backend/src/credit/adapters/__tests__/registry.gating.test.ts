// backend/src/credit/adapters/__tests__/registry.gating.test.ts
describe('LOS-021 — record-only integration gating', () => {
  const OLD_ENV = process.env;
  beforeEach(() => { jest.resetModules(); process.env = { ...OLD_ENV }; });
  afterAll(() => { process.env = OLD_ENV; });

  it('reports every capability, not just three', async () => {
    const { getIntegrationsStatus } = await import('../registry');
    expect(Object.keys(getIntegrationsStatus()).sort()).toEqual(['aml', 'bureau', 'cbs', 'esign', 'ocr']);
  });

  it('marks CBS as PLACEHOLDER when no vendor is configured', async () => {
    delete process.env.CBS_PROVIDER;
    const { getIntegrationsStatus } = await import('../registry');
    expect(getIntegrationsStatus().cbs).toBe('PLACEHOLDER');
  });

  it('allows placeholder CBS while CREDIT_LIVE_LENDING is off', async () => {
    delete process.env.CBS_PROVIDER;
    process.env.CREDIT_LIVE_LENDING = 'false';
    const { assertRecordOnlyAllowed } = await import('../registry');
    expect(() => assertRecordOnlyAllowed('cbs')).not.toThrow();
  });

  it('fails closed when live lending is enabled against a placeholder CBS', async () => {
    delete process.env.CBS_PROVIDER;
    process.env.CREDIT_LIVE_LENDING = 'true';
    const { assertRecordOnlyAllowed } = await import('../registry');
    try {
      assertRecordOnlyAllowed('cbs');
      throw new Error('expected assertRecordOnlyAllowed to throw');
    } catch (e: any) {
      expect(e.statusCode).toBe(503);
      expect(e.message).toMatch(/CBS_PROVIDER/);
    }
  });

  it('placeholder CBS booking references are visibly simulated', async () => {
    const { PlaceholderCbsProvider } = await import('../cbs.placeholder');
    const result = await new PlaceholderCbsProvider().bookFacility({ applicationId: 'app-1' } as any);
    expect(JSON.stringify(result)).toMatch(/SIMULATED/);
  });
});