import 'dotenv/config';
import { ApprovalDefinitionStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const POLICY_NAME = 'Purchase Requisition Approval Runtime';

const POLICY_STEPS = [
    {
        stepOrder: 1,
        approverType: 'ROLE' as const,
        roleId: 'CFO',
        label: 'Chief Financial Officer approval',
        timeoutHours: 72,
        timeoutAction: 'REMINDER' as const,
    },
    {
        stepOrder: 2,
        approverType: 'ROLE' as const,
        roleId: 'GROUP_DCEO',
        label: 'Group Deputy CEO approval',
        timeoutHours: 72,
        timeoutAction: 'REMINDER' as const,
    },
];

function definitionFromSteps(steps: typeof POLICY_STEPS) {
    return steps.map((step) => ({
        stepOrder: step.stepOrder,
        approverType: step.approverType,
        approverId: null,
        roleId: step.roleId,
        departmentId: null,
        entityId: null,
        teamId: null,
        label: step.label,
        autoApproveIf: null,
        timeoutHours: step.timeoutHours,
        parallelGroup: null,
        timeoutAction: step.timeoutAction,
        condition: null,
    }));
}

function sameDefinition(left: unknown, right: unknown): boolean {
    const normalize = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(normalize);
        if (value && typeof value === 'object') {
            return Object.fromEntries(
                Object.entries(value as Record<string, unknown>)
                    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
                    .map(([key, nestedValue]) => [key, normalize(nestedValue)]),
            );
        }
        return value;
    };

    return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

async function main() {
    const requestType = await prisma.requestType.findFirst({
        where: {
            tenantId: DEFAULT_TENANT_ID,
            code: 'PURCHASE_REQUISITION',
        },
        select: { id: true, code: true },
    });

    if (!requestType) {
        throw new Error('PURCHASE_REQUISITION request type was not found. Run the canonical Prisma seed first.');
    }

    const publisher = await prisma.user.findFirst({
        where: {
            tenantId: DEFAULT_TENANT_ID,
            isActive: true,
            OR: [
                { email: 'admin@test.local' },
                { email: 'cfo@test.local' },
            ],
        },
        orderBy: { email: 'asc' },
        select: { id: true, email: true },
    });

    if (!publisher) {
        throw new Error('No active admin or CFO publisher account was found for the default tenant.');
    }

    let policy = await prisma.approvalPolicy.findFirst({
        where: {
            tenantId: DEFAULT_TENANT_ID,
            requestTypeId: requestType.id,
            name: POLICY_NAME,
        },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!policy) {
        policy = await prisma.approvalPolicy.create({
            data: {
                tenantId: DEFAULT_TENANT_ID,
                name: POLICY_NAME,
                description: 'Versioned Purchase Requisition approval flow used by shadow-mode comparison.',
                requestTypeId: requestType.id,
                isActive: true,
                priority: 10,
                steps: { create: POLICY_STEPS },
            },
            include: { steps: { orderBy: { stepOrder: 'asc' } } },
        });
    }

    const publishedVersion = await prisma.approvalPolicyVersion.findFirst({
        where: {
            policyId: policy.id,
            status: ApprovalDefinitionStatus.PUBLISHED,
        },
        orderBy: { versionNumber: 'desc' },
    });

    const canonicalDefinition = definitionFromSteps(POLICY_STEPS);

    if (publishedVersion) {
        if (!sameDefinition(publishedVersion.definition, canonicalDefinition)) {
            throw new Error(
                `Published Purchase Requisition policy version ${publishedVersion.versionNumber} differs from the canonical seed. ` +
                'Retire it and create an explicit replacement instead of mutating an immutable version.',
            );
        }

        console.log(`✅ Purchase Requisition policy already published (version ${publishedVersion.versionNumber})`);
        return;
    }

    // No published version exists yet. Sync the draft policy steps before
    // publishing so the frozen definition is deterministic.
    await prisma.$transaction(async (tx) => {
        await tx.approvalPolicyStep.deleteMany({ where: { policyId: policy!.id } });
        await tx.approvalPolicyStep.createMany({
            data: POLICY_STEPS.map((step) => ({ ...step, policyId: policy!.id })),
        });

        const latestVersion = await tx.approvalPolicyVersion.findFirst({
            where: { policyId: policy!.id },
            orderBy: { versionNumber: 'desc' },
            select: { versionNumber: true },
        });

        await tx.approvalPolicyVersion.create({
            data: {
                policyId: policy!.id,
                versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
                status: ApprovalDefinitionStatus.PUBLISHED,
                definition: canonicalDefinition,
                publishedAt: new Date(),
                publishedBy: publisher.id,
                effectiveFrom: new Date(),
            },
        });

        await tx.approvalPolicy.update({
            where: { id: policy!.id },
            data: { isActive: true },
        });
    });

    console.log(`✅ Published Purchase Requisition approval policy using ${publisher.email}`);
    console.log('   Step 1: CFO');
    console.log('   Step 2: GROUP_DCEO');
}

main()
    .catch((error) => {
        console.error('❌ Purchase Requisition approval seed failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
