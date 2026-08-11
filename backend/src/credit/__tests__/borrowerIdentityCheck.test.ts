jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    borrowerProfile: { findMany: jest.fn() },
    borrowerDuplicateException: { findFirst: jest.fn() },
  },
}));

import prisma from '../../utils/prisma';
import { borrowerProfileService } from '../services/borrowerProfile.service';

const db = prisma as any;

describe('borrower identity check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.borrowerDuplicateException.findFirst.mockResolvedValue(null);
  });

  it('returns a masked exact match and existing exception id without raw identity data', async () => {
    db.borrowerProfile.findMany.mockResolvedValue([{ id: 'borrower-1', borrowerNumber: 'BRW-000001', name: 'A Borrower' }]);
    db.borrowerDuplicateException.findFirst.mockResolvedValue({ id: 'exception-1', status: 'PENDING' });

    const result = await borrowerProfileService.identityCheck({
      draftId: 'draft-1',
      requestedById: 'user-1',
      segment: 'INDIVIDUAL',
      identifier: '900101-10-1234',
      identifierType: 'NRIC',
    });

    expect(result).toEqual({
      exactMatch: true,
      match: { borrowerId: 'borrower-1', borrowerNumber: 'BRW-000001', name: 'A Borrower', maskedIdentifier: '****1234' },
      exceptionRequestId: 'exception-1',
      exceptionStatus: 'PENDING',
    });
    expect(JSON.stringify(result)).not.toContain('900101-10-1234');
  });

  it('returns a clear result without reading exception state when no match exists', async () => {
    db.borrowerProfile.findMany.mockResolvedValue([]);
    const result = await borrowerProfileService.identityCheck({
      draftId: 'draft-1', requestedById: 'user-1', segment: 'CORPORATE', identifier: '123456789', identifierType: 'BUSINESS_REGISTRATION',
    });
    expect(result).toEqual({ exactMatch: false, match: null, exceptionRequestId: null, exceptionStatus: null });
    expect(db.borrowerDuplicateException.findFirst).toHaveBeenCalled();
  });
});
