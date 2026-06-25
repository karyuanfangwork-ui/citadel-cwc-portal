jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditApplication: {
      findFirst: jest.fn(),
    },
    borrowerProfile: {
      findFirst: jest.fn(),
    },
    creditDocument: {
      findFirst: jest.fn(),
    },
  },
}));

import prisma from '../../../utils/prisma';
import { creditScopeService, CreditAuthUser } from '../creditScope.service';

const mockedApplicationFindFirst = prisma.creditApplication.findFirst as jest.Mock;
const mockedBorrowerFindFirst = prisma.borrowerProfile.findFirst as jest.Mock;
const mockedDocumentFindFirst = prisma.creditDocument.findFirst as jest.Mock;

const user = (overrides: Partial<CreditAuthUser> = {}): CreditAuthUser => ({
  id: 'user-1',
  email: 'user@test.local',
  firstName: 'User',
  lastName: 'One',
  roles: ['CREDIT_RM'],
  permissions: ['credit:read'],
  ...overrides,
});

describe('creditScopeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds broad document scope for credit managers/admins', () => {
    expect(creditScopeService.buildDocumentScopeWhere(user({ roles: ['CREDIT_MANAGER'] }))).toEqual({});
    expect(creditScopeService.buildDocumentScopeWhere(user({ roles: ['CREDIT_RM'], permissions: ['credit:admin'] }))).toEqual({});
  });

  it('builds document scope from uploaded-by, assigned application, and scoped borrower paths', () => {
    expect(creditScopeService.buildDocumentScopeWhere(user())).toEqual({
      OR: [
        { uploadedById: 'user-1' },
        {
          application: {
            OR: [
              { assignedRmId: 'user-1' },
              { assignedAnalystId: 'user-1' },
            ],
          },
        },
        {
          borrowerProfile: {
            applications: {
              some: {
                OR: [
                  { assignedRmId: 'user-1' },
                  { assignedAnalystId: 'user-1' },
                ],
              },
            },
          },
        },
      ],
    });
  });

  it('assertCanAccessDocument resolves a live non-deleted in-scope document', async () => {
    mockedDocumentFindFirst.mockResolvedValue({ id: 'doc-1' });

    await expect(creditScopeService.assertCanAccessDocument(user(), 'doc-1')).resolves.toBeUndefined();

    expect(mockedDocumentFindFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'doc-1',
        deletedAt: null,
      }),
      select: { id: true },
    });
  });

  it('assertCanAccessDocument returns not found/access denied for missing or out-of-scope documents', async () => {
    mockedDocumentFindFirst.mockResolvedValue(null);

    await expect(creditScopeService.assertCanAccessDocument(user(), 'doc-x')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Document not found or access denied',
    });
  });

  it('assertCanAccessApplication and assertCanAccessBorrower enforce scoped lookups', async () => {
    mockedApplicationFindFirst.mockResolvedValue({ id: 'app-1' });
    mockedBorrowerFindFirst.mockResolvedValue({ id: 'bp-1' });

    await expect(creditScopeService.assertCanAccessApplication(user(), 'app-1')).resolves.toBeUndefined();
    await expect(creditScopeService.assertCanAccessBorrower(user(), 'bp-1')).resolves.toBeUndefined();

    expect(mockedApplicationFindFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'app-1', deletedAt: null }),
      select: { id: true },
    });
    expect(mockedBorrowerFindFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'bp-1', deletedAt: null }),
      select: { id: true },
    });
  });
});
