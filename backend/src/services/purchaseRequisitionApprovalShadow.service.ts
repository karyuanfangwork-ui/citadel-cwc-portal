/**
 * Purchase Requisition approval-runtime shadow mode.
 *
 * This adapter is intentionally disabled unless
 * APPROVAL_RUNTIME_PR_SHADOW_ENABLED=true. When enabled, it starts one
 * versioned approval-runtime instance per Purchase Requisition and compares
 * the runtime's resolved approvers with the inline RequestApproval records.
 *
 * Shadow mode must never affect the live workflow. All errors are logged and
 * swallowed so the existing Finance workflow remains authoritative.
 */

import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { startApprovalInstance } from './approvalRuntime.service';

const db = prisma as any;

export interface PurchaseRequisitionShadowInput {
    requestId: string;
    tenantId: string;
    requestTypeId: string;
    actorId: string;
}

export interface PurchaseRequisitionShadowResult {
    enabled: boolean;
    status: 'DISABLED' | 'MATCH' | 'MISMATCH' | 'ERROR';
    instanceId?: string;
    comparisons: Array<{
        stepOrder: number;
        runtimeApproverId: string | null;
        inlineApproverId: string | null;
        runtimeApproverType: string;
        inlineApproverType: string | null;
        matches: boolean;
    }>;
    error?: string;
}

function isEnabled(): boolean {
    return process.env.APPROVAL_RUNTIME_PR_SHADOW_ENABLED === 'true';
}

/**
 * Compare the published runtime definition with the inline approvals present
 * at the time the Finance workflow reaches an approval boundary.
 */
export async function runPurchaseRequisitionApprovalShadow(
    input: PurchaseRequisitionShadowInput,
): Promise<PurchaseRequisitionShadowResult> {
    if (!isEnabled()) {
        return { enabled: false, status: 'DISABLED', comparisons: [] };
    }

    try {
        const request = await prisma.request.findFirst({
            where: {
                id: input.requestId,
                tenantId: input.tenantId,
                requestTypeId: input.requestTypeId,
                requestType: { code: 'PURCHASE_REQUISITION' },
            },
            select: { id: true },
        });

        if (!request) {
            return { enabled: true, status: 'ERROR', comparisons: [], error: 'Purchase Requisition request not found' };
        }

        let instance = await db.approvalInstance.findFirst({
            where: { requestId: input.requestId, tenantId: input.tenantId },
            include: { steps: { orderBy: { stepOrder: 'asc' } } },
            orderBy: { createdAt: 'asc' },
        });

        if (!instance) {
            instance = await startApprovalInstance({
                requestId: input.requestId,
                tenantId: input.tenantId,
                requestTypeId: input.requestTypeId,
                actorId: input.actorId,
            });
        }

        const inlineApprovals = await prisma.requestApproval.findMany({
            where: { requestId: input.requestId },
            orderBy: [{ stepOrder: 'asc' }, { createdAt: 'asc' }],
            select: { approverId: true, approverType: true, status: true },
        });

        // Only compare inline records that have already been created. Later
        // approval groups are intentionally not treated as mismatches yet.
        const comparisons = inlineApprovals.map((inlineApproval: any, index: number) => {
            const runtimeStep = instance.steps[index];
            const matches = Boolean(runtimeStep) && runtimeStep.assignedApproverId === inlineApproval.approverId;
            return {
                stepOrder: runtimeStep?.stepOrder ?? index + 1,
                runtimeApproverId: runtimeStep?.assignedApproverId ?? null,
                inlineApproverId: inlineApproval.approverId ?? null,
                runtimeApproverType: runtimeStep?.approverType ?? 'UNKNOWN',
                inlineApproverType: inlineApproval.approverType ?? null,
                matches,
            };
        });

        const status = comparisons.every(comparison => comparison.matches) ? 'MATCH' : 'MISMATCH';
        const result: PurchaseRequisitionShadowResult = {
            enabled: true,
            status,
            instanceId: instance.id,
            comparisons,
        };

        logger.info('[ApprovalShadow][PurchaseRequisition] comparison', {
            requestId: input.requestId,
            instanceId: instance.id,
            status,
            comparisons,
        });

        return result;
    } catch (error: any) {
        const message = error?.message || 'Unknown approval shadow error';
        logger.error('[ApprovalShadow][PurchaseRequisition] failed', {
            requestId: input.requestId,
            error: message,
        });
        return { enabled: true, status: 'ERROR', comparisons: [], error: message };
    }
}
