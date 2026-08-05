const mockPrisma = {
    request: { findFirst: jest.fn() },
    requestApproval: { findMany: jest.fn() },
    approvalInstance: { findFirst: jest.fn() },
};
const mockStartApprovalInstance = jest.fn();
const mockLogger = { info: jest.fn(), error: jest.fn() };

jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../approvalRuntime.service', () => ({ startApprovalInstance: mockStartApprovalInstance }));
jest.mock('../../utils/logger', () => ({ logger: mockLogger }));

import { runPurchaseRequisitionApprovalShadow } from '../purchaseRequisitionApprovalShadow.service';

describe('Purchase Requisition approval-runtime shadow mode', () => {
    const input = {
        requestId: 'request-1',
        tenantId: 'tenant-1',
        requestTypeId: 'request-type-1',
        actorId: 'actor-1',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.APPROVAL_RUNTIME_PR_SHADOW_ENABLED;
    });

    it('does nothing when shadow mode is disabled', async () => {
        await expect(runPurchaseRequisitionApprovalShadow(input)).resolves.toEqual({
            enabled: false,
            status: 'DISABLED',
            comparisons: [],
        });
        expect(mockPrisma.request.findFirst).not.toHaveBeenCalled();
        expect(mockStartApprovalInstance).not.toHaveBeenCalled();
    });

    it('starts the runtime once and reports matching inline approvers', async () => {
        process.env.APPROVAL_RUNTIME_PR_SHADOW_ENABLED = 'true';
        mockPrisma.request.findFirst.mockResolvedValue({ id: input.requestId });
        mockPrisma.approvalInstance.findFirst.mockResolvedValueOnce(null);
        mockStartApprovalInstance.mockResolvedValue({
            id: 'instance-1',
            steps: [{ stepOrder: 1, assignedApproverId: 'cfo-1', approverType: 'ROLE' }],
        });
        mockPrisma.requestApproval.findMany.mockResolvedValue([
            { approverId: 'cfo-1', approverType: 'CFO', status: 'PENDING' },
        ]);

        const result = await runPurchaseRequisitionApprovalShadow(input);

        expect(result.status).toBe('MATCH');
        expect(result.instanceId).toBe('instance-1');
        expect(result.comparisons[0].matches).toBe(true);
        expect(mockStartApprovalInstance).toHaveBeenCalledWith(input);
    });

    it('reports a mismatch without throwing or changing inline approvals', async () => {
        process.env.APPROVAL_RUNTIME_PR_SHADOW_ENABLED = 'true';
        mockPrisma.request.findFirst.mockResolvedValue({ id: input.requestId });
        mockPrisma.approvalInstance.findFirst.mockResolvedValue({
            id: 'instance-1',
            steps: [{ stepOrder: 1, assignedApproverId: 'runtime-cfo', approverType: 'ROLE' }],
        });
        mockPrisma.requestApproval.findMany.mockResolvedValue([
            { approverId: 'inline-cfo', approverType: 'CFO', status: 'PENDING' },
        ]);

        const result = await runPurchaseRequisitionApprovalShadow(input);

        expect(result.status).toBe('MISMATCH');
        expect(result.comparisons).toEqual([
            expect.objectContaining({
                runtimeApproverId: 'runtime-cfo',
                inlineApproverId: 'inline-cfo',
                matches: false,
            }),
        ]);
        expect(mockPrisma.requestApproval.findMany).toHaveBeenCalled();
    });

    it('swallows runtime errors so shadow mode cannot affect live workflow', async () => {
        process.env.APPROVAL_RUNTIME_PR_SHADOW_ENABLED = 'true';
        mockPrisma.request.findFirst.mockRejectedValue(new Error('database unavailable'));

        await expect(runPurchaseRequisitionApprovalShadow(input)).resolves.toEqual({
            enabled: true,
            status: 'ERROR',
            comparisons: [],
            error: 'database unavailable',
        });
        expect(mockLogger.error).toHaveBeenCalled();
    });
});
