import { Request, Response } from 'express';
import { RequestStatus } from '@prisma/client';
import { notify } from '../services/notification.service';
import { auditLog } from '../utils/audit';
import { pauseSla, resumeSla } from '../services/sla-pause.service';

import prisma from '../utils/prisma';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveRequestId(idOrRef: string): Promise<string | null> {
    if (UUID_RE.test(idOrRef)) return idOrRef;
    const row = await prisma.request.findFirst({
        where: { referenceNumber: idOrRef, deletedAt: null },
        select: { id: true },
    });
    return row?.id ?? null;
}

async function logActivity(requestId: string, message: string, authorId?: string) {
    await prisma.requestActivity.create({
        data: {
            requestId,
            authorId: authorId || null,
            authorName: 'System',
            activityType: 'STATUS_CHANGE',
            message,
            isSystemGenerated: true,
        },
    });
}

/** POST /chargeback-workflow/requests/:id/submit — Submit chargeback to From Entity approver */
export const submitChargeback = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }
        const userId = (req as any).user?.id;

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }
        if (request.status !== 'SUBMITTED') {
            res.status(400).json({ status: 'error', message: 'Request must be in SUBMITTED status' });
            return;
        }

        // Look up from entity approver from customFields
        const cf = (request.customFields as Record<string, any>) || {};
        const fromEntityCode = cf.chargeFromEntity;
        let fromEntityApproverId: string | null = null;
        let fromEntityId: string | null = null;
        if (fromEntityCode) {
            const entity = await prisma.entity.findFirst({ where: { code: fromEntityCode } });
            if (entity) {
                fromEntityApproverId = entity.approverId;
                fromEntityId = entity.id;
            }
        }

        const updated = await prisma.request.update({
            where: { id },
            data: {
                status: RequestStatus.PENDING_FROM_ENTITY_APPROVAL,
                ...(fromEntityApproverId ? { assignedToId: fromEntityApproverId } : {}),
            },
        });

        // Create a pending approval record so the approver can see it in their queue
        if (fromEntityApproverId) {
            await prisma.requestApproval.create({
                data: {
                    requestId: id,
                    approverType: 'FROM_ENTITY',
                    approverId: fromEntityApproverId,
                    entityId: fromEntityId,
                    status: 'PENDING',
                },
            });
        }

        // Pause SLA — request entered PENDING_FROM_ENTITY_APPROVAL
        await pauseSla(id);

        await logActivity(id, 'Chargeback submitted — routed to From Entity approver' + (fromEntityCode ? ` (${fromEntityCode})` : ''), userId);
        await auditLog(req as any, 'CHARGEBACK_SUBMIT', 'request', id, {
            status: RequestStatus.PENDING_FROM_ENTITY_APPROVAL,
            previousStatus: 'SUBMITTED',
            assignedToId: fromEntityApproverId,
        }, { status: request.status });

        if (fromEntityApproverId) {
            await notify({
                userId: fromEntityApproverId,
                eventType: 'CHARGEBACK_PENDING_FROM_ENTITY',
                variables: { requestId: id },
                relatedRequestId: id,
            });
        }

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('submitChargeback error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to submit chargeback' });
    }
};

