/**
 * Tests for borrower profile PII masking (contact NRIC).
 * Task 5 — Credit Audit Remediation: Mask and audit the borrower's own NRIC (F3).
 */

// Mock prisma
jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    borrowerProfile: {
      findFirst: jest.fn(),
    },
    piiReadLog: {
      create: jest.fn(),
    },
  },
}));

// Mock PiiReadLogService so we don't need a real DB
jest.mock('../piiReadLog.service', () => ({
  PiiReadLogService: {
    logPiiAccess: jest.fn().mockResolvedValue(undefined),
  },
}));

import prisma from '../../../utils/prisma';
import { PiiReadLogService } from '../piiReadLog.service';
import { borrowerProfileService } from '../borrowerProfile.service';

const mockedFindFirst = prisma.borrowerProfile.findFirst as jest.Mock;

describe('BorrowerProfile PII masking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBorrowerProfile', () => {
    it('masks contact NRIC (returns last 4 only, like ****1234)', async () => {
      mockedFindFirst.mockResolvedValue({
        id: 'bp-1',
        contact: { id: 'c-1', nricPassport: 'S9876543Z', firstName: 'Jane', lastName: 'Doe' },
      });

      const result = await borrowerProfileService.getBorrowerProfile('bp-1');

      expect(result).not.toBeNull();
      expect(result!.contact.nricPassport).toBe('****543Z');
    });

    it('leaves contact NRIC as null when contact has no NRIC', async () => {
      mockedFindFirst.mockResolvedValue({
        id: 'bp-2',
        contact: { id: 'c-2', nricPassport: null, firstName: 'Jane', lastName: 'Doe' },
      });

      const result = await borrowerProfileService.getBorrowerProfile('bp-2');

      expect(result).not.toBeNull();
      expect(result!.contact.nricPassport).toBeNull();
    });

    it('returns null when profile not found', async () => {
      mockedFindFirst.mockResolvedValue(null);

      const result = await borrowerProfileService.getBorrowerProfile('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('revealContactNric', () => {
    it('returns plaintext NRIC and logs PII access', async () => {
      mockedFindFirst.mockResolvedValue({
        id: 'bp-1',
        contact: { nricPassport: 'S9876543Z' },
      });

      const nric = await borrowerProfileService.revealContactNric('bp-1', 'user-1');

      expect(nric).toBe('S9876543Z');
      expect(PiiReadLogService.logPiiAccess).toHaveBeenCalledWith(
        'user-1',
        'BorrowerProfile',
        'bp-1',
        'contact.nricPassport',
      );
    });

    it('returns null when profile has no contact NRIC', async () => {
      mockedFindFirst.mockResolvedValue({
        id: 'bp-1',
        contact: { nricPassport: null },
      });

      const nric = await borrowerProfileService.revealContactNric('bp-1', 'user-1');

      expect(nric).toBeNull();
      expect(PiiReadLogService.logPiiAccess).not.toHaveBeenCalled();
    });
  });
});