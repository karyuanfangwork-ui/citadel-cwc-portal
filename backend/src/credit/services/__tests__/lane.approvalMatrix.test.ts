/**
 * P2-2: Lane-aware Approval Matrix — Unit Tests
 *
 * Tests that PERSONAL_FAST and SME lanes override requiredApproverCount to 2,
 * while CORPORATE lane falls through to the existing matrix logic.
 */

import { approvalMatrixService } from '../approvalMatrix.service';

// Mock Prisma
jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditApprovalMatrix: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

import prisma from '../../../utils/prisma';

const mockFindMany = prisma.creditApprovalMatrix.findMany as jest.Mock;

const MATRIX_ROW = {
  id: 'matrix-1',
  name: 'Test Matrix',
  authorityLevel: 'MANAGER',
  requiredApproverCount: 3,  // Matrix says 3, but lane override should make it 2
  minExposure: 0,
  maxExposure: 1000000,
  minRating: 'AAA',
  maxRating: 'D',
  branchId: null,
  isActive: true,
  effectiveFrom: new Date('2025-01-01'),
  effectiveTo: null,
};

describe('ApprovalMatrixService — P2-2 Lane Override', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('PERSONAL_FAST lane overrides requiredApproverCount to 2 (global matrix)', async () => {
    mockFindMany.mockResolvedValue([MATRIX_ROW]);
    const result = await approvalMatrixService.lookupApprovalAuthority(500000, 'BBB', null, 'PERSONAL_FAST');
    expect(result).not.toBeNull();
    expect(result!.requiredApproverCount).toBe(2);
    expect(result!.authorityLevel).toBe('MANAGER');  // Authority still from matrix
  });

  it('SME lane overrides requiredApproverCount to 2 (global matrix)', async () => {
    mockFindMany.mockResolvedValue([MATRIX_ROW]);
    const result = await approvalMatrixService.lookupApprovalAuthority(500000, 'BBB', null, 'SME');
    expect(result).not.toBeNull();
    expect(result!.requiredApproverCount).toBe(2);
  });

  it('CORPORATE lane uses matrix requiredApproverCount (no override)', async () => {
    mockFindMany.mockResolvedValue([MATRIX_ROW]);
    const result = await approvalMatrixService.lookupApprovalAuthority(500000, 'BBB', null, 'CORPORATE');
    expect(result).not.toBeNull();
    expect(result!.requiredApproverCount).toBe(3);  // From matrix, no override
  });

  it('No lane parameter (null) uses matrix requiredApproverCount', async () => {
    mockFindMany.mockResolvedValue([MATRIX_ROW]);
    const result = await approvalMatrixService.lookupApprovalAuthority(500000, 'BBB', null, null);
    expect(result).not.toBeNull();
    expect(result!.requiredApproverCount).toBe(3);
  });

  it('PERSONAL_FAST lane overrides requiredApproverCount to 2 (branch-specific matrix)', async () => {
    const branchRow = { ...MATRIX_ROW, branchId: 'branch-1' };
    mockFindMany.mockResolvedValue([branchRow]);
    const result = await approvalMatrixService.lookupApprovalAuthority(500000, 'BBB', 'branch-1', 'PERSONAL_FAST');
    expect(result).not.toBeNull();
    expect(result!.requiredApproverCount).toBe(2);
  });

  it('PERSONAL_FAST lane with no matrix match defaults to MANAGER + 2', async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await approvalMatrixService.lookupApprovalAuthority(999999999, 'AAA', null, 'PERSONAL_FAST');
    expect(result).not.toBeNull();
    expect(result!.authorityLevel).toBe('MANAGER');
    expect(result!.requiredApproverCount).toBe(2);
    expect(result!.matrixName).toContain('PERSONAL_FAST');
  });

  it('SME lane with no matrix match defaults to MANAGER + 2', async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await approvalMatrixService.lookupApprovalAuthority(999999999, 'AAA', null, 'SME');
    expect(result).not.toBeNull();
    expect(result!.authorityLevel).toBe('MANAGER');
    expect(result!.requiredApproverCount).toBe(2);
  });

  it('CORPORATE lane with no matrix match returns null (existing behavior)', async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await approvalMatrixService.lookupApprovalAuthority(999999999, 'AAA', null, 'CORPORATE');
    expect(result).toBeNull();
  });

  it('No lane with no matrix match returns null (existing behavior)', async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await approvalMatrixService.lookupApprovalAuthority(999999999, 'AAA', null);
    expect(result).toBeNull();
  });
});