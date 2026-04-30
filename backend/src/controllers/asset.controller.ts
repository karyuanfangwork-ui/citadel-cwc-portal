import { Response } from 'express';
import { PrismaClient, AssetStatus } from '@prisma/client';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

class AssetController {
    /**
     * GET /assets
     * List assets with filtering by status, category, assignedTo, and search.
     * Paginated. Includes current (open) assignment.
     */
    listAssets = asyncHandler(async (req: AuthRequest, res: Response) => {
        const {
            page = '1',
            limit = '10',
            status,
            category,
            assignedTo,
            search,
        } = req.query;

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {};

        if (status) {
            where.status = status;
        }

        if (category) {
            where.category = category;
        }

        if (assignedTo) {
            where.assignments = {
                some: {
                    userId: assignedTo as string,
                    returnedAt: null,
                },
            };
        }

        if (search) {
            const term = search as string;
            where.OR = [
                { name: { contains: term, mode: 'insensitive' } },
                { assetTag: { contains: term, mode: 'insensitive' } },
                { serialNumber: { contains: term, mode: 'insensitive' } },
            ];
        }

        const [assets, total] = await Promise.all([
            prisma.asset.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
                include: {
                    createdBy: {
                        select: { id: true, firstName: true, lastName: true, email: true },
                    },
                    assignments: {
                        where: { returnedAt: null },
                        take: 1,
                        include: {
                            user: {
                                select: { id: true, firstName: true, lastName: true, email: true },
                            },
                            assignedBy: {
                                select: { id: true, firstName: true, lastName: true },
                            },
                        },
                    },
                },
            }),
            prisma.asset.count({ where }),
        ]);

