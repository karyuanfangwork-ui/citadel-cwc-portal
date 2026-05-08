import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler, AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { auditLog } from '../utils/audit';
import { sendEmail, renderTemplate } from '../services/email.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Canonical list of every event type used by notify() calls across the codebase.
 * Grouped by workflow category so the admin UI can display them logically.
 */
const EVENT_TYPE_REGISTRY: {
    eventType: string;
    label: string;
    category: string;
    recipientDescription: string;
    availableVariables: string[];
}[] = [
    // ── General ─────────────────────────────────────────────────────
    { eventType: 'REQUEST_CREATED',  label: 'Request Created',  category: 'General', recipientDescription: 'Requester + Assigned agent', availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'requesterName', 'categoryName', 'priority', 'userName', 'appUrl'] },
    { eventType: 'REQUEST_ASSIGNED', label: 'Request Assigned',  category: 'General', recipientDescription: 'Assignee',          availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'assigneeName', 'userName', 'appUrl'] },
    { eventType: 'STATUS_CHANGED',   label: 'Status Changed',   category: 'General', recipientDescription: 'Requester',          availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'oldStatus', 'newStatus', 'changedBy', 'userName', 'appUrl'] },
    { eventType: 'COMMENT_ADDED',    label: 'Comment Added',    category: 'General', recipientDescription: 'Requester / Assignee', availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'commenterName', 'commentText', 'userName', 'appUrl'] },
    { eventType: 'SLA_BREACHED',     label: 'SLA Breached',     category: 'SLA',  recipientDescription: 'Agent + Managers',  availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'referenceNumber', 'status', 'priority', 'assigneeName', 'requesterName', 'categoryName', 'requestTypeName', 'slaDeadline', 'userName', 'appUrl'] },
    { eventType: 'SLA_ESCALATED',     label: 'SLA Escalated',     category: 'SLA',  recipientDescription: 'Escalation target roles',  availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'referenceNumber', 'status', 'priority', 'assigneeName', 'requesterName', 'categoryName', 'requestTypeName', 'escalationHours', 'escalationLabel', 'notifyRoles', 'userName', 'appUrl'] },
    { eventType: 'PASSWORD_RESET',   label: 'Password Reset',   category: 'Auth',    recipientDescription: 'Requester',          availableVariables: ['userName', 'resetUrl', 'appUrl'] },

    // ── IT Workflow ─────────────────────────────────────────────────
    { eventType: 'MANAGER_APPROVAL_REQUIRED', label: 'Manager Approval Required',  category: 'IT Workflow', recipientDescription: 'Manager',    availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'requesterName', 'userName', 'appUrl'] },
    { eventType: 'MANAGER_APPROVED',          label: 'Manager Approved',           category: 'IT Workflow', recipientDescription: 'Requester',   availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'userName', 'appUrl'] },
    { eventType: 'MANAGER_REJECTED',          label: 'Manager Rejected',           category: 'IT Workflow', recipientDescription: 'Requester',   availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'rejectionReason', 'userName', 'appUrl'] },
    { eventType: 'VP_APPROVAL_REQUIRED',      label: 'VP Approval Required',       category: 'IT Workflow', recipientDescription: 'VP users',    availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'requesterName', 'price', 'userName', 'appUrl'] },
    { eventType: 'VP_APPROVED',               label: 'VP Approved',                category: 'IT Workflow', recipientDescription: 'Requester',   availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'userName', 'appUrl'] },
    { eventType: 'VP_REJECTED',               label: 'VP Rejected',                category: 'IT Workflow', recipientDescription: 'Requester',   availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'rejectionReason', 'comments', 'userName', 'appUrl'] },
    { eventType: 'PROCUREMENT_INITIATED',     label: 'Procurement Initiated',      category: 'IT Workflow', recipientDescription: 'Requester',   availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'userName', 'appUrl'] },
    { eventType: 'HARDWARE_ORDERED',          label: 'Hardware Ordered',           category: 'IT Workflow', recipientDescription: 'Requester',   availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'orderNumber', 'userName', 'appUrl'] },
    { eventType: 'HARDWARE_RECEIVED',         label: 'Hardware Received',          category: 'IT Workflow', recipientDescription: 'Requester',   availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'userName', 'appUrl'] },
    { eventType: 'HARDWARE_DELIVERED',        label: 'Hardware Delivered',          category: 'IT Workflow', recipientDescription: 'Requester',   availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'userName', 'appUrl'] },
    { eventType: 'APPROVAL_REQUIRED',         label: 'Executive Approval Required', category: 'IT Workflow', recipientDescription: 'CEO / CTO', availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'approverRole', 'role', 'approvalLevel', 'userName', 'appUrl'] },
    { eventType: 'REQUEST_REJECTED',          label: 'Request Rejected (Executive)', category: 'IT Workflow', recipientDescription: 'Requester', availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'rejectedBy', 'rejectionReason', 'comments', 'userName', 'appUrl'] },
    { eventType: 'ACTION_REQUIRED',           label: 'Action Required',            category: 'IT Workflow', recipientDescription: 'Assigned agent', availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'action', 'userName', 'appUrl'] },
    { eventType: 'REQUEST_RESOLVED',          label: 'Request Resolved',           category: 'IT Workflow', recipientDescription: 'Requester',   availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'userName', 'appUrl'] },

    // ── Finance Purchase Requisition ────────────────────────────────
    { eventType: 'FINANCE_ACKNOWLEDGED',       label: 'Finance Acknowledged',       category: 'Finance', recipientDescription: 'Requester', availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'userName', 'appUrl'] },
    { eventType: 'FINANCE_ROUTED_CFO',         label: 'Routed to CFO',              category: 'Finance', recipientDescription: 'Requester', availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'currency', 'amount', 'userName', 'appUrl'] },
    { eventType: 'FINANCE_CFO_DECISION',       label: 'CFO Decision',               category: 'Finance', recipientDescription: 'Requester', availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'decision', 'currency', 'amount', 'userName', 'appUrl'] },
    { eventType: 'FINANCE_GROUP_CEO_DECISION', label: 'Group CEO Decision',         category: 'Finance', recipientDescription: 'Requester', availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'decision', 'currency', 'amount', 'userName', 'appUrl'] },
    { eventType: 'FINANCE_PAYMENT_COMPLETE',   label: 'Payment Complete',           category: 'Finance', recipientDescription: 'Requester', availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'currency', 'amount', 'paymentRef', 'userName', 'appUrl'] },
    { eventType: 'FINANCE_TICKET_CLOSED',      label: 'Finance Ticket Closed',      category: 'Finance', recipientDescription: 'Requester', availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'userName', 'appUrl'] },

    // ── Finance Expense Reimbursement ───────────────────────────────
    { eventType: 'FINANCE_MANAGER_APPROVAL_REQUESTED', label: 'Manager Approval Requested (Finance)', category: 'Finance', recipientDescription: 'Manager',    availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'userName', 'appUrl'] },
    { eventType: 'FINANCE_MANAGER_DECISION',           label: 'Manager Decision (Finance)',           category: 'Finance', recipientDescription: 'Requester',   availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'userName', 'appUrl'] },
    { eventType: 'FINANCE_HEAD_APPROVAL_REQUESTED',    label: 'Finance Head Approval Requested',      category: 'Finance', recipientDescription: 'Finance Head', availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'userName', 'appUrl'] },
    { eventType: 'FINANCE_HEAD_DECISION',              label: 'Finance Head Decision',                category: 'Finance', recipientDescription: 'Requester',   availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'userName', 'appUrl'] },
    { eventType: 'FINANCE_PAYMENT_UPDATE',             label: 'Payment Update',                       category: 'Finance', recipientDescription: 'Requester',   availableVariables: ['requestId', 'requestUuid', 'requestTitle', 'userName', 'appUrl'] },

    // ── Inter-Company Chargeback ────────────────────────────────────
    { eventType: 'CHARGEBACK_PENDING_FROM_ENTITY',  label: 'Pending From-Entity Approval',  category: 'Chargeback', recipientDescription: 'Entity Approver',        availableVariables: ['requestId', 'requestUuid', 'userName', 'appUrl'] },
    { eventType: 'CHARGEBACK_PENDING_TO_ENTITY',    label: 'Pending To-Entity Approval',    category: 'Chargeback', recipientDescription: 'Entity Approver', availableVariables: ['requestId', 'requestUuid', 'userName', 'appUrl'] },
    { eventType: 'CHARGEBACK_FROM_ENTITY_DECISION', label: 'From-Entity Decision',          category: 'Chargeback', recipientDescription: 'Requester',       availableVariables: ['requestId', 'requestUuid', 'decision', 'userName', 'appUrl'] },
    { eventType: 'CHARGEBACK_TO_ENTITY_DECISION',   label: 'To-Entity Decision',            category: 'Chargeback', recipientDescription: 'Requester',       availableVariables: ['requestId', 'requestUuid', 'decision', 'userName', 'appUrl'] },
    { eventType: 'CHARGEBACK_MARK_CONFIRMED',       label: 'Chargeback Confirmed',          category: 'Chargeback', recipientDescription: 'Requester',       availableVariables: ['requestId', 'requestUuid', 'userName', 'appUrl'] },
    { eventType: 'CHARGEBACK_COMPLETED',            label: 'Chargeback Completed',          category: 'Chargeback', recipientDescription: 'Requester',       availableVariables: ['requestId', 'requestUuid', 'userName', 'appUrl'] },
];