/** POST /chargeback-workflow/requests/:id/from-entity-decision */
export const fromEntityDecision = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }
        const { decision, comments } = req.body;
        const userId = (req as any).user?.id;
        const userRoles: string[] = (req as any).user?.roles || [];

        if (!['APPROVED', 'REJECTED'].includes(decision)) {
            res.status(400).json({ status: 'error', message: 'decision must be APPROVED or REJECTED' });
            return;
        }

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }
        if (request.status !== RequestStatus.PENDING_FROM_ENTITY_APPROVAL) {
            res.status(400).json({ status: 'error', message: 'Request must be in PENDING_FROM_ENTITY_APPROVAL status' });
            return;
        }

        // Only the designated From Entity approver (or admin/GROUP_DCEO override) can make this decision
        if (!userRoles.includes('ADMIN') && !userRoles.includes('GROUP_DCEO')) {
            const pendingApproval = await prisma.requestApproval.findFirst({
                where: { requestId: id, approverType: 'FROM_ENTITY', status: 'PENDING' },
            });
            if (!pendingApproval || pendingApproval.approverId !== userId) {
                res.status(403).json({ status: 'error', message: 'Only the designated From Entity approver can make this decision' });
                return;
            }
        }

        const newStatus = decision === 'APPROVED'
            ? RequestStatus.PENDING_TO_ENTITY_APPROVAL
            : RequestStatus.FROM_ENTITY_REJECTED;

        // When approved, route to To Entity approver
        let toEntityApproverId: string | null = null;
        let toEntityId: string | null = null;
        if (decision === 'APPROVED') {
            const cf = (request.customFields as Record<string, any>) || {};
            const toEntityCode = cf.chargeToEntity;
            if (toEntityCode) {
                const entity = await prisma.entity.findFirst({ where: { code: toEntityCode } });
                if (entity) {
                    toEntityApproverId = entity.approverId;
                    toEntityId = entity.id;
                }
            }
        }

        const updated = await prisma.request.update({
            where: { id },
            data: {
                status: newStatus,
                ...(toEntityApproverId ? { assignedToId: toEntityApproverId } : {}),
                ...(decision === 'REJECTED' ? { assignedToId: null } : {}),
            },
        });

        // Create a pending approval record for to-entity approver
        if (decision === 'APPROVED' && toEntityApproverId) {
            await prisma.requestApproval.create({
                data: {
                    requestId: id,
                    approverType: 'TO_ENTITY',
                    approverId: toEntityApproverId,
                    entityId: toEntityId,
                    status: 'PENDING',
                },
            });
            await notify({
                userId: toEntityApproverId,
                eventType: 'CHARGEBACK_PENDING_TO_ENTITY',
                variables: { requestId: id },
                relatedRequestId: id,
            });
        }

        // Update the existing PENDING approval record to reflect the decision
        await prisma.requestApproval.updateMany({
            where: { requestId: id, approverType: 'FROM_ENTITY', status: 'PENDING' },
            data: { status: decision, comments: comments || null },
        });

        // Resume SLA — leaving PENDING_FROM_ENTITY_APPROVAL
        await resumeSla(id);

        // If approved, pause SLA again — entering PENDING_TO_ENTITY_APPROVAL
        if (decision === 'APPROVED') {
            await pauseSla(id);
        }

        const verb = decision === 'APPROVED' ? 'approved — routed to To Entity approver' : 'rejected';
        await logActivity(id, `From Entity approver ${verb}${comments ? ': ' + comments : ''}`, userId);
        await auditLog(req as any, 'APPROVAL_DECISION', 'request', id, {
            decision,
            approverType: 'FROM_ENTITY',
            newStatus,
            previousStatus: request.status,
            comments: comments || null,
        }, { status: request.status });
        await notify({
            userId: request.requesterId,
            eventType: 'CHARGEBACK_FROM_ENTITY_DECISION',
            variables: { requestId: id, decision },
            relatedRequestId: id,
        });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('fromEntityDecision error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to process From Entity decision' });
    }
};

