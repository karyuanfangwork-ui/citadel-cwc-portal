jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditRuleConfigSet: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    creditRuleConfig: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../services/platformAuditChain.service', () => ({
  PlatformAuditChainService: { appendEvent: jest.fn().mockResolvedValue('audit-1') },
}));

import prisma from '../../../utils/prisma';
import { PlatformAuditChainService } from '../../../services/platformAuditChain.service';
import {
  CreditRuleConfigSetService,
  validateRequiredFieldRuleSet,
} from '../creditRuleConfigSet.service';

const tx = prisma as any;
const context = {
  tenantId: 'tenant-1',
  actorId: 'maker-1',
  actorEmail: 'maker@example.test',
  correlationId: 'corr-1',
};
const rules = [
  { id: 'rule-1', kind: 'REQUIRED_FIELD', fieldPath: 'purpose', fieldLabel: 'Purpose', isMandatory: true, sortOrder: 10, productType: null, lane: null, borrowerType: null, isActive: false },
  { id: 'rule-2', kind: 'REQUIRED_FIELD', fieldPath: 'requestedAmount', fieldLabel: 'Requested amount', isMandatory: true, sortOrder: 20, productType: null, lane: null, borrowerType: null, isActive: false },
];

function makeSet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'set-1',
    name: 'Credit Required Fields',
    version: 1,
    status: 'DRAFT',
    reason: 'Policy review change',
    createdById: 'maker-1',
    submittedById: null,
    approvedById: null,
    rules,
    ...overrides,
  };
}

