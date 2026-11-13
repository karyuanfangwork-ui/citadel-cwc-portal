const mockPrisma: any = {
  letterOfAcceptance: {
    findUnique: jest.fn(),
  },
};

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { hasSignedLOA, isLOAApproved } from '../transitionGuards';

describe('LOA transition precondition data loading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads approvedBy from the LOA record keyed by requestId', async () => {
    mockPrisma.letterOfAcceptance.findUnique.mockResolvedValue({ approvedBy: 'manager-1' });

    await expect(isLOAApproved('request-1')).resolves.toBe(true);
    expect(mockPrisma.letterOfAcceptance.findUnique).toHaveBeenCalledWith({
      where: { requestId: 'request-1' },
      select: { approvedBy: true },
    });
  });

  it('fails closed when no approved LOA record exists', async () => {
    mockPrisma.letterOfAcceptance.findUnique.mockResolvedValue(null);

    await expect(isLOAApproved('request-1')).resolves.toBe(false);
  });

  it('reads the signed file directly for LOA acceptance preconditions', async () => {
    mockPrisma.letterOfAcceptance.findUnique.mockResolvedValue({ signedLoaFileUrl: 'cwc/loa/signed.pdf' });

    await expect(hasSignedLOA('request-1')).resolves.toBe(true);
    expect(mockPrisma.letterOfAcceptance.findUnique).toHaveBeenCalledWith({
      where: { requestId: 'request-1' },
      select: { signedLoaFileUrl: true },
    });
  });

  it('fails closed when the signed file is missing', async () => {
    mockPrisma.letterOfAcceptance.findUnique.mockResolvedValue({ signedLoaFileUrl: null });

    await expect(hasSignedLOA('request-1')).resolves.toBe(false);
  });
});
