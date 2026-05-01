import { Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { auditLog } from '../utils/audit';
import serviceDeskService from '../services/serviceDesk.service';

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
        const { name, code, description } = req.body;

        const serviceDesk = await serviceDeskService.createServiceDesk({ name, code, description });

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
        const { name, code, description, isActive } = req.body;

        const serviceDesk = await serviceDeskService.updateServiceDesk(id, { name, code, description, isActive });

        await auditLog(req, 'ADMIN_UPDATE_SERVICE_DESK', 'ServiceDesk', serviceDesk.id, {
            name: serviceDesk.name,
            code: serviceDesk.code,
            isActive: serviceDesk.isActive,
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
        const { categoryId, name, description, icon, requiresApproval, slaHours, formConfig, requiredRole } = req.body;

        const requestType = await serviceDeskService.createRequestType({
            serviceCategoryId: categoryId,
            name,
            description,
            icon,
            requiresApproval: !!requiresApproval,
            slaHours: parseInt(slaHours as string) || null,
            formConfig: formConfig || [],
            requiredRole: requiredRole || null,
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
        const { name, description, icon, requiresApproval, slaHours, formConfig, isActive, requiredRole, workflowTypeId } = req.body;

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
}

export const serviceDeskController = new ServiceDeskController();