/**
 * Tests for race-safe state transitions and mandatory OCC (Task 15 — F25).
 * Covers:
 *  - transition fails if state changed since read (guard in where clause)
 *  - update without version throws AppError('version required', 428)
 */

jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditApplication: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    creditDecision: { findMany: jest.fn() },
    creditDocument: { findFirst: jest.fn() },
    disbursementOrder: { findUnique: jest.fn() },
  },
}));

jest.mock('../connectedParty.service', () => ({
  deriveAndSetConnectedPartyFlag: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../creditNotification.service', () => ({
  creditNotificationService: { onApplicationEvent: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../auditChain.service', () => ({
  AuditChainService: jest.fn().mockImplementation(() => ({
    createEvent: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../middleware/occ.middleware', () => ({
  versionConflictError: jest.fn((ver: number) => new Error(`Version conflict: server has ${ver}`)),
}));

jest.mock('../approvalMatrix.service', () => ({
  approvalMatrixService: { getAuthority: jest.fn() },
}));

jest.mock('../exposureCompute.service', () => ({
  computeBorrowerExposure: jest.fn(),
  refreshBorrowerExposure: jest.fn().mockResolvedValue(undefined),
  EXPOSURE_STATES: ['APPROVED', 'OFFER', 'ACCEPTED', 'DISBURSED', 'ACTIVE'],
}));

jest.mock('../submissionReadiness.service', () => ({
  validateSubmissionReadiness: jest.fn().mockResolvedValue({ ready: true, errors: [] }),
}));

import prisma from '../../../utils/prisma';
import { creditApplicationService } from '../creditApplication.service';
import { AppError } from '../../../middleware/error.middleware';

const mockedFindFirst = prisma.creditApplication.findFirst as jest.Mock;
const mockedUpdate = prisma.creditApplication.update as jest.Mock;
const mockedUpdateMany = prisma.creditApplication.updateMany as jest.Mock;

describe('Race-safe state transitions + mandatory OCC (F25)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────────────────────
  // transition — state guard
  // ────────────────────────────────────────────────────────────────────────
  describe('transitionApplication — state-guarded write', () => {
    it('throws 409 if state changed since read (updateMany count=0)', async () => {
      // Simulate: read returns app in DRAFT, but by the time we write,
      // another process has already moved it to SUBMITTED.
      mockedFindFirst.mockResolvedValue({
        id: 'app-1',
        state: 'DRAFT',
        version: 3,
        borrowerProfileId: 'bp-1',
        deletedAt: null,
      });

      // updateMany returns count: 0 → state guard blocked the write
      mockedUpdateMany.mockResolvedValue({ count: 0 });

      await expect(
        creditApplicationService.transitionApplication('app-1', 'submit', 'user-1'),
      ).rejects.toThrow('Application state changed since read');

      // Verify it used updateMany (not update)
      expect(mockedUpdateMany).toHaveBeenCalledTimes(1);
      expect(mockedUpdate).not.toHaveBeenCalled();
    });

    it('succeeds when updateMany count > 0 (no race)', async () => {
      mockedFindFirst.mockResolvedValue({
        id: 'app-1',
        state: 'DRAFT',
        version: 3,
        borrowerProfileId: 'bp-1',
        deletedAt: null,
      });

      mockedUpdateMany.mockResolvedValue({ count: 1 });

      // We need the subsequent findFirst to return the updated app for audit/notification
      // Since transitionApplication does a second read after updateMany for side effects,
      // the post-write read needs to return the updated application
      mockedFindFirst
        .mockResolvedValueOnce({
          id: 'app-1',
          state: 'DRAFT',
          version: 3,
          borrowerProfileId: 'bp-1',
          deletedAt: null,
        })
        .mockResolvedValueOnce({
          id: 'app-1',
          state: 'SUBMITTED',
          version: 4,
          borrowerProfileId: 'bp-1',
          borrowerProfile: {
            id: 'bp-1',
            borrowerType: 'CORPORATE',
            name: 'Test Corp',
            account: { id: 'a-1', name: 'Test Account' },
            contact: { id: 'c-1', firstName: 'John', lastName: 'Doe' },
          },
          applicationNo: 'CA-2026-00001',
          deletedAt: null,
        });

      const result = await creditApplicationService.transitionApplication('app-1', 'submit', 'user-1');
      expect(result).toBeDefined();
      expect(result.state).toBe('SUBMITTED');
      expect(mockedUpdateMany).toHaveBeenCalledTimes(1);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // update — mandatory version
  // ────────────────────────────────────────────────────────────────────────
  describe('updateApplication — mandatory version', () => {
    it('throws AppError(428) when expectedVersion is undefined', async () => {
      mockedFindFirst.mockResolvedValue({
        id: 'app-1',
        state: 'DRAFT',
        version: 5,
        deletedAt: null,
      });

      await expect(
        creditApplicationService.updateApplication('app-1', { purpose: 'test' }, 'user-1'),
      ).rejects.toThrow('version required');

      // Verify it's an AppError with statusCode 428
      try {
        await creditApplicationService.updateApplication('app-1', { purpose: 'test' }, 'user-1');
      } catch (err: any) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(428);
      }
    });

    it('throws AppError(428) when expectedVersion is null', async () => {
      mockedFindFirst.mockResolvedValue({
        id: 'app-1',
        state: 'DRAFT',
        version: 5,
        deletedAt: null,
      });

      await expect(
        creditApplicationService.updateApplication('app-1', { purpose: 'test' }, 'user-1', null as any),
      ).rejects.toThrow('version required');
    });

    it('succeeds when expectedVersion matches', async () => {
      mockedFindFirst.mockResolvedValue({
        id: 'app-1',
        state: 'DRAFT',
        version: 5,
        deletedAt: null,
        assignedRmId: null,
        assignedAnalystId: null,
        borrowerProfileId: 'bp-1',
        applicationNo: 'CA-2026-00001',
      });

      mockedUpdate.mockResolvedValue({
        id: 'app-1',
        state: 'DRAFT',
        version: 6,
        purpose: 'test',
        borrowerProfile: {
          id: 'bp-1',
          borrowerType: 'CORPORATE',
          name: 'Test Corp',
          account: { id: 'a-1', name: 'Test Account' },
          contact: { id: 'c-1', firstName: 'John', lastName: 'Doe' },
        },
        assignedRm: null,
        assignedAnalyst: null,
        applicationNo: 'CA-2026-00001',
      });

      const result = await creditApplicationService.updateApplication(
        'app-1',
        { purpose: 'test' },
        'user-1',
        5,
      );

      expect(result).toBeDefined();
      expect(mockedUpdate).toHaveBeenCalledTimes(1);
    });
  });
});