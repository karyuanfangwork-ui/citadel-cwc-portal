/**
 * Regression tests for service desk catalog admin read contracts.
 *
 * P1-03: Draft services must remain visible after create/save in admin UI.
 * P2-01: Inactive desks must be reachable for restoration in admin UI.
 * P2-02: Admin endpoint returns active + inactive; public endpoint returns active-only.
 */
import serviceDeskService from '../services/serviceDesk.service';

// Mock Prisma
jest.mock('../utils/prisma', () => {
  const mockFindMany = jest.fn();
  return {
    __esModule: true,
    default: {
      serviceDesk: {
        findMany: mockFindMany,
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      serviceCategory: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      requestType: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      request: { count: jest.fn() },
      catalogEntitlement: { count: jest.fn() },
      escalationRule: { count: jest.fn() },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(),
    },
  };
});

// Import the mocked prisma
import prisma from '../utils/prisma';

const mockFindMany = prisma.serviceDesk.findMany as jest.Mock;

describe('Service Desk Catalog Admin Contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('P2-01: getAllServiceDesks returns only active desks', () => {
    it('should filter by isActive: true for public endpoint', async () => {
      mockFindMany.mockResolvedValue([{ id: 'desk-1', name: 'IT Support', isActive: true }]);

      await serviceDeskService.getAllServiceDesks();

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });
  });

  describe('P2-01: getAllServiceDesksAdmin returns all desks including inactive', () => {
    it('should NOT filter by isActive for admin endpoint', async () => {
      mockFindMany.mockResolvedValue([
        { id: 'desk-1', name: 'IT Support', isActive: true },
        { id: 'desk-2', name: 'Old Desk', isActive: false },
      ]);

      const result = await serviceDeskService.getAllServiceDesksAdmin();

      // Admin query must NOT have isActive: true filter
      const callArgs = mockFindMany.mock.calls[0][0];
      expect(callArgs.where).toBeUndefined();
      expect(result).toHaveLength(2);
    });

    it('should include inactive desks in the result', async () => {
      const mockDesks = [
        { id: 'desk-1', name: 'Active Desk', isActive: true },
        { id: 'desk-2', name: 'Inactive Desk', isActive: false },
      ];
      mockFindMany.mockResolvedValue(mockDesks);

      const result = await serviceDeskService.getAllServiceDesksAdmin();

      expect(result).toEqual(mockDesks);
      // Ensure both active and inactive desks are returned
      expect(result.some((d: any) => d.isActive === false)).toBe(true);
    });
  });

  describe('P1-03: Draft services visible in admin request types', () => {
    it('getAllRequestTypesAdmin should NOT filter by lifecycleStatus', () => {
      // The admin endpoint should return ALL request types regardless of
      // lifecycleStatus or isActive, so that DRAFT services remain visible
      // in the admin UI after creation.
      const mockRequestTypes = [
        { id: 'rt-1', name: 'Published Service', isActive: true, lifecycleStatus: 'PUBLISHED' },
        { id: 'rt-2', name: 'Draft Service', isActive: true, lifecycleStatus: 'DRAFT' },
        { id: 'rt-3', name: 'Deprecated Service', isActive: true, lifecycleStatus: 'DEPRECATED' },
        { id: 'rt-4', name: 'Inactive Service', isActive: false, lifecycleStatus: 'PUBLISHED' },
      ];

      const requestTypeFindMany = prisma.requestType.findMany as jest.Mock;
      requestTypeFindMany.mockResolvedValue(mockRequestTypes);

      // The admin method should not have lifecycleStatus: 'PUBLISHED' in its where clause
      // (it should return DRAFT services too)
      // This is verified by inspecting the call args
      return serviceDeskService.getAllRequestTypesAdmin('desk-1').then(() => {
        const callArgs = requestTypeFindMany.mock.calls[0][0];
        // Admin endpoint must NOT filter by lifecycleStatus
        if (callArgs.where) {
          expect(callArgs.where.lifecycleStatus).toBeUndefined();
        }
      });
    });
  });

  describe('Public endpoint filtering', () => {
    it('getRequestTypes should filter by isActive and PUBLISHED', () => {
      const requestTypeFindMany = prisma.requestType.findMany as jest.Mock;
      requestTypeFindMany.mockResolvedValue([]);

      return serviceDeskService.getRequestTypes('desk-1').then(() => {
        const callArgs = requestTypeFindMany.mock.calls[0][0];
        // Public endpoint MUST filter to only active + published items
        expect(callArgs.where.isActive).toBe(true);
        expect(callArgs.where.lifecycleStatus).toBe('PUBLISHED');
      });
    });
  });

  describe('Parent ownership and direct visibility', () => {
    it('does not return an inactive desk from direct public lookup', async () => {
      const findUnique = prisma.serviceDesk.findUnique as jest.Mock;
      findUnique.mockResolvedValue(null);

      await expect(serviceDeskService.getServiceDeskById('desk-inactive')).rejects.toMatchObject({ statusCode: 404 });
      expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'desk-inactive', isActive: true } }));
    });

    it('rejects category mutation when the category belongs to another desk', async () => {
      const categoryFindUnique = prisma.serviceCategory.findUnique as jest.Mock;
      categoryFindUnique.mockResolvedValue({ id: 'cat-1', serviceDeskId: 'desk-b', displayOrder: 0 });

      await expect(
        serviceDeskService.updateCategory('desk-a', 'cat-1', { name: 'Changed' }),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(prisma.serviceCategory.update).not.toHaveBeenCalled();
    });

    it('rejects reorder payloads containing categories from another desk', async () => {
      const deskFindUnique = prisma.serviceDesk.findUnique as jest.Mock;
      const categoryFindMany = prisma.serviceCategory.findMany as jest.Mock;
      deskFindUnique.mockResolvedValue({ id: 'desk-a' });
      categoryFindMany.mockResolvedValue([{ id: 'cat-a' }]);

      await expect(
        serviceDeskService.reorderCategories('desk-a', ['cat-a', 'cat-b']),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('scopes category impact lookup to its parent desk and returns dependency counts', async () => {
      const categoryFindUnique = prisma.serviceCategory.findUnique as jest.Mock;
      categoryFindUnique.mockResolvedValue({ id: 'cat-a', serviceDeskId: 'desk-a', name: 'Hardware', isActive: true, displayOrder: 0 });
      (prisma.requestType.count as jest.Mock)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2);
      (prisma.request.count as jest.Mock).mockResolvedValue(4);
      (prisma.catalogEntitlement.count as jest.Mock).mockResolvedValue(5);
      (prisma.escalationRule.count as jest.Mock).mockResolvedValue(6);

      const impact = await serviceDeskService.getCategoryDeactivationImpact('desk-a', 'cat-a');

      expect(categoryFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'cat-a' } }));
      expect(impact).toEqual(expect.objectContaining({
        requestTypes: 3,
        publishedTypes: 2,
        draftTypes: 1,
        existingRequests: 4,
        entitlements: 5,
        escalationRules: 6,
        workflowTypes: 2,
      }));
    });
  });
});