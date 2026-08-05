import { getBureauProvider, resetProviders } from '../registry';
import { isFeatureEnabled } from '../../middleware/featureFlag.middleware';
import { config } from '../../../config';

// ── Mocks ─────────────────────────────────────────────────────────────────
jest.mock('../../middleware/featureFlag.middleware', () => ({
  isFeatureEnabled: jest.fn(),
}));

jest.mock('../../../config', () => ({
  config: {
    env: 'development',
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { warn: jest.fn(), debug: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

const mockIsFeatureEnabled = isFeatureEnabled as jest.Mock;

describe('getBureauProvider', () => {
  beforeEach(() => {
    resetProviders();
    jest.clearAllMocks();
  });

  it('returns NoopBureauProvider in development without warning', async () => {
    mockIsFeatureEnabled.mockResolvedValue(false);
    const provider = await getBureauProvider();
    expect(provider).toBeDefined();
    const report = await provider.getIndividualReport({ nricPassport: '123456-78-1234' });
    expect(report.score).toBeNull();
    expect(report.providerRef).toMatch(/^NOOP-BUREAU-/);
  });

  it('returns NoopBureauProvider in production when flag is false', async () => {
    (config as any).env = 'production';
    mockIsFeatureEnabled.mockResolvedValue(false);
    const provider = await getBureauProvider();
    expect(provider).toBeDefined();
    (config as any).env = 'development'; // reset
  });

  it('throws in production when flag is true but no real provider configured', async () => {
    (config as any).env = 'production';
    mockIsFeatureEnabled.mockResolvedValue(true);
    delete process.env.BUREAU_PROVIDER;
    await expect(getBureauProvider()).rejects.toThrow('BureauProvider misconfig');
    (config as any).env = 'development'; // reset
  });

  it('logs warning once in production when no real provider and flag false', async () => {
    const { logger } = require('../../../utils/logger');
    (config as any).env = 'production';
    mockIsFeatureEnabled.mockResolvedValue(false);
    delete process.env.BUREAU_PROVIDER;

    await getBureauProvider();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('BureauProvider'),
    );

    // Second call should not warn again
    logger.warn.mockClear();
    await getBureauProvider();
    expect(logger.warn).not.toHaveBeenCalled();

    (config as any).env = 'development'; // reset
  });
});