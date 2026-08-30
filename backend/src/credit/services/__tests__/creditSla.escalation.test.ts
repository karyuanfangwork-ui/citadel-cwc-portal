/** GAP-P0-01 — defence in depth for legacy unsafe SLA policies. */

const applicationUpdateMock = jest.fn();
const breachUpdateMock = jest.fn();
const breachFindManyMock = jest.fn();

jest.mock('../../../utils/prisma', () => {
  const mockPrisma: any = {
    creditSlaBreach: {
      findMany: (...args: unknown[]) => breachFindManyMock(...args),
      update: (...args: unknown[]) => breachUpdateMock(...args),
    },
    creditApplication: {
      update: (...args: unknown[]) => applicationUpdateMock(...args),
    },
  };
  mockPrisma.$transaction = jest.fn(async (fn: any) => fn(mockPrisma));
  return { __esModule: true, default: mockPrisma };
});

jest.mock('../auditChain.service', () => ({
  AuditChainService: { appendEvent: jest.fn().mockResolvedValue('evt-1') },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { creditSlaService } from '../creditSla.service';
import { logger } from '../../../utils/logger';

const APP_ID = '00000000-0000-4000-8000-000000000001';

function makeBreach(escalateToState: string | null) {
  return {
    id: 'breach-1',
    applicationId: APP_ID,
    policyId: 'policy-1',
    breachedAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
    policy: {
      id: 'policy-1',
      name: 'Legacy policy',
      escalateAfterHours: 1,
      escalateToState,
      notifyRoles: ['CREDIT_MANAGER'],
    },
    application: { id: APP_ID, state: 'CREDIT_ASSESSMENT', applicationNo: 'CA-2026-00001' },
  };
}

beforeEach(() => {
  applicationUpdateMock.mockReset().mockResolvedValue({});
  breachUpdateMock.mockReset().mockResolvedValue({});
  breachFindManyMock.mockReset();
  (logger.error as jest.Mock).mockClear();
});

describe('processEscalations — unsafe stored escalateToState (GAP-P0-01)', () => {
  it.each(['APPROVED', 'DISBURSED', 'ACTIVE', 'ACCEPTED', 'REJECTED'])(
    'refuses to escalate into %s and does not touch the application',
    async (unsafeState) => {
      breachFindManyMock.mockResolvedValue([makeBreach(unsafeState)]);
      const count = await creditSlaService.processEscalations();
      expect(count).toBe(0);
      expect(applicationUpdateMock).not.toHaveBeenCalled();
      expect(breachUpdateMock).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('unsafe escalateToState'),
        expect.objectContaining({ escalateToState: unsafeState }),
      );
    },
  );

  it.each(['COMPLIANCE_HOLD', 'REFERRED_BACK'])('still escalates into the safe state %s', async (safeState) => {
    breachFindManyMock.mockResolvedValue([makeBreach(safeState)]);
    const count = await creditSlaService.processEscalations();
    expect(count).toBe(1);
    expect(applicationUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { state: safeState } }),
    );
  });

  it('processes remaining breaches after skipping an unsafe one', async () => {
    breachFindManyMock.mockResolvedValue([makeBreach('APPROVED'), makeBreach('REFERRED_BACK')]);
    const count = await creditSlaService.processEscalations();
    expect(count).toBe(1);
    expect(applicationUpdateMock).toHaveBeenCalledTimes(1);
  });
});
