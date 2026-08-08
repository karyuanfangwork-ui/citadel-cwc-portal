import prisma from '../utils/prisma';
import { AppError } from '../middleware/error.middleware';
import { validateConditionalRules } from './conditionalRules.service';

class ServiceDeskService {
    async getAllServiceDesks() {
        return prisma.serviceDesk.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
            include: {
                autoAssignUser: {
                    select: { id: true, firstName: true, lastName: true, email: true, agentTeam: true, isActive: true },
                },
                categories: {
                    where: { isActive: true },
                    orderBy: { displayOrder: 'asc' },
                },
            },
        });
    }

    // P2-01: Admin endpoint — returns both active and inactive desks for restoration
    async getAllServiceDesksAdmin() {
        return prisma.serviceDesk.findMany({
            orderBy: { createdAt: 'asc' },
            include: {
                autoAssignUser: {
                    select: { id: true, firstName: true, lastName: true, email: true, agentTeam: true, isActive: true },
                },
                categories: {
                    orderBy: { displayOrder: 'asc' },
                },
            },
        });
    }

    async getServiceDeskById(id: string) {
        const serviceDesk = await prisma.serviceDesk.findUnique({
            where: { id, isActive: true },
            include: {
                autoAssignUser: {
                    select: { id: true, firstName: true, lastName: true, email: true, agentTeam: true, isActive: true },
                },
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
        autoAssignUserId?: string | null;
    }) {
        return prisma.serviceDesk.create({
            data: {
                name: data.name,
                code: data.code,
                description: data.description,
                autoAssignTeam: data.autoAssignTeam || 'NONE',
                assignmentStrategy: data.assignmentStrategy || 'ROUND_ROBIN',
                autoAssignUserId: data.autoAssignUserId ?? null,
            },
        });
    }

    async updateServiceDesk(id: string, data: {
        name?: string; description?: string; isActive?: boolean;
        autoAssignTeam?: string; assignmentStrategy?: string; lastAssignedIndex?: number;
        autoAssignUserId?: string | null;
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
                ...(data.autoAssignUserId !== undefined && { autoAssignUserId: data.autoAssignUserId }),
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
        await this.requireServiceDesk(deskId);
        return prisma.serviceCategory.findMany({
            where: { serviceDeskId: deskId },
            orderBy: { displayOrder: 'asc' },
            include: {
                _count: { select: { requestTypes: true } },
            },
        });
    }

    async createCategory(deskId: string, data: { name: string; description?: string; icon?: string; colorClass?: string; displayOrder?: number }) {
        await this.requireServiceDesk(deskId);
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

    async updateCategory(deskId: string, categoryId: string, data: { name?: string; description?: string; icon?: string; colorClass?: string; displayOrder?: number; isActive?: boolean }) {
        const category = await this.requireCategory(deskId, categoryId);
        // If displayOrder is being updated, handle the swap atomically
        if (data.displayOrder !== undefined) {
            if (category.displayOrder !== data.displayOrder) {
                // P2-05: Use transaction to prevent race conditions during reorder
                await prisma.$transaction(async (tx) => {
                    const conflicting = await tx.serviceCategory.findFirst({
                        where: {
                            serviceDeskId: category.serviceDeskId,
                            displayOrder: data.displayOrder,
                            id: { not: categoryId },
                        },
                    });

                    if (conflicting) {
                        await tx.serviceCategory.update({
                            where: { id: conflicting.id },
                            data: { displayOrder: category.displayOrder },
                        });
                    }

                    await tx.serviceCategory.update({
                        where: { id: categoryId },
                        data: { displayOrder: data.displayOrder },
                    });
                });

                // Return the updated category (outside transaction for read-only)
                if (!data.name && !data.description && !data.icon && !data.colorClass && data.isActive === undefined) {
                    // This was a reorder-only call — return the category
                    return prisma.serviceCategory.findUnique({ where: { id: categoryId } });
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

    async deleteCategory(deskId: string, categoryId: string) {
        await this.requireCategory(deskId, categoryId);
        await prisma.serviceCategory.update({
            where: { id: categoryId },
            data: { isActive: false },
        });
    }

    async reorderCategories(deskId: string, categoryIds: string[]) {
        await this.requireServiceDesk(deskId);
        if (categoryIds.length === 0 || new Set(categoryIds).size !== categoryIds.length) {
            throw new AppError('Category IDs must be unique and non-empty', 400);
        }

        const categories = await prisma.serviceCategory.findMany({
            where: { serviceDeskId: deskId, id: { in: categoryIds } },
            select: { id: true },
        });
        if (categories.length !== categoryIds.length) {
            throw new AppError('All category IDs must belong to the selected service desk', 400);
        }

        return prisma.$transaction(async (tx) => {
            await tx.serviceCategory.updateMany({
                where: { serviceDeskId: deskId, id: { in: categoryIds } },
                data: { displayOrder: { increment: categoryIds.length } },
            });
            await Promise.all(categoryIds.map((id, index) => tx.serviceCategory.update({
                where: { id },
                data: { displayOrder: index },
            })));
            return tx.serviceCategory.findMany({
                where: { serviceDeskId: deskId },
                orderBy: { displayOrder: 'asc' },
            });
        });
    }

    private async requireServiceDesk(deskId: string) {
        const desk = await prisma.serviceDesk.findUnique({ where: { id: deskId } });
        if (!desk) throw new AppError('Service desk not found', 404);
        return desk;
    }

    private async requireCategory(deskId: string, categoryId: string) {
        const category = await prisma.serviceCategory.findUnique({
            where: { id: categoryId },
            select: { id: true, serviceDeskId: true, displayOrder: true, name: true, isActive: true },
        });
        if (!category || category.serviceDeskId !== deskId) {
            throw new AppError('Category not found for the selected service desk', 404);
        }
        return category;
    }

    async getRequestTypes(deskId: string, categoryId?: string) {
        const where: any = {
            serviceCategory: {
                serviceDeskId: deskId,
            },
            isActive: true,
            lifecycleStatus: 'PUBLISHED', // P5-01: Portal only shows published catalog items
        };

        if (categoryId) {
            where.serviceCategoryId = categoryId;
        }

        return prisma.requestType.findMany({
            where,
            include: {
                serviceCategory: true,
                owner: { select: { id: true, firstName: true, lastName: true, email: true } }, // P5-01
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
                owner: { select: { id: true, firstName: true, lastName: true, email: true } }, // P5-01
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
                owner: { select: { id: true, firstName: true, lastName: true, email: true } }, // P5-01
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
        ownerId?: string | null;
        lifecycleStatus?: string;
        reviewDate?: Date | null;
    }) {
        this.assertValidFormConfig(data.formConfig || []);
        return prisma.requestType.create({
            data: {
                serviceCategoryId: data.serviceCategoryId,
                name: data.name,
                description: data.description,
                icon: data.icon,
                requiresApproval: !!data.requiresApproval,
                slaHours: data.slaHours ?? null,
                formConfig: data.formConfig || [],
                formConfigVersion: 1, // P5-04: initial version
                requiredRole: data.requiredRole || null,
                isActive: true,
                ownerId: data.ownerId || null,
                lifecycleStatus: (data.lifecycleStatus as any) || 'DRAFT',
                reviewDate: data.reviewDate ?? null,
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
        ownerId?: string | null;
        lifecycleStatus?: string;
        reviewDate?: Date | null;
    }) {
        if (data.formConfig !== undefined) {
            this.assertValidFormConfig(data.formConfig);
        }
        // P5-04: If formConfig is being updated, increment the version
        const updateData: any = {
            name: data.name,
            description: data.description,
            icon: data.icon,
            requiresApproval: data.requiresApproval !== undefined ? !!data.requiresApproval : undefined,
            slaHours: data.slaHours !== undefined ? (data.slaHours ?? null) : undefined,
            formConfig: data.formConfig,
            isActive: data.isActive,
            requiredRole: data.requiredRole !== undefined ? (data.requiredRole || null) : undefined,
            workflowTypeId: data.workflowTypeId !== undefined ? (data.workflowTypeId || null) : undefined,
            ownerId: data.ownerId !== undefined ? (data.ownerId || null) : undefined,
            lifecycleStatus: data.lifecycleStatus as any,
            reviewDate: data.reviewDate !== undefined ? (data.reviewDate ?? null) : undefined,
        };
        if (data.formConfig !== undefined) {
            updateData.formConfigVersion = { increment: 1 };
        }
        return prisma.requestType.update({
            where: { id: typeId },
            data: updateData,
        });
    }

    async deleteRequestType(typeId: string) {
        await prisma.requestType.update({
            where: { id: typeId },
            data: { isActive: false },
        });
    }

    // P2-04: Deactivation impact preview — returns counts of dependent records
    async getDeskDeactivationImpact(deskId: string) {
        const desk = await prisma.serviceDesk.findUnique({ where: { id: deskId } });
        if (!desk) throw new AppError('Service desk not found', 404);

        const [categories, requests, entitlements, escalationRules, workflowTypes] = await Promise.all([
            prisma.serviceCategory.count({ where: { serviceDeskId: deskId } }),
            prisma.request.count({ where: { serviceDeskId: deskId } }),
            prisma.catalogEntitlement.count({
                where: { requestType: { serviceCategory: { serviceDeskId: deskId } } },
            }),
            prisma.escalationRule.count({
                where: { requestType: { serviceCategory: { serviceDeskId: deskId } } },
            }),
            prisma.requestType.count({
                where: { serviceCategory: { serviceDeskId: deskId }, workflowTypeId: { not: null } },
            }),
        ]);

        const activeCategories = await prisma.serviceCategory.count({ where: { serviceDeskId: deskId, isActive: true } });
        const publishedTypes = await prisma.requestType.count({
            where: { serviceCategory: { serviceDeskId: deskId }, lifecycleStatus: 'PUBLISHED' },
        });
        const draftTypes = await prisma.requestType.count({
            where: { serviceCategory: { serviceDeskId: deskId }, lifecycleStatus: 'DRAFT' },
        });

        return {
            deskId,
            deskName: desk.name,
            isActive: desk.isActive,
            categories,
            activeCategories,
            publishedTypes,
            draftTypes,
            existingRequests: requests,
            entitlements,
            escalationRules,
            workflowTypes,
        };
    }

    async getCategoryDeactivationImpact(deskId: string, categoryId: string) {
        const category = await this.requireCategory(deskId, categoryId);

        const [requestTypes, publishedTypes, draftTypes, entitlements, escalationRules, workflowTypes] = await Promise.all([
            prisma.requestType.count({ where: { serviceCategoryId: categoryId } }),
            prisma.requestType.count({ where: { serviceCategoryId: categoryId, lifecycleStatus: 'PUBLISHED' } }),
            prisma.requestType.count({ where: { serviceCategoryId: categoryId, lifecycleStatus: 'DRAFT' } }),
            prisma.catalogEntitlement.count({ where: { requestType: { serviceCategoryId: categoryId } } }),
            prisma.escalationRule.count({ where: { requestType: { serviceCategoryId: categoryId } } }),
            prisma.requestType.count({ where: { serviceCategoryId: categoryId, workflowTypeId: { not: null } } }),
        ]);

        const existingRequests = await prisma.request.count({
            where: { requestType: { serviceCategoryId: categoryId } },
        });

        return {
            categoryId,
            categoryName: category.name,
            isActive: category.isActive,
            requestTypes,
            publishedTypes,
            draftTypes,
            existingRequests,
            entitlements,
            escalationRules,
            workflowTypes,
        };
    }

    async getRequestTypeDeactivationImpact(typeId: string) {
        const requestType = await prisma.requestType.findUnique({ where: { id: typeId } });
        if (!requestType) throw new AppError('Request type not found', 404);

        const [existingRequests, entitlements, escalationRules] = await Promise.all([
            prisma.request.count({ where: { requestTypeId: typeId } }),
            prisma.catalogEntitlement.count({ where: { requestTypeId: typeId } }),
            prisma.escalationRule.count({ where: { requestTypeId: typeId } }),
        ]);

        return {
            typeId,
            typeName: requestType.name,
            isActive: requestType.isActive,
            lifecycleStatus: requestType.lifecycleStatus,
            existingRequests,
            entitlements,
            escalationRules,
            hasWorkflow: !!requestType.workflowTypeId,
            slaHours: requestType.slaHours,
        };
    }

    private assertValidFormConfig(formConfig: unknown) {
        const result = validateConditionalRules(formConfig as any[]);
        if (!result.isValid) {
            throw new AppError(`Invalid form configuration: ${result.errors.slice(0, 3).join(' ')}`, 400);
        }
    }
}

export const serviceDeskService = new ServiceDeskService();
export default serviceDeskService;