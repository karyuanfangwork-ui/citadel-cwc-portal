import { Response } from 'express';
import { PrismaClient, AssetStatus } from '@prisma/client';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

class AssetController {
    /**
     * GET /assets/export
     * Export assets as CSV file. Respects the same filters as listAssets.
     * Requires asset:read permission (already enforced by route middleware).
     */
    exportAssets = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { status, category, search } = req.query;

        const where: any = {};
        if (status) where.status = status;
        if (category) where.category = category;

        if (search) {
            const term = search as string;
            where.OR = [
                { name: { contains: term, mode: 'insensitive' } },
                { assetTag: { contains: term, mode: 'insensitive' } },
                { serialNumber: { contains: term, mode: 'insensitive' } },
                { brand: { contains: term, mode: 'insensitive' } },
                { model: { contains: term, mode: 'insensitive' } },
                { assignments: { some: { returnedAt: null, user: { OR: [
                    { firstName: { contains: term, mode: 'insensitive' } },
                    { lastName: { contains: term, mode: 'insensitive' } },
                    { email: { contains: term, mode: 'insensitive' } },
                ] } } } },
                { notes: { contains: term, mode: 'insensitive' } },
            ];
        }

        const assets = await prisma.asset.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
                assignments: {
                    orderBy: { assignedAt: 'desc' },
                    include: {
                        user: { select: { id: true, firstName: true, lastName: true, email: true } },
                        assignedBy: { select: { id: true, firstName: true, lastName: true } },
                    },
                },
            },
        });

        // Build CSV
        const headers = [
            'Asset Tag', 'Name', 'Category', 'Status', 'Serial Number',
            'Brand', 'Model', 'Vendor', 'Purchase Date', 'Purchase Price',
            'Warranty Expiry', 'Assigned To', 'Assigned Email', 'Assigned Date',
            'Notes', 'Created At',
        ];

        const escapeCsv = (val: string | null | undefined) => {
            if (val === null || val === undefined) return '';
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const rows = assets.map(asset => {
            const currentAssignment = asset.assignments?.find(a => !a.returnedAt);
            const assignee = currentAssignment?.user;
            return [
                escapeCsv(asset.assetTag),
                escapeCsv(asset.name),
                escapeCsv(asset.category),
                escapeCsv(asset.status?.replace(/_/g, ' ')),
                escapeCsv(asset.serialNumber),
                escapeCsv(asset.brand),
                escapeCsv(asset.model),
                escapeCsv(asset.vendor),
                escapeCsv(asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : ''),
                escapeCsv(asset.purchasePrice != null ? String(asset.purchasePrice) : ''),
                escapeCsv(asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toISOString().split('T')[0] : ''),
                escapeCsv(assignee ? `${assignee.firstName} ${assignee.lastName}` : ''),
                escapeCsv(assignee?.email ?? ''),
                escapeCsv(currentAssignment?.assignedAt ? new Date(currentAssignment.assignedAt).toISOString().split('T')[0] : ''),
                escapeCsv(asset.notes),
                escapeCsv(new Date(asset.createdAt).toISOString().split('T')[0]),
            ].join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');
        const filename = `assets_export_${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    });

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
                { brand: { contains: term, mode: 'insensitive' } },
                { model: { contains: term, mode: 'insensitive' } },
                // Search by assigned user name or email
                { assignments: { some: { returnedAt: null, user: { OR: [
                    { firstName: { contains: term, mode: 'insensitive' } },
                    { lastName: { contains: term, mode: 'insensitive' } },
                    { email: { contains: term, mode: 'insensitive' } },
                ] } } } },
                // Search by previously assigned user name or email
                { assignments: { some: { returnedAt: { not: null }, user: { OR: [
                    { firstName: { contains: term, mode: 'insensitive' } },
                    { lastName: { contains: term, mode: 'insensitive' } },
                    { email: { contains: term, mode: 'insensitive' } },
                ] } } } },
                // Search notes for original user info (imported data)
                { notes: { contains: term, mode: 'insensitive' } },
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
                        orderBy: { assignedAt: 'desc' },
                        take: 2,
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
     * GET /assets/assignments
     * List all active assignments, grouped by user.
     * Returns each user with their active assignments and asset details.
     */
    listActiveAssignments = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { search, page = '1', limit = '20' } = req.query;
        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);

        // Find distinct users who have active assignments
        const activeAssignments = await prisma.assetAssignment.findMany({
            where: { returnedAt: null },
            include: {
                user: {
                    select: { id: true, firstName: true, lastName: true, email: true, department: true },
                },
                asset: {
                    select: {
                        id: true, assetTag: true, name: true, category: true, brand: true, model: true, status: true,
                    },
                },
                assignedBy: {
                    select: { id: true, firstName: true, lastName: true },
                },
            },
            orderBy: { assignedAt: 'desc' },
        });

        // Group by user
        const userMap = new Map<string, {
            user: { id: string; firstName: string; lastName: string; email: string; department: string | null };
            assignments: typeof activeAssignments;
        }>();

        for (const a of activeAssignments) {
            if (!userMap.has(a.userId)) {
                userMap.set(a.userId, { user: a.user as any, assignments: [] });
            }
            userMap.get(a.userId)!.assignments.push(a);
        }

        // Convert to array and optionally filter by search
        let userAssignments = Array.from(userMap.values());

        if (search) {
            const term = (search as string).toLowerCase();
            userAssignments = userAssignments.filter(ua =>
                ua.user.firstName.toLowerCase().includes(term) ||
                ua.user.lastName.toLowerCase().includes(term) ||
                ua.user.email.toLowerCase().includes(term)
            );
        }

        // Paginate
        const total = userAssignments.length;
        const paginated = userAssignments.slice((pageNum - 1) * limitNum, pageNum * limitNum);

        res.json({
            status: 'success',
            data: {
                userAssignments: paginated,
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
            data: {
                user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email },
                assignments,
            },
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