const findExecutive = jest.fn();
jest.mock('../utils/prisma', () => ({ __esModule: true, default: {
    user: { findFirst: findExecutive },
} }));
import { createRequestSchema } from '../validators/request.validator';
import { resolveHrExecutiveApprover } from '../services/hrExecutiveApprover.service';

const executiveApproverId = '00000000-0000-4000-8000-000000000002';
const requesterId = '00000000-0000-4000-8000-000000000001';
const tenantId = '00000000-0000-4000-8000-000000000003';
const body = { requestTypeId: requesterId, serviceDeskId: tenantId, formVersion: 1 };

describe('HR executive choice creation contract', () => {
    beforeEach(() => {
        findExecutive.mockReset();
        findExecutive.mockResolvedValue({ id: executiveApproverId });
    });

    it('accepts explicit CEO and Group DCEO selections through strict create validation', () => {
        for (const role of ['CEO', 'GROUP_DCEO']) {
            expect(createRequestSchema.safeParse({ body: { ...body, executiveApproverId, executiveApproverRole: role } }).success).toBe(true);
        }
        expect(createRequestSchema.safeParse({ body }).success).toBe(true); // non-HR requests remain valid
    });

    it('rejects partial and unauthorized role labels', () => {
        expect(createRequestSchema.safeParse({ body: { ...body, executiveApproverId } }).success).toBe(false);
        expect(createRequestSchema.safeParse({ body: { ...body, executiveApproverRole: 'CEO' } }).success).toBe(false);
        expect(createRequestSchema.safeParse({ body: { ...body, executiveApproverId, executiveApproverRole: 'CFO' } }).success).toBe(false);
    });

    it.each(['CEO', 'GROUP_DCEO'] as const)('requires active same-tenant %s RBAC membership', async (role) => {
        await expect(resolveHrExecutiveApprover({ executiveApproverId, executiveApproverRole: role, tenantId, requesterId }))
            .resolves.toEqual({ id: executiveApproverId, role });
        expect(findExecutive).toHaveBeenCalledWith(expect.objectContaining({ where: {
            id: executiveApproverId, tenantId, isActive: true,
            roles: { some: { role: { name: role } } },
        } }));
    });

    it('rejects self-selection and unavailable or wrong-role accounts', async () => {
        await expect(resolveHrExecutiveApprover({ executiveApproverId: requesterId, executiveApproverRole: 'CEO', tenantId, requesterId }))
            .rejects.toMatchObject({ statusCode: 400 });
        expect(findExecutive).not.toHaveBeenCalled();
        findExecutive.mockResolvedValue(null);
        await expect(resolveHrExecutiveApprover({ executiveApproverId, executiveApproverRole: 'GROUP_DCEO', tenantId, requesterId }))
            .rejects.toMatchObject({ statusCode: 400 });
    });
});