describe('CreditRuleConfigSetService', () => {
  const service = new CreditRuleConfigSetService();

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: (transaction: typeof prisma) => unknown) => callback(tx));
  });

  describe('validateRequiredFieldRuleSet', () => {
    it('rejects overlapping duplicate scopes but allows disjoint scoped rules', () => {
      expect(validateRequiredFieldRuleSet([
        { fieldPath: 'purpose', fieldLabel: 'Purpose', isMandatory: true, sortOrder: 1 },
        { fieldPath: 'purpose', fieldLabel: 'Purpose', isMandatory: false, sortOrder: 2, productType: 'TERM_LOAN' as any },
      ])).toContain('Field purpose has overlapping scope definitions.');

      expect(validateRequiredFieldRuleSet([
        { fieldPath: 'purpose', fieldLabel: 'Purpose', isMandatory: true, sortOrder: 1, productType: 'TERM_LOAN' as any },
        { fieldPath: 'purpose', fieldLabel: 'Purpose', isMandatory: false, sortOrder: 2, productType: 'OVERDRAFT' as any },
      ])).toEqual([]);
    });
  });

  it('creates an inactive, versioned draft and appends audit in the same transaction', async () => {
    (tx.creditRuleConfigSet.findFirst as jest.Mock).mockResolvedValue({ version: 2 });
    (tx.creditRuleConfigSet.create as jest.Mock).mockResolvedValue({ id: 'set-3', version: 3, reason: 'Policy review change' });
    (tx.creditRuleConfig.findMany as jest.Mock).mockResolvedValue([]);
    (tx.creditRuleConfig.create as jest.Mock).mockResolvedValue({ id: 'rule-new' });
    (tx.creditRuleConfigSet.findUnique as jest.Mock).mockResolvedValue({ ...makeSet({ id: 'set-3', version: 3 }), rules });

    const result = await service.create({ reason: 'Policy review change', rules: rules.map(({ id: _id, kind: _kind, isActive: _active, ...rule }) => rule) }, context);

    expect(result).toMatchObject({ id: 'set-3', version: 3 });
    expect(tx.creditRuleConfig.create).toHaveBeenCalledTimes(2);
    expect(tx.creditRuleConfig.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isActive: false, configSetId: 'set-3' }) }));
    expect(PlatformAuditChainService.appendEvent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1', actorId: 'maker-1', action: 'CREDIT_REQUIRED_FIELD_SET_CREATED', resourceId: 'set-3',
    }), tx);
  });

  it('requires the maker to submit a draft', async () => {
    (tx.creditRuleConfigSet.findUnique as jest.Mock).mockResolvedValue(makeSet({ createdById: 'another-maker' }));
    await expect(service.submit('set-1', context)).rejects.toThrow(/only the rule-set maker/i);
    expect(tx.creditRuleConfigSet.updateMany).not.toHaveBeenCalled();
    expect(PlatformAuditChainService.appendEvent).not.toHaveBeenCalled();
  });

  it('rejects maker self-approval and records successful checker approval transactionally', async () => {
    (tx.creditRuleConfigSet.findUnique as jest.Mock).mockResolvedValue(makeSet({ status: 'SUBMITTED', submittedById: 'maker-1' }));
    await expect(service.approve('set-1', context)).rejects.toThrow(/different from the maker/i);
    expect(tx.creditRuleConfigSet.updateMany).not.toHaveBeenCalled();

    (tx.creditRuleConfigSet.findUnique as jest.Mock)
      .mockResolvedValueOnce(makeSet({ status: 'SUBMITTED', submittedById: 'maker-1' }))
      .mockResolvedValueOnce(makeSet({ status: 'APPROVED', approvedById: 'checker-1' }));
    (tx.creditRuleConfigSet.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    const result = await service.approve('set-1', { ...context, actorId: 'checker-1', actorEmail: 'checker@example.test' });

    expect(result).toMatchObject({ status: 'APPROVED' });
    expect(tx.creditRuleConfigSet.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'set-1', status: 'SUBMITTED', approvedById: null } }));
    expect(PlatformAuditChainService.appendEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREDIT_REQUIRED_FIELD_SET_APPROVED', actorId: 'checker-1' }), tx);
  });

  it('requires a policy reference and a third operator for activation', async () => {
    await expect(service.activate('set-1', { ...context, actorId: 'operator-1' }, '')).rejects.toThrow(/approval reference/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();

    (tx.creditRuleConfigSet.findUnique as jest.Mock).mockResolvedValue(makeSet({ status: 'APPROVED', submittedById: 'maker-1', approvedById: 'checker-1' }));
    await expect(service.activate('set-1', { ...context, actorId: 'checker-1' }, 'POLICY-12345')).rejects.toThrow(/distinct from the maker and checker/i);
    expect(tx.creditRuleConfigSet.updateMany).not.toHaveBeenCalled();
  });

  it('activates the whole approved set atomically with policy reference and audit', async () => {
    const approved = makeSet({ status: 'APPROVED', submittedById: 'maker-1', approvedById: 'checker-1' });
    (tx.$queryRaw as jest.Mock).mockResolvedValue([]);
    (tx.creditRuleConfigSet.findUnique as jest.Mock)
      .mockResolvedValueOnce(approved)
      .mockResolvedValueOnce(makeSet({ status: 'ACTIVE', activatedById: 'operator-1', policyApprovalReference: 'POLICY-12345' }));
    (tx.creditRuleConfig.count as jest.Mock).mockResolvedValue(0);
    (tx.creditRuleConfigSet.findMany as jest.Mock).mockResolvedValue([]);
    (tx.creditRuleConfigSet.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (tx.creditRuleConfig.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

    const result = await service.activate('set-1', { ...context, actorId: 'operator-1', actorEmail: 'operator@example.test' }, ' POLICY-12345 ');

    expect(result).toMatchObject({ status: 'ACTIVE', policyApprovalReference: 'POLICY-12345' });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.creditRuleConfigSet.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'set-1', status: 'APPROVED', approvedById: 'checker-1' },
      data: expect.objectContaining({ status: 'ACTIVE', activatedById: 'operator-1', policyApprovalReference: 'POLICY-12345' }),
    }));
    expect(PlatformAuditChainService.appendEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CREDIT_REQUIRED_FIELD_SET_ACTIVATED', actorId: 'operator-1',
      newValues: expect.objectContaining({ policyApprovalReference: 'POLICY-12345', ruleCount: 2 }),
    }), tx);
  });

  it('does not audit or complete activation when persisted rule count is incomplete', async () => {
    (tx.$queryRaw as jest.Mock).mockResolvedValue([]);
    (tx.creditRuleConfigSet.findUnique as jest.Mock).mockResolvedValueOnce(makeSet({ status: 'APPROVED', submittedById: 'maker-1', approvedById: 'checker-1' }));
    (tx.creditRuleConfig.count as jest.Mock).mockResolvedValue(0);
    (tx.creditRuleConfigSet.findMany as jest.Mock).mockResolvedValue([]);
    (tx.creditRuleConfigSet.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (tx.creditRuleConfigSet.findUnique as jest.Mock).mockResolvedValueOnce(makeSet({ status: 'ACTIVE' }));
    (tx.creditRuleConfig.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await expect(service.activate('set-1', { ...context, actorId: 'operator-1' }, 'POLICY-12345')).rejects.toThrow(/rolled back/i);
    expect(PlatformAuditChainService.appendEvent).not.toHaveBeenCalled();
  });
});
