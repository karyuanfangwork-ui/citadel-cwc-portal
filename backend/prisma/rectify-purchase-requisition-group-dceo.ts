import 'dotenv/config';
import { ApprovalDefinitionStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const db = prisma as any;

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const POLICY_NAME = 'Purchase Requisition Approval Runtime';
const REQUEST_REFERENCE = 'FINANCE-00010';
const TARGET_APPROVER_EMAIL = 'groupceo@test.local';

function sameUserStep(definition: unknown, userId: string): boolean {
    if (!Array.isArray(definition)) return false;
    const step = definition.find((item: any) => item?.stepOrder === 2);
    return step?.approverType === 'USER' && step?.approverId === userId;
}

async function main() {
    const targetUser = await prisma.user.findFirst({
        where: { email: TARGET_APPROVER_EMAIL, tenantId: TENANT_ID, isActive: true },
        select: { id: true, email: true },
    });
    if (!targetUser) {
        throw new Error(`Active ${TARGET_APPROVER_EMAIL} account was not found in the target tenant`);
    }

    const requestType = await prisma.requestType.findFirst({
        where: { code: 'PURCHASE_REQUISITION' },
        select: { id: true },
    });
    if (!requestType) throw new Error('PURCHASE_REQUISITION request type was not found');

    const policy = await prisma.approvalPolicy.findFirst({
        where: { tenantId: TENANT_ID, requestTypeId: requestType.id, name: POLICY_NAME },
        include: { steps: { orderBy: { stepOrder: 'asc' } }, versions: { orderBy: { versionNumber: 'desc' } } },
    });
    if (!policy) throw new Error(`${POLICY_NAME} was not found`);

    const existingPublished = policy.versions.find((version: any) => version.status === ApprovalDefinitionStatus.PUBLISHED);
    if (!sameUserStep(existingPublished?.definition, targetUser.id)) {
        await prisma.$transaction(async (tx) => {
            const runtimeTx = tx as any;
            await runtimeTx.approvalPolicyStep.updateMany({
                where: { policyId: policy.id, stepOrder: 2 },
                data: {
                    approverType: 'USER',
                    approverId: targetUser.id,
                    roleId: null,
                },
            });

            if (existingPublished) {
                await runtimeTx.approvalPolicyVersion.update({
                    where: { id: existingPublished.id },
                    data: {
                        status: ApprovalDefinitionStatus.RETIRED,
                        retiredAt: new Date(),
                        retiredBy: targetUser.id,
                    },
                });
            }

            const updatedPolicy = await runtimeTx.approvalPolicy.findUnique({
                where: { id: policy.id },
                include: { steps: { orderBy: { stepOrder: 'asc' } } },
            });
            const publisher = await runtimeTx.user.findFirst({
                where: { tenantId: TENANT_ID, email: 'admin@test.local', isActive: true },
                select: { id: true },
            });
            if (!publisher) throw new Error('Active admin@test.local publisher was not found');

            const nextVersion = Math.max(...policy.versions.map((version: any) => version.versionNumber), 0) + 1;
            await runtimeTx.approvalPolicyVersion.create({
                data: {
                    policyId: policy.id,
                    versionNumber: nextVersion,
                    status: ApprovalDefinitionStatus.PUBLISHED,
                    definition: updatedPolicy.steps.map((step: any) => ({
                        stepOrder: step.stepOrder,
                        approverType: step.approverType,
                        approverId: step.approverId,
                        roleId: step.roleId,
                        departmentId: step.departmentId,
                        entityId: step.entityId,
                        teamId: step.teamId,
                        label: step.label,
                        autoApproveIf: step.autoApproveIf,
                        timeoutHours: step.timeoutHours,
                        parallelGroup: step.parallelGroup,
                        timeoutAction: step.timeoutAction,
                        condition: step.condition,
                    })),
                    publishedAt: new Date(),
                    publishedBy: publisher.id,
                },
            });
        });
    }

    const request = await prisma.request.findFirst({
        where: { referenceNumber: REQUEST_REFERENCE, tenantId: TENANT_ID },
        select: { id: true, status: true },
    });
    if (!request) throw new Error(`${REQUEST_REFERENCE} was not found`);

    await prisma.$transaction(async (tx) => {
        const runtimeTx = tx as any;
        await runtimeTx.request.update({
            where: { id: request.id },
            data: { assignedToId: targetUser.id },
        });
        await runtimeTx.requestApproval.updateMany({
            where: { requestId: request.id, approverType: 'GROUP_DCEO', status: 'PENDING' },
            data: { approverId: targetUser.id },
        });

        const instance = await runtimeTx.approvalInstance.findFirst({
            where: { requestId: request.id, status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
        });
        if (instance) {
            await runtimeTx.approvalInstanceStep.updateMany({
                where: { instanceId: instance.id, stepOrder: 2, status: { in: ['WAITING', 'ACTIVE'] } },
                data: { assignedApproverId: targetUser.id },
            });
        }

        const message = `Approval assignment rectified to ${TARGET_APPROVER_EMAIL} from tenant Purchase Requisition policy configuration.`;
        const existingActivity = await runtimeTx.requestActivity.findFirst({
            where: { requestId: request.id, message },
            select: { id: true },
        });
        if (!existingActivity) {
            await runtimeTx.requestActivity.create({
                data: {
                    requestId: request.id,
                    authorName: 'System',
                    activityType: 'ASSIGNMENT',
                    message,
                    isSystemGenerated: true,
                    metadata: { source: 'rectify-purchase-requisition-group-dceo', approverEmail: TARGET_APPROVER_EMAIL },
                },
            });
        }
    });

    const latest = await prisma.approvalPolicyVersion.findFirst({
        where: { policyId: policy.id, status: ApprovalDefinitionStatus.PUBLISHED },
        orderBy: { versionNumber: 'desc' },
        select: { id: true, versionNumber: true },
    });
    console.log(JSON.stringify({
        policyId: policy.id,
        publishedVersion: latest,
        request: REQUEST_REFERENCE,
        assignedTo: targetUser.email,
        idempotent: sameUserStep(existingPublished?.definition, targetUser.id),
    }));
}

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
