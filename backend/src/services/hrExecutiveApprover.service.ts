import { HrExecutiveApproverRole } from '@prisma/client';
import { AppError } from '../middleware/error.middleware';
import prisma from '../utils/prisma';

const ALLOWED_ROLES = ['CEO', 'GROUP_DCEO'] as const;

/** RBAC membership, not the nullable legacy User.executiveRole, grants authority. */
export async function resolveHrExecutiveApprover(input: {
    executiveApproverId: string;
    executiveApproverRole: HrExecutiveApproverRole;
    tenantId: string;
    requesterId: string;
}): Promise<{ id: string; role: HrExecutiveApproverRole }> {
    if (!ALLOWED_ROLES.includes(input.executiveApproverRole)) {
        throw new AppError('Executive approver role must be CEO or GROUP_DCEO', 400);
    }
    if (input.executiveApproverId === input.requesterId) {
        throw new AppError('Requester cannot approve their own hiring request', 400);
    }
    const user = await prisma.user.findFirst({
        where: {
            id: input.executiveApproverId,
            tenantId: input.tenantId,
            isActive: true,
            roles: { some: { role: { name: input.executiveApproverRole } } },
        },
        select: { id: true },
    });
    if (!user) {
        throw new AppError('Selected executive is not an active CEO or Group DCEO with the selected role in this tenant', 400);
    }
    return { id: user.id, role: input.executiveApproverRole };
}