class NotificationTemplateController {
    /**
     * GET /admin/notification-templates
     * List all notification templates
     */
    getAll = asyncHandler(async (_req: AuthRequest, res: Response) => {
        const templates = await prisma.notificationTemplate.findMany({
            orderBy: { eventType: 'asc' },
        });

        res.json({
            status: 'success',
            data: { templates },
        });
    });

    /**
     * GET /admin/notification-templates/event-types
     * Return the canonical registry of all event types so the admin UI can show
     * which events have templates configured vs which are unconfigured.
     */
    getEventTypes = asyncHandler(async (_req: AuthRequest, res: Response) => {
        res.json({
            status: 'success',
            data: { eventTypes: EVENT_TYPE_REGISTRY },
        });
    });

    /**
     * GET /admin/notification-templates/:id
     */
    getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params as { id: string };
        const template = await prisma.notificationTemplate.findUnique({ where: { id } });
        if (!template) throw new AppError('Template not found', 404);

        res.json({
            status: 'success',
            data: { template },
        });
    });

    /**
     * POST /admin/notification-templates
     * Create a new notification template
     */
    create = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { name, eventType, emailSubject, emailBody, smsBody, pushTitle, pushBody, isActive } = req.body as Record<string, any>;

        if (!name || !eventType) {
            throw new AppError('name and eventType are required', 400);
        }

        const existing = await prisma.notificationTemplate.findUnique({ where: { name } });
        if (existing) throw new AppError('Template with this name already exists', 409);

        const template = await prisma.notificationTemplate.create({
            data: {
                name,
                eventType,
                emailSubject: emailSubject || null,
                emailBody: emailBody || null,
                smsBody: smsBody || null,
                pushTitle: pushTitle || null,
                pushBody: pushBody || null,
                isActive: isActive !== undefined ? isActive : true,
            },
        });

        await auditLog(req, 'CREATE', 'NotificationTemplate', template.id, {
            name,
            eventType,
            isActive: template.isActive,
        });

        res.status(201).json({
            status: 'success',
            data: { template },
        });
    });

    /**
     * PUT /admin/notification-templates/:id
     * Update an existing template
     */
    update = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params as { id: string };
        const { emailSubject, emailBody, smsBody, pushTitle, pushBody, isActive } = req.body as Record<string, any>;

        const existing = await prisma.notificationTemplate.findUnique({ where: { id } });
        if (!existing) throw new AppError('Template not found', 404);

        const oldValues = {
            emailSubject: existing.emailSubject,
            emailBody: existing.emailBody,
            isActive: existing.isActive,
        };

        const template = await prisma.notificationTemplate.update({
            where: { id },
            data: {
                ...(emailSubject !== undefined && { emailSubject }),
                ...(emailBody !== undefined && { emailBody }),
                ...(smsBody !== undefined && { smsBody }),
                ...(pushTitle !== undefined && { pushTitle }),
                ...(pushBody !== undefined && { pushBody }),
                ...(isActive !== undefined && { isActive }),
            },
        });

        await auditLog(req, 'UPDATE', 'NotificationTemplate', template.id, {
            emailSubject: template.emailSubject,
            emailBody: template.emailBody,
            isActive: template.isActive,
        }, oldValues);

        res.json({
            status: 'success',
            data: { template },
        });
    });

    /**
     * DELETE /admin/notification-templates/:id
     * Soft-delete by setting isActive = false
     */
    delete = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params as { id: string };

        const existing = await prisma.notificationTemplate.findUnique({ where: { id } });
        if (!existing) throw new AppError('Template not found', 404);

        await prisma.notificationTemplate.update({
            where: { id },
            data: { isActive: false },
        });

        await auditLog(req, 'DEACTIVATE', 'NotificationTemplate', id, { isActive: false }, { isActive: existing.isActive });

        res.json({
            status: 'success',
            message: 'Template deactivated',
        });
    });

    /**
     * POST /admin/notification-templates/:id/test
     * Send a test email to the current admin user using the template with sample variables.
     */
    sendTestEmail = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params as { id: string };

        const template = await prisma.notificationTemplate.findUnique({ where: { id } });
        if (!template) throw new AppError('Template not found', 404);

        if (!template.emailSubject || !template.emailBody) {
            throw new AppError('Template has no email subject or body configured', 400);
        }

        // Build sample variables
        const sampleVars: Record<string, string> = {
            requestId: 'REQ-00001',
            requestUuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            requestTitle: 'Sample Request — Test Email',
            requesterName: `${req.user!.firstName} ${req.user!.lastName}`,
            userName: `${req.user!.firstName} ${req.user!.lastName}`,
            assigneeName: 'John Agent',
            categoryName: 'IT Support',
            requestTypeName: 'Hardware Request',
            priority: 'MEDIUM',
            status: 'IN_PROGRESS',
            oldStatus: 'SUBMITTED',
            newStatus: 'IN_REVIEW',
            changedBy: 'System Admin',
            commenterName: 'Jane Doe',
            commentText: 'This is a sample comment for the test email preview.',
            slaDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString(),
            referenceNumber: 'REQ-00001',
            escalationHours: '4',
            escalationLabel: 'Level 1 — Notify Manager',
            notifyRoles: 'ADMIN, MANAGER',
            rejectionReason: 'Budget not available',
            rejectedBy: 'CEO',
            comments: 'This is a test comment',
            action: 'hardware_provision',
            orderNumber: 'PO-2026-001',
            approverRole: 'CEO',
            approvalLevel: 'Executive',
            role: 'CEO',
            price: '5,000.00',
            decision: 'APPROVED',
            currency: 'RM',
            amount: '10,000.00',
            paymentRef: 'PAY-2026-001',
            resetUrl: '#',
            appUrl: 'http://localhost:5173',
        };

        const subject = renderTemplate(template.emailSubject, sampleVars);
        const body = renderTemplate(template.emailBody, sampleVars);

        const sent = await sendEmail(req.user!.email, `[TEST] ${subject}`, body);

        if (!sent) {
            throw new AppError('Failed to send test email. Check Resend configuration.', 500);
        }

        logger.info(`Test email sent to ${req.user!.email} for template ${template.name}`);

        res.json({
            status: 'success',
            message: `Test email sent to ${req.user!.email}`,
        });
    });
}

export const notificationTemplateController = new NotificationTemplateController();
