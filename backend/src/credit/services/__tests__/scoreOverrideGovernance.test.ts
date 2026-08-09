/**
 * LOS-008 — one governed override path.
 *
 * Defects covered:
 *  - scoreRunId was never persisted, so approved overrides never reached the run
 *  - originalRating came from the client, letting the caller pick the notch delta
 *  - justification was optional
 */
const txCreate = jest.fn(async (a: any) => ({ id: 'ov-1', ...a.data }));

jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditScoreRun: { findFirst: jest.fn(), update: jest.fn() },
    scoreOverrideApproval: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(async (fn: any) => fn({
      scoreOverrideApproval: { create: txCreate, update: jest.fn(async (a: any) => a.data) },
      creditScoreRun: { update: jest.fn() },
    })),
  },
}));

jest.mock('../auditChain.service', () => ({
  AuditChainService: { appendEvent: jest.fn().mockResolvedValue('evt') },
}));

import prisma from '../../../utils/prisma';
import { requestScoreOverride } from '../scoreOverride.service';
import { AppError } from '../../../middleware/error.middleware';

const mocked = prisma as unknown as {
  creditScoreRun: { findFirst: jest.Mock };
  scoreOverrideApproval: { create: jest.Mock };
  $transaction: jest.Mock;
};

const APP_ID = '11111111-1111-4111-8111-111111111111';
const RUN_ID = '22222222-2222-4222-8222-222222222222';
const APPROVER = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  txCreate.mockImplementation(async (a: any) => ({ id: 'ov-1', ...a.data }));
});

describe('requestScoreOverride', () => {
  it('derives the score run and original rating from the latest run', async () => {
    mocked.creditScoreRun.findFirst.mockResolvedValue({ id: RUN_ID, riskRating: 'BBB' });

    const result = await requestScoreOverride({
      applicationId: APP_ID,
      overrideRating: 'BB',
      justification: 'Collateral revaluation supports a one-notch downgrade.',
      approverId: APPROVER,
    });

    expect(result.originalRating).toBe('BBB');
    expect(result.scoreRunId).toBe(RUN_ID);
    // The created record must carry the run id — this is the inert-override bug.
    // Now that create happens inside $transaction, check txCreate instead.
    expect(txCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ scoreRunId: RUN_ID }) }),
    );
  });

  it('computes the notch delta from the derived rating, not a client value', async () => {
    mocked.creditScoreRun.findFirst.mockResolvedValue({ id: RUN_ID, riskRating: 'AAA' });

    const result = await requestScoreOverride({
      applicationId: APP_ID,
      overrideRating: 'BBB',      // AAA(1) -> BBB(4) = 3 notches
      justification: 'Material downgrade following audit qualification.',
      approverId: APPROVER,
    });

    expect(result.notchDelta).toBe(3);
    expect(result.requiresSecondApproval).toBe(true);
  });

  it('rejects the request when the application has no score run', async () => {
    mocked.creditScoreRun.findFirst.mockResolvedValue(null);

    await expect(requestScoreOverride({
      applicationId: APP_ID,
      overrideRating: 'BB',
      justification: 'Cannot override what was never scored.',
      approverId: APPROVER,
    })).rejects.toBeInstanceOf(AppError);
  });

  it('rejects an unknown override rating', async () => {
    mocked.creditScoreRun.findFirst.mockResolvedValue({ id: RUN_ID, riskRating: 'BBB' });

    await expect(requestScoreOverride({
      applicationId: APP_ID,
      overrideRating: 'BBB-',   // modifier notation is not a RiskRating
      justification: 'Modifier grades are not issued by this system.',
      approverId: APPROVER,
    })).rejects.toBeInstanceOf(AppError);
  });

  it('rejects a no-op override', async () => {
    mocked.creditScoreRun.findFirst.mockResolvedValue({ id: RUN_ID, riskRating: 'BBB' });

    await expect(requestScoreOverride({
      applicationId: APP_ID,
      overrideRating: 'BBB',
      justification: 'Same rating is not an override.',
      approverId: APPROVER,
    })).rejects.toBeInstanceOf(AppError);
  });

  it('wraps create + audit in a transaction', async () => {
    mocked.creditScoreRun.findFirst.mockResolvedValue({ id: RUN_ID, riskRating: 'BBB' });
    mocked.$transaction.mockClear();
    txCreate.mockImplementation(async (a: any) => ({ id: 'ov-1', ...a.data }));

    await requestScoreOverride({
      applicationId: APP_ID,
      overrideRating: 'BB',
      justification: 'Transactionality test.',
      approverId: APPROVER,
    });

    expect(mocked.$transaction).toHaveBeenCalled();
  });
});