        res.json({
            status: 'success',
            data: {
                assets,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                },
            },
        });
    });

    /**
     * GET /assets/:id
     * Full detail with sourceRequest and all assignments ordered desc.
     */
    getAsset = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id);

        const asset = await prisma.asset.findUnique({
            where: { id },
            include: {
                sourceRequest: true,
                createdBy: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
                assignments: {
                    orderBy: { assignedAt: 'desc' },
                    include: {
                        user: {
                            select: { id: true, firstName: true, lastName: true, email: true },
                        },
                        assignedBy: {
                            select: { id: true, firstName: true, lastName: true },
                        },
                        linkedRequest: {
                            select: { id: true, summary: true },
                        },
                    },
                },
            },
        });

        if (!asset) {
            throw new AppError('Asset not found', 404);
        }

        res.json({
            status: 'success',
            data: { asset },
        });
    });

    /**
     * POST /assets
     * Create a new asset. assetTag, name, and category are required.
     * Checks for duplicate assetTag / serialNumber.
     */
    createAsset = asyncHandler(async (req: AuthRequest, res: Response) => {
        const {
            assetTag,
            serialNumber,
            name,
            category,
            brand,
            model,
            purchaseDate,
            purchasePrice,
            vendor,
            warrantyExpiry,
            status,
            notes,
            sourceRequestId,
        } = req.body;

        // Validate required fields
        if (!assetTag || !name || !category) {
            throw new AppError('assetTag, name, and category are required', 400);
        }

        // Check duplicate assetTag
        const existingByTag = await prisma.asset.findUnique({ where: { assetTag } });
        if (existingByTag) {
            throw new AppError(`Asset with assetTag "${assetTag}" already exists`, 409);
        }

        // Check duplicate serialNumber if provided
        if (serialNumber) {
            const existingBySerial = await prisma.asset.findUnique({ where: { serialNumber } });
            if (existingBySerial) {
                throw new AppError(`Asset with serialNumber "${serialNumber}" already exists`, 409);
            }
        }

        const asset = await prisma.asset.create({
            data: {
                assetTag,
                serialNumber: serialNumber || null,
                name,
                category,
                brand: brand || null,
                model: model || null,
                purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
                purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
                vendor: vendor || null,
                warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
                status: status || AssetStatus.IN_STOCK,
                notes: notes || null,
                sourceRequestId: sourceRequestId || null,
                createdById: req.user!.id,
            },
            include: {
                createdBy: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
        });

        res.status(201).json({
            status: 'success',
            data: { asset },
        });
    });

    /**
     * PATCH /assets/:id
     * Partial update with spread pattern.
     */
    updateAsset = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id);

        const existing = await prisma.asset.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError('Asset not found', 404);
        }

        // Check duplicate assetTag if being changed
        if (req.body.assetTag && req.body.assetTag !== existing.assetTag) {
            const duplicate = await prisma.asset.findUnique({ where: { assetTag: req.body.assetTag } });
            if (duplicate) {
                throw new AppError(`Asset with assetTag "${req.body.assetTag}" already exists`, 409);
            }
        }

        // Check duplicate serialNumber if being changed
        if (req.body.serialNumber && req.body.serialNumber !== existing.serialNumber) {
            const duplicate = await prisma.asset.findUnique({ where: { serialNumber: req.body.serialNumber } });
            if (duplicate) {
                throw new AppError(`Asset with serialNumber "${req.body.serialNumber}" already exists`, 409);
            }
        }

        const {
            assetTag,
            serialNumber,
            name,
            category,
            brand,
            model,
            purchaseDate,
            purchasePrice,
            vendor,
            warrantyExpiry,
            status,
            notes,
            sourceRequestId,
        } = req.body;

        const data: any = {};

        if (assetTag !== undefined) data.assetTag = assetTag;
        if (serialNumber !== undefined) data.serialNumber = serialNumber;
        if (name !== undefined) data.name = name;
        if (category !== undefined) data.category = category;
        if (brand !== undefined) data.brand = brand;
        if (model !== undefined) data.model = model;
        if (purchaseDate !== undefined) data.purchaseDate = purchaseDate ? new Date(purchaseDate) : null;
        if (purchasePrice !== undefined) data.purchasePrice = purchasePrice ? parseFloat(purchasePrice) : null;
        if (vendor !== undefined) data.vendor = vendor;
        if (warrantyExpiry !== undefined) data.warrantyExpiry = warrantyExpiry ? new Date(warrantyExpiry) : null;
        if (status !== undefined) data.status = status;
        if (notes !== undefined) data.notes = notes;
        if (sourceRequestId !== undefined) data.sourceRequestId = sourceRequestId;

        const asset = await prisma.asset.update({
            where: { id },
            data,
            include: {
                createdBy: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
        });

        res.json({
            status: 'success',
            data: { asset },
        });
    });

    /**
     * DELETE /assets/:id
     * Soft-delete by setting status=DISPOSED.
     */
    deleteAsset = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id);

        const existing = await prisma.asset.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError('Asset not found', 404);
        }

        await prisma.asset.update({
            where: { id },
            data: { status: AssetStatus.DISPOSED },
        });

        res.json({
            status: 'success',
            message: 'Asset disposed successfully',
        });
    });

    /**
     * POST /assets/:id/assign
     * Validate userId, check asset is not already ASSIGNED or DISPOSED.
     * Create AssetAssignment + update asset status to ASSIGNED in a transaction.
     */
    assignAsset = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id);
        const { userId, reason, linkedRequestId, notes } = req.body;

        if (!userId) {
            throw new AppError('userId is required', 400);
        }

        // Verify user exists
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new AppError('Assigned user not found', 404);
        }

        // Verify asset exists and can be assigned
        const asset = await prisma.asset.findUnique({
            where: { id },
            include: {
                assignments: { where: { returnedAt: null } },
            },
        });

        if (!asset) {
            throw new AppError('Asset not found', 404);
        }

        if (asset.status === AssetStatus.ASSIGNED) {
            throw new AppError('Asset is already assigned', 400);
        }

        if (asset.status === AssetStatus.DISPOSED) {
            throw new AppError('Cannot assign a disposed asset', 400);
        }

        if ((asset as any).assignments.length > 0) {
            throw new AppError('Asset already has an open assignment', 400);
        }

        const result = await prisma.$transaction(async (tx) => {
            const assignment = await tx.assetAssignment.create({
                data: {
                    assetId: id,
                    userId,
                    assignedById: req.user!.id,
                    reason: reason || null,
                    linkedRequestId: linkedRequestId || null,
                    notes: notes || null,
                },
                include: {
                    user: {
                        select: { id: true, firstName: true, lastName: true, email: true },
                    },
                    assignedBy: {
                        select: { id: true, firstName: true, lastName: true },
                    },
                },
            });

            await tx.asset.update({
                where: { id },
                data: { status: AssetStatus.ASSIGNED },
            });

            return assignment;
        });

        res.status(201).json({
            status: 'success',
            data: { assignment: result },
        });
    });

    /**
     * POST /assets/:id/return
     * Find open assignment, set returnedAt, update asset status.
     * Only allows transition to IN_STOCK, IN_REPAIR, or PENDING_RETURN.
     */
    returnAsset = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id);
        const { notes, newStatus = 'IN_STOCK' } = req.body;

        const validReturnStatuses = ['IN_STOCK', 'IN_REPAIR', 'PENDING_RETURN'];
        if (!validReturnStatuses.includes(newStatus)) {
            throw new AppError(`newStatus must be one of: ${validReturnStatuses.join(', ')}`, 400);
        }

        const asset = await prisma.asset.findUnique({ where: { id } });
        if (!asset) {
            throw new AppError('Asset not found', 404);
        }

        // Find the open assignment
        const openAssignment = await prisma.assetAssignment.findFirst({
            where: { assetId: id, returnedAt: null },
        });

        if (!openAssignment) {
            throw new AppError('No active assignment found for this asset', 400);
        }

        const result = await prisma.$transaction(async (tx) => {
            const assignment = await tx.assetAssignment.update({
                where: { id: openAssignment.id },
                data: {
                    returnedAt: new Date(),
                    notes: notes !== undefined ? notes : openAssignment.notes,
                },
                include: {
                    user: {
                        select: { id: true, firstName: true, lastName: true, email: true },
                    },
                    assignedBy: {
                        select: { id: true, firstName: true, lastName: true },
                    },
                },
            });

            await tx.asset.update({
                where: { id },
                data: { status: newStatus },
            });

            return assignment;
        });

        res.json({
            status: 'success',
            data: { assignment: result },
        });
    });

    /**
     * GET /assets/by-user/:userId
     * Get a user's active assignments with asset details.
     */
    getAssetsByUser = asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = String(req.params.userId);

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new AppError('User not found', 404);
        }

        const assignments = await prisma.assetAssignment.findMany({
            where: {
                userId,
                returnedAt: null,
            },
            include: {
                asset: {
                    include: {
                        createdBy: {
                            select: { id: true, firstName: true, lastName: true, email: true },
                        },
                    },
                },
                assignedBy: {
                    select: { id: true, firstName: true, lastName: true },
                },
                linkedRequest: {
                    select: { id: true, summary: true },
                },
            },
            orderBy: { assignedAt: 'desc' },
        });

        res.json({
            status: 'success',
            data: { assignments },
        });
    });

    /**
     * POST /assets/import
     * Bulk CSV import with row validation, duplicate check, and optional assignedToEmail user lookup.
     * Expects body.csv as an array of objects (parsed CSV rows).
     * Each row: assetTag, name, category, serialNumber?, brand?, model?,
     *          purchaseDate?, purchasePrice?, vendor?, warrantyExpiry?, notes?, assignedToEmail?
     */
    importAssets = asyncHandler(async (req: AuthRequest, res: Response) => {
        const rows: Record<string, string>[] = req.body.rows;

        if (!Array.isArray(rows) || rows.length === 0) {
            throw new AppError('rows array is required', 400);
        }

        const results: { imported: number; warnings: string[]; errors: string[] } = {
            imported: 0, warnings: [], errors: [],
        };

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowLabel = `Row ${i + 2}`; // +2 because row 1 is header

            if (!row.assetTag || !row.name || !row.category) {
                results.errors.push(`${rowLabel}: assetTag, name, and category are required`);
                continue;
            }

            const duplicate = await prisma.asset.findFirst({
                where: {
                    OR: [
                        { assetTag: row.assetTag },
                        ...(row.serialNumber ? [{ serialNumber: row.serialNumber }] : []),
                    ],
                },
            });
            if (duplicate) {
                results.errors.push(`${rowLabel}: assetTag "${row.assetTag}" or serialNumber already exists — skipped`);
                continue;
            }

            let resolvedUserId: string | null = null;
            if (row.assignedToEmail) {
                const user = await prisma.user.findFirst({ where: { email: row.assignedToEmail, isActive: true } });
                if (user) {
                    resolvedUserId = user.id;
                } else {
                    results.warnings.push(`${rowLabel}: email "${row.assignedToEmail}" not found — imported as IN_STOCK`);
                }
            }

            const asset = await prisma.asset.create({
                data: {
                    assetTag: row.assetTag.trim(),
                    serialNumber: row.serialNumber?.trim() || null,
                    name: row.name.trim(),
                    category: row.category as any,
                    brand: row.brand?.trim() || null,
                    model: row.model?.trim() || null,
                    purchaseDate: row.purchaseDate ? new Date(row.purchaseDate) : null,
                    purchasePrice: row.purchasePrice ? parseFloat(row.purchasePrice) : null,
                    vendor: row.vendor?.trim() || null,
                    warrantyExpiry: row.warrantyExpiry ? new Date(row.warrantyExpiry) : null,
                    status: resolvedUserId ? 'ASSIGNED' : 'IN_STOCK',
                    notes: row.notes?.trim() || null,
                    createdById: req.user!.id,
                },
            });

            if (resolvedUserId) {
                await prisma.assetAssignment.create({
                    data: {
                        assetId: asset.id,
                        userId: resolvedUserId,
                        assignedById: req.user!.id,
                        assignedAt: row.purchaseDate ? new Date(row.purchaseDate) : new Date(),
                        reason: 'imported',
                    },
                });
            }

            results.imported++;
        }

        res.json({ status: 'success', data: results });
    });
}

export const assetController = new AssetController();