/** POST /chargeback-workflow/requests/:id/to-entity-decision */
export const toEntityDecision = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }
        const { decision, comments } = req.body;
        const userId = (req as any).user?.id;
        const userRoles: string[] = (req as any).user?.roles || [];

        if (!['APPROVED', 'REJECTED'].includes(decision)) {
            res.status(400).json({ status: 'error', message: 'decision must be APPROVED or REJECTED' });
            return;
        }

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }
        if (request.status !== RequestStatus.PENDING_TO_ENTITY_APPROVAL) {
            res.status(400).json({ status: 'error', message: 'Request must be in PENDING_TO_ENTITY_APPROVAL status' });
            return;
        }

        // Only the designated To Entity approver (or admin/GROUP_DCEO override) can make this decision
        if (!userRoles.includes('ADMIN') && !userRoles.includes('GROUP_DCEO')) {
            const pendingApproval = await prisma.requestApproval.findFirst({
                where: { requestId: id, approverType: 'TO_ENTITY', status: 'PENDING' },
            });
            if (!pendingApproval || pendingApproval.approverId !== userId) {
                res.status(403).json({ status: 'error', message: 'Only the designated To Entity approver can make this decision' });
                return;
            }
        }

        const newStatus = decision === 'APPROVED'
            ? RequestStatus.CHARGEBACK_FINANCE_REVIEW
            : RequestStatus.TO_ENTITY_REJECTED;

        // When approved, reassign back to a Finance agent; when rejected, clear assignment
        const updateData: Record<string, any> = { status: newStatus };
        if (decision === 'APPROVED') {
            // Reassign to a Finance agent so they can see it in their queue
            const financeAgent = await prisma.user.findFirst({
                where: {
                    agentTeam: 'FINANCE',
                    isActive: true,
                    roles: { some: { role: { name: { in: ['AGENT', 'ADMIN'] } } } },
                },
                select: { id: true, firstName: true, lastName: true },
                orderBy: { createdAt: 'asc' },
            });
            if (financeAgent) {
                updateData.assignedToId = financeAgent.id;
                updateData.assignedTeam = 'FINANCE';
            }
        } else {
            updateData.assignedToId = null;
            updateData.assignedTeam = null;
        }

        const updated = await prisma.request.update({
            where: { id },
            data: updateData,
        });

        // Update the existing PENDING approval record to reflect the decision
        await prisma.requestApproval.updateMany({
            where: { requestId: id, approverType: 'TO_ENTITY', status: 'PENDING' },
            data: { status: decision, comments: comments || null },
        });

        // Resume SLA — leaving PENDING_TO_ENTITY_APPROVAL
        await resumeSla(id);

        const verb = decision === 'APPROVED' ? 'approved — routed to Finance team for review' : 'rejected';
        await logActivity(id, `To Entity approver ${verb}${comments ? ': ' + comments : ''}`, userId);
        await auditLog(req as any, 'APPROVAL_DECISION', 'request', id, {
            decision,
            approverType: 'TO_ENTITY',
            newStatus,
            previousStatus: request.status,
            comments: comments || null,
        }, { status: request.status });
        await notify({
            userId: request.requesterId,
            eventType: 'CHARGEBACK_TO_ENTITY_DECISION',
            variables: { requestId: id, decision },
            relatedRequestId: id,
        });

        // If approved and reassigned, log the auto-assignment
        if (decision === 'APPROVED' && updateData.assignedToId) {
            const financeAgent = await prisma.user.findUnique({
                where: { id: updateData.assignedToId as string },
                select: { firstName: true, lastName: true },
            });
            if (financeAgent) {
                await prisma.requestActivity.create({
                    data: {
                        requestId: id,
                        authorName: 'System',
                        activityType: 'ASSIGNMENT',
                        message: `Auto-reassigned to ${financeAgent.firstName} ${financeAgent.lastName} (FINANCE team) — To Entity approved, finance review`,
                        isSystemGenerated: true,
                        metadata: { autoAssigned: true, assignedToId: updateData.assignedToId, assignedTeam: 'FINANCE' },
                    },
                });
                await notify({
                    userId: updateData.assignedToId as string,
                    eventType: 'CHARGEBACK_PENDING_FROM_ENTITY',
                    variables: { requestId: id },
                    relatedRequestId: id,
                });
            }
        }

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('toEntityDecision error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to process To Entity decision' });
    }
};

/** POST /chargeback-workflow/requests/:id/mark-confirmed */
export const markConfirmed = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }
        const { notes } = req.body;
        const userId = (req as any).user?.id;

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        const updated = await prisma.request.update({
            where: { id },
            data: { status: RequestStatus.AWAITING_CHARGEBACK_CONFIRMATION },
        });

        await logActivity(id, `Finance agent confirmed chargeback${notes ? ': ' + notes : ''}`, userId);
        await auditLog(req as any, 'CHARGEBACK_MARK_CONFIRMED', 'request', id, {
            status: RequestStatus.AWAITING_CHARGEBACK_CONFIRMATION,
            previousStatus: request.status,
            notes: notes || null,
        }, { status: request.status });
        await notify({
            userId: request.requesterId,
            eventType: 'CHARGEBACK_MARK_CONFIRMED',
            variables: { requestId: id },
            relatedRequestId: id,
        });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('markConfirmed error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to mark chargeback as confirmed' });
    }
};

/** POST /chargeback-workflow/requests/:id/complete */
export const completeChargeback = async (req: Request, res: Response) => {
    try {
        const idOrRef = String(req.params.id);
        const id = await resolveRequestId(idOrRef);
        if (!id) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }
        const userId = (req as any).user?.id;

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            res.status(404).json({ status: 'error', message: 'Request not found' });
            return;
        }

        const updated = await prisma.request.update({
            where: { id },
            data: { status: RequestStatus.CHARGEBACK_COMPLETED, resolvedAt: new Date(), completedAt: new Date() },
        });

        await logActivity(id, 'Inter-company chargeback completed', userId);
        await auditLog(req as any, 'CHARGEBACK_COMPLETED', 'request', id, {
            status: RequestStatus.CHARGEBACK_COMPLETED,
            previousStatus: request.status,
            resolvedAt: new Date().toISOString(),
        }, { status: request.status });
        await notify({
            userId: request.requesterId,
            eventType: 'CHARGEBACK_COMPLETED',
            variables: { requestId: id },
            relatedRequestId: id,
        });

        res.json({ status: 'success', data: { request: updated } });
    } catch (error) {
        console.error('completeChargeback error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to complete chargeback' });
    }
};