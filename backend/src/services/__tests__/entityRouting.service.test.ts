import { applyEntityRouting, allEntityApprovalsResolved } from '../entityRouting.service';
import prisma from '../../utils/prisma';

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    requestTypeEntityRouting: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    entity: { findUnique: jest.fn() },
    requestApproval: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
  },
}));

jest.mock('@prisma/client', () => ({
  ApprovalStatus: { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' },
}));

const mockPrisma = prisma as unknown as {
  requestTypeEntityRouting: { findMany: jest.Mock };
  user: { findUnique: jest.Mock };
  entity: { findUnique: jest.Mock };
  requestApproval: { findFirst: jest.Mock; findMany: jest.Mock; create: jest.Mock };
};

describe('entityRouting.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('applyEntityRouting()', () => {
    const baseCtx = {
      requestId: 'req-1',
      requestTypeId: 'rt-1',
      requesterId: 'user-1',
      customFields: {} as Record<string, any>,
    };

    it('returns early when no routing rules exist for the request type', async () => {
      mockPrisma.requestTypeEntityRouting.findMany.mockResolvedValue([]);

      await applyEntityRouting(baseCtx);

      expect(mockPrisma.requestTypeEntityRouting.findMany).toHaveBeenCalledWith({
        where: { requestTypeId: 'rt-1', isActive: true },
      });
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.requestApproval.create).not.toHaveBeenCalled();
    });

    it('REQUESTER_ENTITY mode: resolves requester entityId and creates approval', async () => {
      mockPrisma.requestTypeEntityRouting.findMany.mockResolvedValue([
        { id: 'rule-1', requestTypeId: 'rt-1', routingMode: 'REQUESTER_ENTITY', customFieldKey: null, isActive: true },
      ]);
      mockPrisma.user.findUnique.mockResolvedValue({ entityId: 'entity-1' });
      mockPrisma.entity.findUnique.mockResolvedValue({ id: 'entity-1', approverId: 'approver-1', isActive: true });
      mockPrisma.requestApproval.findFirst.mockResolvedValue(null);
      mockPrisma.requestApproval.create.mockResolvedValue({});

      await applyEntityRouting(baseCtx);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { entityId: true },
      });
      // Entity resolved by id (starts with __id:)
      expect(mockPrisma.entity.findUnique).toHaveBeenCalledWith({
        where: { id: 'entity-1' },
        select: { id: true, approverId: true, isActive: true },
      });
      expect(mockPrisma.requestApproval.create).toHaveBeenCalledWith({
        data: {
          requestId: 'req-1',
          approverType: 'ENTITY',
          approverId: 'approver-1',
          entityId: 'entity-1',
          status: 'PENDING',
        },
      });
    });

    it('REQUESTER_ENTITY mode: skips when requester has no entityId', async () => {
      mockPrisma.requestTypeEntityRouting.findMany.mockResolvedValue([
        { id: 'rule-1', requestTypeId: 'rt-1', routingMode: 'REQUESTER_ENTITY', customFieldKey: null, isActive: true },
      ]);
      mockPrisma.user.findUnique.mockResolvedValue({ entityId: null });

      await applyEntityRouting(baseCtx);

      expect(mockPrisma.entity.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.requestApproval.create).not.toHaveBeenCalled();
    });

    it('REQUESTER_ENTITY mode: skips when requester is not found', async () => {
      mockPrisma.requestTypeEntityRouting.findMany.mockResolvedValue([
        { id: 'rule-1', requestTypeId: 'rt-1', routingMode: 'REQUESTER_ENTITY', customFieldKey: null, isActive: true },
      ]);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await applyEntityRouting(baseCtx);

      expect(mockPrisma.entity.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.requestApproval.create).not.toHaveBeenCalled();
    });

    it('CUSTOM_FIELD mode: reads entity code from customFields', async () => {
      const ctx = { ...baseCtx, customFields: { department: 'sales' } };
      mockPrisma.requestTypeEntityRouting.findMany.mockResolvedValue([
        { id: 'rule-2', requestTypeId: 'rt-1', routingMode: 'CUSTOM_FIELD', customFieldKey: 'department', isActive: true },
      ]);
      mockPrisma.entity.findUnique.mockResolvedValue({ id: 'entity-dept', approverId: 'approver-dept', isActive: true });
      mockPrisma.requestApproval.findFirst.mockResolvedValue(null);
      mockPrisma.requestApproval.create.mockResolvedValue({});

      await applyEntityRouting(ctx);

      // Code should be uppercased: 'SALES'
      expect(mockPrisma.entity.findUnique).toHaveBeenCalledWith({
        where: { code: 'SALES' },
        select: { id: true, approverId: true, isActive: true },
      });
      expect(mockPrisma.requestApproval.create).toHaveBeenCalledWith({
        data: {
          requestId: 'req-1',
          approverType: 'ENTITY',
          approverId: 'approver-dept',
          entityId: 'entity-dept',
          status: 'PENDING',
        },
      });
    });

    it('CUSTOM_FIELD mode: skips when customFieldKey is missing from customFields', async () => {
      const ctx = { ...baseCtx, customFields: {} };
      mockPrisma.requestTypeEntityRouting.findMany.mockResolvedValue([
        { id: 'rule-2', requestTypeId: 'rt-1', routingMode: 'CUSTOM_FIELD', customFieldKey: 'department', isActive: true },
      ]);

      await applyEntityRouting(ctx);

      expect(mockPrisma.entity.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.requestApproval.create).not.toHaveBeenCalled();
    });

    it('CUSTOM_FIELD mode: uppercases and trims the entity code', async () => {
      const ctx = { ...baseCtx, customFields: { department: '  sales  ' } };
      mockPrisma.requestTypeEntityRouting.findMany.mockResolvedValue([
        { id: 'rule-2', requestTypeId: 'rt-1', routingMode: 'CUSTOM_FIELD', customFieldKey: 'department', isActive: true },
      ]);
      mockPrisma.entity.findUnique.mockResolvedValue({ id: 'entity-sales', approverId: 'approver-sales', isActive: true });
      mockPrisma.requestApproval.findFirst.mockResolvedValue(null);
      mockPrisma.requestApproval.create.mockResolvedValue({});

      await applyEntityRouting(ctx);

      // .trim().toUpperCase() should produce 'SALES' from '  sales  '
      expect(mockPrisma.entity.findUnique).toHaveBeenCalledWith({
        where: { code: 'SALES' },
        select: { id: true, approverId: true, isActive: true },
      });
    });

    it('deduplicates identical entity codes before resolving', async () => {
      const ctx = { ...baseCtx, customFields: { dept: 'SALES', team: 'SALES' } };
      mockPrisma.requestTypeEntityRouting.findMany.mockResolvedValue([
        { id: 'rule-1', requestTypeId: 'rt-1', routingMode: 'CUSTOM_FIELD', customFieldKey: 'dept', isActive: true },
        { id: 'rule-2', requestTypeId: 'rt-1', routingMode: 'CUSTOM_FIELD', customFieldKey: 'team', isActive: true },
      ]);
      mockPrisma.entity.findUnique.mockResolvedValue({ id: 'entity-sales', approverId: 'approver-sales', isActive: true });
      mockPrisma.requestApproval.findFirst.mockResolvedValue(null);
      mockPrisma.requestApproval.create.mockResolvedValue({});

      await applyEntityRouting(ctx);

      // Both custom fields resolve to 'SALES', after dedup only one entity lookup
      expect(mockPrisma.entity.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.entity.findUnique).toHaveBeenCalledWith({
        where: { code: 'SALES' },
        select: { id: true, approverId: true, isActive: true },
      });
    });

    it('skips inactive entities', async () => {
      mockPrisma.requestTypeEntityRouting.findMany.mockResolvedValue([
        { id: 'rule-1', requestTypeId: 'rt-1', routingMode: 'REQUESTER_ENTITY', customFieldKey: null, isActive: true },
      ]);
      mockPrisma.user.findUnique.mockResolvedValue({ entityId: 'entity-inactive' });
      mockPrisma.entity.findUnique.mockResolvedValue({ id: 'entity-inactive', approverId: 'approver-1', isActive: false });

      await applyEntityRouting(baseCtx);

      expect(mockPrisma.requestApproval.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.requestApproval.create).not.toHaveBeenCalled();
    });

    it('skips creating duplicate approval records (existing approval found)', async () => {
      mockPrisma.requestTypeEntityRouting.findMany.mockResolvedValue([
        { id: 'rule-1', requestTypeId: 'rt-1', routingMode: 'REQUESTER_ENTITY', customFieldKey: null, isActive: true },
      ]);
      mockPrisma.user.findUnique.mockResolvedValue({ entityId: 'entity-1' });
      mockPrisma.entity.findUnique.mockResolvedValue({ id: 'entity-1', approverId: 'approver-1', isActive: true });
      mockPrisma.requestApproval.findFirst.mockResolvedValue({ id: 'existing-approval' });

      await applyEntityRouting(baseCtx);

      expect(mockPrisma.requestApproval.findFirst).toHaveBeenCalledWith({
        where: { requestId: 'req-1', entityId: 'entity-1' },
      });
      expect(mockPrisma.requestApproval.create).not.toHaveBeenCalled();
    });

    it('skips null entity lookups (entity not found)', async () => {
      mockPrisma.requestTypeEntityRouting.findMany.mockResolvedValue([
        { id: 'rule-1', requestTypeId: 'rt-1', routingMode: 'CUSTOM_FIELD', customFieldKey: 'department', isActive: true },
      ]);
      const ctx = { ...baseCtx, customFields: { department: 'UNKNOWN' } };
      mockPrisma.entity.findUnique.mockResolvedValue(null);

      await applyEntityRouting(ctx);

      expect(mockPrisma.requestApproval.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.requestApproval.create).not.toHaveBeenCalled();
    });
  });

  describe('allEntityApprovalsResolved()', () => {
    it('returns allApproved=true, anyRejected=false when no entity approvals exist', async () => {
      mockPrisma.requestApproval.findMany.mockResolvedValue([]);

      const result = await allEntityApprovalsResolved('req-1');

      expect(result).toEqual({ allApproved: true, anyRejected: false });
      expect(mockPrisma.requestApproval.findMany).toHaveBeenCalledWith({
        where: { requestId: 'req-1', approverType: 'ENTITY' },
        select: { status: true },
      });
    });

    it('returns allApproved=true when all approvals are APPROVED', async () => {
      mockPrisma.requestApproval.findMany.mockResolvedValue([
        { status: 'APPROVED' },
        { status: 'APPROVED' },
      ]);

      const result = await allEntityApprovalsResolved('req-1');

      expect(result).toEqual({ allApproved: true, anyRejected: false });
    });

    it('returns anyRejected=true when any approval is REJECTED', async () => {
      mockPrisma.requestApproval.findMany.mockResolvedValue([
        { status: 'APPROVED' },
        { status: 'REJECTED' },
      ]);

      const result = await allEntityApprovalsResolved('req-1');

      expect(result).toEqual({ allApproved: false, anyRejected: true });
    });

    it('returns allApproved=false when some approvals are PENDING', async () => {
      mockPrisma.requestApproval.findMany.mockResolvedValue([
        { status: 'APPROVED' },
        { status: 'PENDING' },
      ]);

      const result = await allEntityApprovalsResolved('req-1');

      expect(result).toEqual({ allApproved: false, anyRejected: false });
    });
  });
});