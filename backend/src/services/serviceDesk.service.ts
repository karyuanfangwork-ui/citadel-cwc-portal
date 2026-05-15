import prisma from '../utils/prisma';
import { AppError } from '../middleware/error.middleware';

class ServiceDeskService {
    async getAllServiceDesks() {
        return prisma.serviceDesk.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
            include: {
                categories: {
                    where: { isActive: true },
                    orderBy: { displayOrder: 'asc' },
                },
            },
        });
    }

    async getServiceDeskById(id: string) {
        const serviceDesk = await prisma.serviceDesk.findUnique({
            where: { id },
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

        return serviceDesk;
    }

    async createServiceDesk(data: {
        name: string; code: string; description?: string;
        autoAssignTeam?: string; assignmentStrategy?: string;
    }) {
        return prisma.serviceDesk.create({
            data: {
                name: data.name,
                code: data.code,
                description: data.description,
                autoAssignTeam: data.autoAssignTeam || 'NONE',
                assignmentStrategy: data.assignmentStrategy || 'ROUND_ROBIN',
            },
        });
    }

    async updateServiceDesk(id: string, data: {
        name?: string; description?: string; isActive?: boolean;
        autoAssignTeam?: string; assignmentStrategy?: string; lastAssignedIndex?: number;
    }) {
        return prisma.serviceDesk.update({
            where: { id },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
                ...(data.autoAssignTeam !== undefined && { autoAssignTeam: data.autoAssignTeam }),
                ...(data.assignmentStrategy !== undefined && { assignmentStrategy: data.assignmentStrategy }),
                ...(data.lastAssignedIndex !== undefined && { lastAssignedIndex: data.lastAssignedIndex }),
            },
        });
    }

    async deleteServiceDesk(id: string) {
        await prisma.serviceDesk.update({
            where: { id },
            data: { isActive: false },
        });
    }

    async getCategories(deskId: string) {
        return prisma.serviceCategory.findMany({
            where: {
                serviceDeskId: deskId,
                isActive: true,
            },
            orderBy: { displayOrder: 'asc' },
        });
    }

    async getAllCategoriesAdmin(deskId: string) {
        return prisma.serviceCategory.findMany({
            where: { serviceDeskId: deskId },
            orderBy: { displayOrder: 'asc' },
            include: {
                _count: { select: { requestTypes: true } },
            },
        });
    }

    async createCategory(deskId: string, data: { name: string; description?: string; icon?: string; colorClass?: string; displayOrder?: number }) {
        return prisma.serviceCategory.create({
            data: {
                serviceDeskId: deskId,
                name: data.name,
                description: data.description,
                icon: data.icon,
                colorClass: data.colorClass,
                displayOrder: data.displayOrder ?? 0,
                isActive: true,
            },
        });
    }

    async updateCategory(categoryId: string, data: { name?: string; description?: string; icon?: string; colorClass?: string; displayOrder?: number; isActive?: boolean }) {
        // If displayOrder is being updated, check for conflicts
        if (data.displayOrder !== undefined) {
            const category = await prisma.serviceCategory.findUnique({
                where: { id: categoryId },
                select: { serviceDeskId: true, displayOrder: true },
            });

            if (category) {
                const newOrder = data.displayOrder!;

                // If the order is changing, adjust other categories
                if (category.displayOrder !== newOrder) {
                    // Find if another category has this displayOrder
                    const conflicting = await prisma.serviceCategory.findFirst({
                        where: {
                            serviceDeskId: category.serviceDeskId,
                            displayOrder: newOrder,
                            id: { not: categoryId },
                        },
                    });

                    // If there's a conflict, swap the orders
                    if (conflicting) {
                        await prisma.serviceCategory.update({
                            where: { id: conflicting.id },
                            data: { displayOrder: category.displayOrder },
                        });
                    }
                }
            }
        }

        return prisma.serviceCategory.update({
            where: { id: categoryId },
            data: {
                name: data.name,
                description: data.description,
                icon: data.icon,
                colorClass: data.colorClass,
                displayOrder: data.displayOrder,
                isActive: data.isActive,
            },
        });
    }

    async deleteCategory(categoryId: string) {
        await prisma.serviceCategory.update({
            where: { id: categoryId },
            data: { isActive: false },
        });
    }

    async getRequestTypes(deskId: string, categoryId?: string) {
        const where: any = {
            serviceCategory: {
                serviceDeskId: deskId,
            },
            isActive: true,
        };

        if (categoryId) {
            where.serviceCategoryId = categoryId;
        }

        return prisma.requestType.findMany({
            where,
            include: {
                serviceCategory: true,
                workflow: {
                    include: {
                        steps: {
                            orderBy: { displayOrder: 'asc' },
                        },
                    },
                },
            },
        });
    }

    async getAllRequestTypesAdmin(deskId: string, categoryId?: string) {
        const where: any = {
            serviceCategory: {
                serviceDeskId: deskId,
            },
        };

        if (categoryId) {
            where.serviceCategoryId = categoryId;
        }

        return prisma.requestType.findMany({
            where,
            include: {
                serviceCategory: true,
                workflow: {
                    include: {
                        steps: {
                            orderBy: { displayOrder: 'asc' },
                        },
                    },
                },
            },
        });
    }

    async getRequestTypeById(typeId: string) {
        const requestType = await prisma.requestType.findUnique({
            where: { id: typeId },
            include: {
                serviceCategory: true,
            },
        });

        if (!requestType) {
            throw new AppError('Request type not found', 404);
        }

        return requestType;
    }

    async createRequestType(data: {
        serviceCategoryId: string;
        name: string;
        description?: string;
        icon?: string;
        requiresApproval?: boolean;
        slaHours?: number | null;
        formConfig?: any;
        requiredRole?: string | null;
    }) {
        return prisma.requestType.create({
            data: {
                serviceCategoryId: data.serviceCategoryId,
                name: data.name,
                description: data.description,
                icon: data.icon,
                requiresApproval: !!data.requiresApproval,
                slaHours: data.slaHours ?? null,
                formConfig: data.formConfig || [],
                requiredRole: data.requiredRole || null,
                isActive: true,
            },
        });
    }

    async updateRequestType(typeId: string, data: {
        name?: string;
        description?: string;
        icon?: string;
        requiresApproval?: boolean;
        slaHours?: number | null;
        formConfig?: any;
        isActive?: boolean;
        requiredRole?: string | null;
        workflowTypeId?: string | null;
    }) {
        return prisma.requestType.update({
            where: { id: typeId },
            data: {
                name: data.name,
                description: data.description,
                icon: data.icon,
                requiresApproval: data.requiresApproval !== undefined ? !!data.requiresApproval : undefined,
                slaHours: data.slaHours !== undefined ? (data.slaHours ?? null) : undefined,
                formConfig: data.formConfig,
                isActive: data.isActive,
                requiredRole: data.requiredRole !== undefined ? (data.requiredRole || null) : undefined,
                workflowTypeId: data.workflowTypeId !== undefined ? (data.workflowTypeId || null) : undefined,
            },
        });
    }

    async deleteRequestType(typeId: string) {
        await prisma.requestType.update({
            where: { id: typeId },
            data: { isActive: false },
        });
    }
}

export const serviceDeskService = new ServiceDeskService();
export default serviceDeskService;