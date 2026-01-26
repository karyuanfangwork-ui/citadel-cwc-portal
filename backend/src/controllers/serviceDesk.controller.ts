import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

class ServiceDeskController {
    getAllServiceDesks = asyncHandler(async (_req: AuthRequest, res: Response) => {
        const serviceDesks = await prisma.serviceDesk.findMany({
            where: { isActive: true },
            include: {
                categories: {
                    where: { isActive: true },
                    orderBy: { displayOrder: 'asc' },
                },
            },
        });

        res.json({
            status: 'success',
            data: { serviceDesks },
        });
    });

    getServiceDeskById = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;

        const serviceDesk = await prisma.serviceDesk.findUnique({
            where: { id: id as string },
            include: {
                categories: {
                    where: { isActive: true },
                    orderBy: { displayOrder: 'asc' },
                },
            },
        });

        if (!serviceDesk) {
            throw new AppError('Service desk not found', 404);
        }

        res.json({
            status: 'success',
            data: { serviceDesk },
        });
    });

    getCategories = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;

        const categories = await prisma.serviceCategory.findMany({
            where: {
                serviceDeskId: id as string,
                isActive: true,
            },
            orderBy: { displayOrder: 'asc' },
        });

        res.json({
            status: 'success',
            data: { categories },
        });
    });

    getRequestTypes = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params; // serviceDeskId
        const { categoryId } = req.query;

        const where: any = {
            serviceCategory: {
                serviceDeskId: id,
            },
            isActive: true,
        };

        if (categoryId) {
            where.serviceCategoryId = categoryId as string;
        }

        const requestTypes = await prisma.requestType.findMany({
            where,
            include: {
                serviceCategory: true,
            },
        });

        res.json({
            status: 'success',
            data: { requestTypes },
        });
    });

    createServiceDesk = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { name, code, description } = req.body;

        const serviceDesk = await prisma.serviceDesk.create({
            data: { name, code, description },
        });

        res.status(201).json({
            status: 'success',
            data: { serviceDesk },
        });
    });

    updateServiceDesk = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const { name, code, description, isActive } = req.body;

        const serviceDesk = await prisma.serviceDesk.update({
            where: { id },
            data: { name, code, description, isActive },
        });

        res.json({
            status: 'success',
            data: { serviceDesk },
        });
    });

    deleteServiceDesk = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;

        await prisma.serviceDesk.update({
            where: { id },
            data: { isActive: false },
        });

        res.json({
            status: 'success',
            message: 'Service desk deleted successfully',
        });
    });

    // --- Category Management Methods ---

    createCategory = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params; // serviceDeskId
        const { name, description, icon, colorClass, displayOrder } = req.body;

        const category = await prisma.serviceCategory.create({
            data: {
                serviceDeskId: id as string,
                name,
                description,
                icon,
                colorClass,
                displayOrder: parseInt(displayOrder as string) || 0,
                isActive: true
            }
        });

        res.status(201).json({
            status: 'success',
            data: { category }
        });
    });

    updateCategory = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { categoryId } = req.params;
        const { name, description, icon, colorClass, displayOrder, isActive } = req.body;

        // If displayOrder is being updated, check for conflicts
        if (displayOrder !== undefined) {
            const category = await prisma.serviceCategory.findUnique({
                where: { id: categoryId as string },
                select: { serviceDeskId: true, displayOrder: true }
            });

            if (category) {
                const newOrder = parseInt(displayOrder as string);

                // If the order is changing, adjust other categories
                if (category.displayOrder !== newOrder) {
                    // Find if another category has this displayOrder
                    const conflicting = await prisma.serviceCategory.findFirst({
                        where: {
                            serviceDeskId: category.serviceDeskId,
                            displayOrder: newOrder,
                            id: { not: categoryId as string }
                        }
                    });

                    // If there's a conflict, swap the orders
                    if (conflicting) {
                        await prisma.serviceCategory.update({
                            where: { id: conflicting.id },
                            data: { displayOrder: category.displayOrder }
                        });
                    }
                }
            }
        }

        const updatedCategory = await prisma.serviceCategory.update({
            where: { id: categoryId as string },
            data: {
                name,
                description,
                icon,
                colorClass,
                displayOrder: displayOrder !== undefined ? parseInt(displayOrder as string) : undefined,
                isActive
            }
        });

        res.json({
            status: 'success',
            data: { category: updatedCategory }
        });
    });

    deleteCategory = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { categoryId } = req.params;

        await prisma.serviceCategory.update({
            where: { id: categoryId as string },
            data: { isActive: false }
        });

        res.json({
            status: 'success',
            message: 'Category deleted successfully'
        });
    });

    // --- Request Type Management Methods ---

    getRequestTypeById = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { typeId } = req.params;

        const requestType = await prisma.requestType.findUnique({
            where: { id: typeId as string },
            include: {
                serviceCategory: true,
            },
        });

        if (!requestType) {
            throw new AppError('Request type not found', 404);
        }

        res.json({
            status: 'success',
            data: { requestType },
        });
    });

    createRequestType = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { categoryId } = req.body;
        const { name, description, icon, requiresApproval, slaHours, formConfig } = req.body;

        const requestType = await prisma.requestType.create({
            data: {
                serviceCategoryId: categoryId,
                name,
                description,
                icon,
                requiresApproval: !!requiresApproval,
                slaHours: parseInt(slaHours as string) || null,
                formConfig: formConfig || [],
                isActive: true
            }
        });

        res.status(201).json({
            status: 'success',
            data: { requestType }
        });
    });

    updateRequestType = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { typeId } = req.params;
        const { name, description, icon, requiresApproval, slaHours, formConfig, isActive } = req.body;

        const requestType = await prisma.requestType.update({
            where: { id: typeId as string },
            data: {
                name,
                description,
                icon,
                requiresApproval: requiresApproval !== undefined ? !!requiresApproval : undefined,
                slaHours: slaHours !== undefined ? (parseInt(slaHours as string) || null) : undefined,
                formConfig,
                isActive
            }
        });

        res.json({
            status: 'success',
            data: { requestType }
        });
    });

    deleteRequestType = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { typeId } = req.params;

        await prisma.requestType.update({
            where: { id: typeId as string },
            data: { isActive: false }
        });

        res.json({
            status: 'success',
            message: 'Request type deleted successfully'
        });
    });
}

export const serviceDeskController = new ServiceDeskController();
