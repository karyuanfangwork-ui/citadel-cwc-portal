import { Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { auditLog } from '../utils/audit';
import serviceDeskService from '../services/serviceDesk.service';
import prisma from '../utils/prisma';

class ServiceDeskController {
    getAllServiceDesks = asyncHandler(async (_req: AuthRequest, res: Response) => {
        const serviceDesks = await serviceDeskService.getAllServiceDesks();

        res.json({
            status: 'success',
            data: { serviceDesks },
        });
    });

    getServiceDeskById = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id);
        const serviceDesk = await serviceDeskService.getServiceDeskById(id);

        res.json({
            status: 'success',
            data: { serviceDesk },
        });
    });

    getCategories = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id);
        const categories = await serviceDeskService.getCategories(id);

        res.json({
            status: 'success',
            data: { categories },
        });
    });

    getAllCategoriesAdmin = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id);
        const categories = await serviceDeskService.getAllCategoriesAdmin(id);

        res.json({
            status: 'success',
            data: { categories },
        });
    });

    getRequestTypes = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id); // serviceDeskId
        const { categoryId } = req.query;
        const requestTypes = await serviceDeskService.getRequestTypes(id, categoryId as string | undefined);

        res.json({
            status: 'success',
            data: { requestTypes },
        });
    });

    getAllRequestTypesAdmin = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id); // serviceDeskId
        const { categoryId } = req.query;
        const requestTypes = await serviceDeskService.getAllRequestTypesAdmin(id, categoryId as string | undefined);

        res.json({
            status: 'success',
            data: { requestTypes },
        });
    });

    createServiceDesk = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { name, code, description, autoAssignTeam, assignmentStrategy } = req.body;

        const serviceDesk = await serviceDeskService.createServiceDesk({
            name, code, description,
            autoAssignTeam: autoAssignTeam || 'NONE',
            assignmentStrategy: assignmentStrategy || 'ROUND_ROBIN',
        });

        await auditLog(req, 'ADMIN_CREATE_SERVICE_DESK', 'ServiceDesk', serviceDesk.id, {
            name: serviceDesk.name,
            code: serviceDesk.code,
        });

        res.status(201).json({
            status: 'success',
            data: { serviceDesk },
        });
    });

    updateServiceDesk = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id);
        const { name, description, isActive, autoAssignTeam, assignmentStrategy, lastAssignedIndex } = req.body;

        const serviceDesk = await serviceDeskService.updateServiceDesk(id, {
            name, description, isActive,
            autoAssignTeam, assignmentStrategy, lastAssignedIndex,
        });

        await auditLog(req, 'ADMIN_UPDATE_SERVICE_DESK', 'ServiceDesk', serviceDesk.id, {
            name: serviceDesk.name,
            code: serviceDesk.code,
            isActive: serviceDesk.isActive,
            autoAssignTeam: serviceDesk.autoAssignTeam,
            assignmentStrategy: serviceDesk.assignmentStrategy,
        });

        res.json({
            status: 'success',
            data: { serviceDesk },
        });
    });

    deleteServiceDesk = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id);

        await serviceDeskService.deleteServiceDesk(id);

        await auditLog(req, 'ADMIN_DELETE_SERVICE_DESK', 'ServiceDesk', id, {
            deactivated: true,
        });

        res.json({
            status: 'success',
            message: 'Service desk deleted successfully',
        });
    });

    // --- Category Management Methods ---

    createCategory = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id); // serviceDeskId
        const { name, description, icon, colorClass, displayOrder } = req.body;

        const category = await serviceDeskService.createCategory(id, {
            name,
            description,
            icon,
            colorClass,
            displayOrder: parseInt(displayOrder as string) || 0,
        });

        await auditLog(req, 'ADMIN_CREATE_CATEGORY', 'Category', category.id, {
            serviceDeskId: id,
            name: category.name,
            displayOrder: category.displayOrder,
        });

        res.status(201).json({
            status: 'success',
            data: { category },
        });
    });

    updateCategory = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { categoryId } = req.params;
        const { name, description, icon, colorClass, displayOrder, isActive } = req.body;

        const updatedCategory = await serviceDeskService.updateCategory(categoryId as string, {
            name,
            description,
            icon,
            colorClass,
            displayOrder: displayOrder !== undefined ? parseInt(displayOrder as string) : undefined,
            isActive,
        });

        await auditLog(req, 'ADMIN_UPDATE_CATEGORY', 'Category', updatedCategory.id, {
            name: updatedCategory.name,
            displayOrder: updatedCategory.displayOrder,
            isActive: updatedCategory.isActive,
        });

        res.json({
            status: 'success',
            data: { category: updatedCategory },
        });
    });

    deleteCategory = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { categoryId } = req.params;

        await serviceDeskService.deleteCategory(categoryId as string);

        await auditLog(req, 'ADMIN_DELETE_CATEGORY', 'Category', categoryId as string, {
            deactivated: true,
        });

        res.json({
            status: 'success',
            message: 'Category deleted successfully',
        });
    });

    // --- Request Type Management Methods ---

    createRequestType = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { categoryId, name, description, icon, requiresApproval, slaHours, formConfig, requiredRole, ownerId, lifecycleStatus, reviewDate } = req.body;

        const requestType = await serviceDeskService.createRequestType({
            serviceCategoryId: categoryId,
            name,
            description,
            icon,
            requiresApproval: !!requiresApproval,
            slaHours: parseInt(slaHours as string) || null,
            formConfig: formConfig || [],
            requiredRole: requiredRole || null,
            ownerId: ownerId || null,
            lifecycleStatus: lifecycleStatus || 'DRAFT',
            reviewDate: reviewDate ? new Date(reviewDate) : null,
        });

        await auditLog(req, 'ADMIN_CREATE_REQUEST_TYPE', 'RequestType', requestType.id, {
            name: requestType.name,
            serviceCategoryId: requestType.serviceCategoryId,
            requiresApproval: requestType.requiresApproval,
        });

        res.status(201).json({
            status: 'success',
            data: { requestType },
        });
    });

    updateRequestType = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { typeId } = req.params;
        const { name, description, icon, requiresApproval, slaHours, formConfig, isActive, requiredRole, workflowTypeId, ownerId, lifecycleStatus, reviewDate } = req.body;

        const requestType = await serviceDeskService.updateRequestType(typeId as string, {
            name,
            description,
            icon,
            requiresApproval: requiresApproval !== undefined ? !!requiresApproval : undefined,
            slaHours: slaHours !== undefined ? (parseInt(slaHours as string) || null) : undefined,
            formConfig,
            isActive,
            requiredRole: requiredRole !== undefined ? (requiredRole || null) : undefined,
            workflowTypeId: workflowTypeId !== undefined ? (workflowTypeId || null) : undefined,
            ownerId: ownerId !== undefined ? (ownerId || null) : undefined,
            lifecycleStatus,
            reviewDate: reviewDate !== undefined ? (reviewDate ? new Date(reviewDate) : null) : undefined,
        });

        await auditLog(req, 'ADMIN_UPDATE_REQUEST_TYPE', 'RequestType', requestType.id, {
            name: requestType.name,
            isActive: requestType.isActive,
            requiresApproval: requestType.requiresApproval,
        });

        res.json({
            status: 'success',
            data: { requestType },
        });
    });

    deleteRequestType = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { typeId } = req.params;

        await serviceDeskService.deleteRequestType(typeId as string);

        await auditLog(req, 'ADMIN_DELETE_REQUEST_TYPE', 'RequestType', typeId as string, {
            deactivated: true,
        });

        res.json({
            status: 'success',
            message: 'Request type deleted successfully',
        });
    });

    /**
     * Get eligible agents for a service desk's auto-assign team
     * GET /api/v1/service-desks/:id/agents
     */
    getTeamAgents = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id);
        const serviceDesk = await serviceDeskService.getServiceDeskById(id);

        if (!serviceDesk) {
            return res.status(404).json({ status: 'error', message: 'Service desk not found' });
        }

        const team = serviceDesk.autoAssignTeam || 'NONE';
        if (team === 'NONE') {
            return res.json({ status: 'success', data: { agents: [], team: 'NONE' } });
        }

        // Find all active agents with matching agentTeam
        const agents = await prisma.user.findMany({
            where: {
                agentTeam: team,
                isActive: true,
                roles: { some: { role: { name: { in: ['AGENT', 'ADMIN'] } } } },
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                agentTeam: true,
                avatarUrl: true,
            },
            orderBy: { createdAt: 'asc' },
        });

        // Count open requests per agent (non-terminal statuses)
        const TERMINAL_STATUSES = ['RESOLVED', 'COMPLETED', 'CANCELLED'];
        const agentIds = agents.map((a) => a.id);

        const openCountRows: { assigned_to_id: string; count: bigint }[] =
            await prisma.$queryRaw`
                SELECT assigned_to_id, COUNT(*)::bigint as count
                FROM requests
                WHERE assigned_to_id = ANY(${agentIds}::uuid[])
                  AND status::text != ALL(${TERMINAL_STATUSES}::text[])
                GROUP BY assigned_to_id
            `;

        const countMap = new Map<string, number>();
        for (const row of openCountRows) {
            countMap.set(row.assigned_to_id, Number(row.count));
        }

        const result = agents.map((a) => ({
            id: a.id,
            firstName: a.firstName,
            lastName: a.lastName,
            email: a.email,
            avatarUrl: a.avatarUrl,
            agentTeam: a.agentTeam,
            openRequestCount: countMap.get(a.id) || 0,
        }));

        res.json({
            status: 'success',
            data: {
                team,
                assignmentStrategy: serviceDesk.assignmentStrategy,
                lastAssignedIndex: serviceDesk.lastAssignedIndex,
                agents: result,
            },
        });
    });
}

export const serviceDeskController = new ServiceDeskController();