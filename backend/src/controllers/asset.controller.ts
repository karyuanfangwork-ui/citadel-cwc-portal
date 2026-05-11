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
                { os: { contains: term, mode: 'insensitive' } },
                { entity: { contains: term, mode: 'insensitive' } },
                { previousUser: { contains: term, mode: 'insensitive' } },
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
            'Notes', 'OS', 'Encrypted', 'SKU Family', 'Join Type',
            'Ethernet MAC', 'Wi-Fi MAC', 'Arch', 'Previous User', 'Entity', 'Created At',
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
                escapeCsv(asset.os),
                escapeCsv(asset.encrypted),
                escapeCsv(asset.skuFamily),
                escapeCsv(asset.joinType),
                escapeCsv(asset.ethernetMac),
                escapeCsv(asset.wifiMac),
                escapeCsv(asset.arch),
                escapeCsv(asset.previousUser),
                escapeCsv(asset.entity),
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
                { os: { contains: term, mode: 'insensitive' } },
                { entity: { contains: term, mode: 'insensitive' } },
                { previousUser: { contains: term, mode: 'insensitive' } },
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
            os,
            encrypted,
            skuFamily,
            joinType,
            ethernetMac,
            wifiMac,
            arch,
            previousUser,
            entity,
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
                os: os || null,
                encrypted: encrypted || null,
                skuFamily: skuFamily || null,
                joinType: joinType || null,
                ethernetMac: ethernetMac || null,
                wifiMac: wifiMac || null,
                arch: arch || null,
                previousUser: previousUser || null,
                entity: entity || null,
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
            os,
            encrypted,
            skuFamily,
            joinType,
            ethernetMac,
            wifiMac,
            arch,
            previousUser,
            entity,
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
        if (os !== undefined) data.os = os;
        if (encrypted !== undefined) data.encrypted = encrypted;
        if (skuFamily !== undefined) data.skuFamily = skuFamily;
        if (joinType !== undefined) data.joinType = joinType;
        if (ethernetMac !== undefined) data.ethernetMac = ethernetMac;
        if (wifiMac !== undefined) data.wifiMac = wifiMac;
        if (arch !== undefined) data.arch = arch;
        if (previousUser !== undefined) data.previousUser = previousUser;
        if (entity !== undefined) data.entity = entity;
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
     * POST /assets/import/parse
     * Upload a CSV/XLSX file and get a column-mapped preview with validation.
     * Returns parsed rows (with auto-mapped DB field names), validation errors, and column suggestions.
     */
    importAssetsParse = asyncHandler(async (req: AuthRequest, res: Response) => {
        console.log('[importAssetsParse] Request received, file:', !!(req as any).file, 'body keys:', Object.keys(req.body));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const file = (req as any).file as { buffer: Buffer; originalname: string; mimetype: string } | undefined;
        const rowsInput = req.body.rows as Record<string, string>[] | undefined;

        let rawRows: Record<string, string>[];

        if (file) {
            // File uploaded via multipart
            const XLSX = await import('xlsx');
            const isXlsx = file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls');

            if (isXlsx) {
                const workbook = XLSX.read(file.buffer, { type: 'buffer' });
                console.log('[importAssetsParse] XLSX sheets:', workbook.SheetNames);
                const sheetName = workbook.SheetNames[0]; // Use first sheet
                const sheet = workbook.Sheets[sheetName];
                rawRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
            } else {
                // CSV — parse using XLSX for robustness
                const text = file.buffer.toString('utf-8');
                const workbook = XLSX.read(text, { type: 'string' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                rawRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
            }

            // Strip empty keys from each row — XLSX files with wide formatting (e.g. 16000+ columns)
            // produce massive payloads with thousands of empty string fields. Only keep non-empty values.
            rawRows = rawRows.map(row => {
                const filtered: Record<string, string> = {};
                for (const [key, value] of Object.entries(row)) {
                    if (value !== '') {
                        filtered[key] = value;
                    }
                }
                return filtered;
            });
        } else if (rowsInput && Array.isArray(rowsInput) && rowsInput.length > 0) {
            // JSON body fallback (backward compatibility)
            rawRows = rowsInput;
        } else {
            throw new AppError('Upload a CSV/XLSX file or provide rows array', 400);
        }

        if (rawRows.length === 0) {
            throw new AppError('No data rows found in the file', 400);
        }

        console.log('[importAssetsParse] Parsed %d rows, %d columns', rawRows.length, Object.keys(rawRows[0]).length);

        // ── Column mapping: Excel/header names → DB field names ──────
        const COLUMN_ALIASES: Record<string, string> = {
            'device name': 'name',
            'serial number': 'serialNumber',
            'serialnumber': 'serialNumber',
            'serial_number': 'serialNumber',
            'serial no': 'serialNumber',
            'manufacturer': 'brand',
            'brand': 'brand',
            'model': 'model',
            'category': 'category',
            'asset tag': 'assetTag',
            'assettag': 'assetTag',
            'asset_tag': 'assetTag',
            'primary user email address': 'assignedToEmail',
            'primary user email': 'assignedToEmail',
            'assignedtoemail': 'assignedToEmail',
            'email': 'assignedToEmail',
            'primary user display name': 'assignedToName',
            'purchase date': 'purchaseDate',
            'purchasedate': 'purchaseDate',
            'purchase_date': 'purchaseDate',
            'purchase price': 'purchasePrice',
            'purchaseprice': 'purchasePrice',
            'purchase_price': 'purchasePrice',
            'vendor': 'vendor',
            'warranty expiry': 'warrantyExpiry',
            'warrantyexpiry': 'warrantyExpiry',
            'warranty_expiry': 'warrantyExpiry',
            'notes': 'notes',
            'remarks': 'notes',
            'remarks2': 'notes',
            'status': 'status',
            'previous used by': 'previousUser',
            'previoususedby': 'previousUser',
            'encrypted': 'encrypted',
            'os': 'os',
            'skufamily': 'skuFamily',
            'join type': 'joinType',
            'jointype': 'joinType',
            'entities': 'entities',
            'ethernet mac': 'ethernetMac',
            'ethernetmac': 'ethernetMac',
            'ethernet_mac': 'ethernetMac',
            'wi-fi mac': 'wifiMac',
            'wifimac': 'wifiMac',
            'wi-fi_mac': 'wifiMac',
            'arch': 'arch',
            'sku family': 'skuFamily',
        };

        // Category normalization: human-readable → enum value
        const CATEGORY_MAP: Record<string, string> = {
            'laptop': 'LAPTOP',
            'desktop': 'DESKTOP',
            'monitor': 'MONITOR',
            'peripheral': 'PERIPHERAL',
            'phone': 'PHONE',
            'network': 'NETWORK',
            'printer': 'PRINTER',
            'software license': 'SOFTWARE_LICENSE',
            'software_license': 'SOFTWARE_LICENSE',
            'other': 'OTHER',
        };

        // Map header names
        const originalHeaders = Object.keys(rawRows[0]);
        const headerMapping: Record<string, string> = {};
        for (const header of originalHeaders) {
            const key = header.trim().toLowerCase();
            headerMapping[header] = COLUMN_ALIASES[key] || header;
        }

        // Transform rows: map headers and normalize values
        const mappedRows = rawRows.map((row, i) => {
            const mapped: Record<string, string> = { _rowIndex: String(i + 2) }; // +2 for 1-based + header
            for (const [origKey, value] of Object.entries(row)) {
                const dbField = headerMapping[origKey] || origKey;
                mapped[dbField] = String(value ?? '').trim();
            }

            // Normalize category
            if (mapped.category) {
                const normalized = CATEGORY_MAP[mapped.category.toLowerCase()];
                if (normalized) {
                    mapped.category = normalized;
                }
            }

            // Handle "Available" / "Server Admin" / empty emails — don't assign
            if (mapped.assignedToEmail) {
                const lower = mapped.assignedToEmail.toLowerCase();
                if (lower === 'available' || lower === 'server admin' || lower === '' || lower === 'n/a') {
                    mapped.assignedToEmail = '';
                }
            }

            return mapped;
        });

        // ── Validation ────────────────────────────────────────────────
        const VALID_CATEGORIES = ['LAPTOP', 'DESKTOP', 'MONITOR', 'PERIPHERAL', 'PHONE', 'NETWORK', 'PRINTER', 'SOFTWARE_LICENSE', 'OTHER'];

        interface ValidationIssue {
            row: string;
            field: string;
            message: string;
            severity: 'error' | 'warning';
        }

        const issues: ValidationIssue[] = [];
        const validatedRows: Record<string, string>[] = [];

        // Collect existing assetTags and serialNumbers for duplicate detection
        const allAssetTags = mappedRows.map(r => r.assetTag).filter(Boolean);
        const allSerialNumbers = mappedRows.map(r => r.serialNumber).filter(Boolean);

        const existingTags = await prisma.asset.findMany({
            where: { assetTag: { in: allAssetTags } },
            select: { id: true, assetTag: true },
        });
        const existingSerials = await prisma.asset.findMany({
            where: { serialNumber: { in: allSerialNumbers } },
            select: { id: true, serialNumber: true },
        });
        const existingTagMap = new Map(existingTags.map(a => [a.assetTag, a.id]));
        const existingSerialMap = new Map(existingSerials.map(a => [a.serialNumber!, a.id]));

        // Count in-file duplicates
        const tagCountInFile: Record<string, number> = {};
        for (const tag of allAssetTags) {
            tagCountInFile[tag] = (tagCountInFile[tag] || 0) + 1;
        }
        const serialCountInFile: Record<string, number> = {};
        for (const sn of allSerialNumbers) {
            serialCountInFile[sn] = (serialCountInFile[sn] || 0) + 1;
        }

        for (const row of mappedRows) {
            const rowLabel = row._rowIndex;
            const rowErrors: string[] = [];
            const rowWarnings: string[] = [];

            // Required fields
            if (!row.assetTag) {
                rowErrors.push('assetTag is required');
                issues.push({ row: rowLabel, field: 'assetTag', message: 'assetTag is required', severity: 'error' });
            }
            if (!row.name) {
                rowErrors.push('name is required');
                issues.push({ row: rowLabel, field: 'name', message: 'name is required', severity: 'error' });
            }
            if (!row.category) {
                rowErrors.push('category is required');
                issues.push({ row: rowLabel, field: 'category', message: 'category is required', severity: 'error' });
            } else if (!VALID_CATEGORIES.includes(row.category)) {
                const msg = `Invalid category "${row.category}". Valid: ${VALID_CATEGORIES.join(', ')}`;
                rowErrors.push(msg);
                issues.push({ row: rowLabel, field: 'category', message: msg, severity: 'error' });
            }

            // DB duplicate check — mark rows that match existing assets.
            // DB duplicates are NOT marked as _valid:false because they can be updated (updateExisting mode).
            // In-file duplicates remain hard errors (can't determine which row wins).
            let existingAssetId: string | null = null;
            if (row.assetTag && existingTagMap.has(row.assetTag)) {
                existingAssetId = existingTagMap.get(row.assetTag)!;
                rowWarnings.push(`assetTag "${row.assetTag}" already exists in DB`);
                issues.push({ row: rowLabel, field: 'assetTag', message: `assetTag "${row.assetTag}" already exists in DB`, severity: 'warning' });
            }
            if (row.serialNumber && existingSerialMap.has(row.serialNumber)) {
                if (!existingAssetId) {
                    existingAssetId = existingSerialMap.get(row.serialNumber)!;
                }
                rowWarnings.push(`serialNumber "${row.serialNumber}" already exists in DB`);
                issues.push({ row: rowLabel, field: 'serialNumber', message: `serialNumber "${row.serialNumber}" already exists in DB`, severity: 'warning' });
            }

            // In-file duplicate check — mark ALL duplicates (not just 2nd+)
            if (row.assetTag && tagCountInFile[row.assetTag] > 1) {
                const msg = `Duplicate assetTag "${row.assetTag}" appears ${tagCountInFile[row.assetTag]}× in file`;
                rowErrors.push(msg);
                issues.push({ row: rowLabel, field: 'assetTag', message: msg, severity: 'error' });
            }
            if (row.serialNumber && serialCountInFile[row.serialNumber] > 1) {
                const msg = `Duplicate serialNumber "${row.serialNumber}" appears ${serialCountInFile[row.serialNumber]}× in file`;
                rowWarnings.push(msg);
                issues.push({ row: rowLabel, field: 'serialNumber', message: msg, severity: 'warning' });
            }

            // Email check (warning only)
            if (row.assignedToEmail && row.assignedToEmail.includes('@') && !row.assignedToEmail.endsWith('@citadelgroup.com.my') && !row.assignedToEmail.endsWith('@company.com')) {
                const msg = `Email "${row.assignedToEmail}" may not match a known domain`;
                rowWarnings.push(msg);
                issues.push({ row: rowLabel, field: 'assignedToEmail', message: msg, severity: 'warning' });
            }

            // Write extra CSV fields to dedicated DB columns instead of combining into notes
            const extraFields: Record<string, string> = {};
            if (row.ethernetMac && row.ethernetMac !== 'N/A' && row.ethernetMac !== 'n/a') extraFields.ethernetMac = row.ethernetMac;
            if (row.wifiMac && row.wifiMac !== 'N/A' && row.wifiMac !== 'n/a') extraFields.wifiMac = row.wifiMac;
            if (row.previousUser) extraFields.previousUser = row.previousUser;
            if (row.os) extraFields.os = row.os;
            if (row.encrypted) extraFields.encrypted = row.encrypted;
            if (row.skuFamily) extraFields.skuFamily = row.skuFamily;
            if (row.joinType) extraFields.joinType = row.joinType;
            if (row.entities) extraFields.entity = row.entities;
            if (row.arch) extraFields.arch = row.arch;

            const hasError = rowErrors.length > 0;
            const isDuplicate = !!existingAssetId;
            validatedRows.push({
                ...row,
                notes: row.notes || '',
                ...extraFields,
                _valid: hasError ? 'false' : 'true',
                _isDuplicate: isDuplicate ? 'true' : 'false',
                _errors: rowErrors,
                _warnings: rowWarnings,
                ...(existingAssetId ? { _existingId: existingAssetId } : {}),
            } as any);
        }

        // Build column suggestions for the UI
        const knownDbFields = ['assetTag', 'serialNumber', 'name', 'category', 'brand', 'model', 'purchaseDate', 'purchasePrice', 'vendor', 'warrantyExpiry', 'status', 'assignedToEmail', 'assignedToName', 'notes', 'os', 'encrypted', 'skuFamily', 'joinType', 'ethernetMac', 'wifiMac', 'arch', 'previousUser', 'entity'];
        const columnMapping = Object.entries(headerMapping)
            .filter(([, dbField]) => knownDbFields.includes(dbField) || !COLUMN_ALIASES[Object.keys(headerMapping).find(k => headerMapping[k] === dbField) || ''])
            .map(([header, dbField]) => ({ header, dbField, matched: knownDbFields.includes(dbField) }));

        const stats = {
            totalRows: mappedRows.length,
            validRows: validatedRows.filter(r => r._valid === 'true').length,
            errorRows: validatedRows.filter(r => r._valid === 'false').length,
            duplicateRows: validatedRows.filter(r => r._isDuplicate === 'true' && r._valid === 'true').length,
            newRows: validatedRows.filter(r => r._isDuplicate !== 'true' && r._valid === 'true').length,
            errors: issues.filter(i => i.severity === 'error'),
            warnings: issues.filter(i => i.severity === 'warning'),
        };

        res.json({
            status: 'success',
            data: {
                columnMapping,
                rows: validatedRows,
                stats,
            },
        });
    });

    /**
     * POST /assets/import/commit
     * Takes validated rows from preview and writes to DB.
     * Body: { rows: Array<mapped row objects>, assignUsers: boolean, updateExisting: boolean }
     * If updateExisting is true, rows that match existing assets by assetTag (or serialNumber)
     * will be updated instead of skipped.
     */
    importAssetsCommit = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { rows, assignUsers = true, updateExisting = false } = req.body;

        if (!Array.isArray(rows) || rows.length === 0) {
            throw new AppError('rows array is required', 400);
        }

        const results: { imported: number; updated: number; skipped: number; warnings: string[]; errors: string[] } = {
            imported: 0, updated: 0, skipped: 0, warnings: [], errors: [],
        };

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowLabel = row._rowIndex || `Row ${i + 2}`;

            // Skip rows marked invalid from the parse step
            if (row._valid === 'false') {
                results.skipped++;
                continue;
            }

            if (!row.assetTag || !row.name || !row.category) {
                results.errors.push(`${rowLabel}: assetTag, name, and category are required — skipped`);
                results.skipped++;
                continue;
            }

            // Check for DB duplicates
            const duplicate = await prisma.asset.findFirst({
                where: {
                    OR: [
                        { assetTag: row.assetTag },
                        ...(row.serialNumber ? [{ serialNumber: row.serialNumber }] : []),
                    ],
                },
            });

            if (duplicate) {
                if (updateExisting) {
                    // Update existing asset
                    const conflictFields: string[] = [];
                    if (duplicate.assetTag === row.assetTag) conflictFields.push('assetTag');
                    if (row.serialNumber && duplicate.serialNumber === row.serialNumber) conflictFields.push('serialNumber');

                    try {
                        let resolvedUserId: string | null = null;
                        if (assignUsers && row.assignedToEmail) {
                            const user = await prisma.user.findFirst({ where: { email: row.assignedToEmail, isActive: true } });
                            if (user) {
                                resolvedUserId = user.id;
                            } else {
                                results.warnings.push(`${rowLabel}: email "${row.assignedToEmail}" not found — kept as ${duplicate.status}`);
                            }
                        }

                        const updateData: any = {
                            name: row.name.trim(),
                            category: row.category,
                            brand: row.brand?.trim() || null,
                            model: row.model?.trim() || null,
                            serialNumber: row.serialNumber?.trim() || null,
                            purchaseDate: row.purchaseDate ? new Date(row.purchaseDate) : null,
                            purchasePrice: row.purchasePrice ? parseFloat(row.purchasePrice) : null,
                            vendor: row.vendor?.trim() || null,
                            warrantyExpiry: row.warrantyExpiry ? new Date(row.warrantyExpiry) : null,
                            notes: row.notes?.trim() || null,
                            os: row.os?.trim() || null,
                            encrypted: row.encrypted?.trim() || null,
                            skuFamily: row.skuFamily?.trim() || null,
                            joinType: row.joinType?.trim() || null,
                            ethernetMac: row.ethernetMac?.trim() || null,
                            wifiMac: row.wifiMac?.trim() || null,
                            arch: row.arch?.trim() || null,
                            previousUser: row.previousUser?.trim() || null,
                            entity: row.entity?.trim() || null,
                        };

                        // Only update status if assigning a user or explicit status provided
                        if (resolvedUserId) {
                            updateData.status = 'ASSIGNED';
                        } else if (row.status) {
                            updateData.status = row.status;
                        }

                        await prisma.asset.update({
                            where: { id: duplicate.id },
                            data: updateData,
                        });

                        // Handle assignment update
                        if (resolvedUserId) {
                            // Check if already assigned to this user
                            const existingAssignment = await prisma.assetAssignment.findFirst({
                                where: { assetId: duplicate.id, userId: resolvedUserId, returnedAt: null },
                            });
                            if (!existingAssignment) {
                                // Return any current assignment first
                                await prisma.assetAssignment.updateMany({
                                    where: { assetId: duplicate.id, returnedAt: null },
                                    data: { returnedAt: new Date() },
                                });
                                await prisma.assetAssignment.create({
                                    data: {
                                        assetId: duplicate.id,
                                        userId: resolvedUserId,
                                        assignedById: req.user!.id,
                                        assignedAt: row.purchaseDate ? new Date(row.purchaseDate) : new Date(),
                                        reason: 'imported (updated)',
                                    },
                                });
                            }
                        }

                        results.updated++;
                        results.warnings.push(`${rowLabel}: Updated existing asset (${conflictFields.join(', ')} matched)`);
                    } catch (err: any) {
                        results.errors.push(`${rowLabel}: Failed to update — ${err.message || 'Unknown error'}`);
                        results.skipped++;
                    }
                } else {
                    // Skip duplicates (original behavior) — but provide specific field name
                    const conflictFields: string[] = [];
                    if (duplicate.assetTag === row.assetTag) conflictFields.push('assetTag');
                    if (row.serialNumber && duplicate.serialNumber === row.serialNumber) conflictFields.push('serialNumber');
                    results.errors.push(`${rowLabel}: ${conflictFields.join(' & ')} "${conflictFields.length === 1 ? (conflictFields[0] === 'assetTag' ? row.assetTag : row.serialNumber) : row.assetTag + '" / "' + row.serialNumber}" already exists in DB — skipped`);
                    results.skipped++;
                }
                continue;
            }

            // Create new asset
            let resolvedUserId: string | null = null;
            if (assignUsers && row.assignedToEmail) {
                const user = await prisma.user.findFirst({ where: { email: row.assignedToEmail, isActive: true } });
                if (user) {
                    resolvedUserId = user.id;
                } else {
                    results.warnings.push(`${rowLabel}: email "${row.assignedToEmail}" not found — imported as IN_STOCK`);
                }
            }

            try {
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
                        status: resolvedUserId ? 'ASSIGNED' : (row.status || 'IN_STOCK'),
                        notes: row.notes?.trim() || null,
                        os: row.os?.trim() || null,
                        encrypted: row.encrypted?.trim() || null,
                        skuFamily: row.skuFamily?.trim() || null,
                        joinType: row.joinType?.trim() || null,
                        ethernetMac: row.ethernetMac?.trim() || null,
                        wifiMac: row.wifiMac?.trim() || null,
                        arch: row.arch?.trim() || null,
                        previousUser: row.previousUser?.trim() || null,
                        entity: row.entity?.trim() || null,
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
            } catch (err: any) {
                results.errors.push(`${rowLabel}: ${err.message || 'Unknown error'}`);
                results.skipped++;
            }
        }

        res.json({ status: 'success', data: results });
    });

    /**
     * POST /assets/import (backward-compatible)
     * Bulk CSV import with row validation, duplicate check, and optional assignedToEmail user lookup.
     * Expects body.rows as an array of objects (parsed CSV rows).
     * Delegates to importAssetsParse for validation, then importAssetsCommit for insertion.
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
            const rowLabel = `Row ${i + 2}`;

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
                    os: row.os?.trim() || null,
                    encrypted: row.encrypted?.trim() || null,
                    skuFamily: row.skuFamily?.trim() || null,
                    joinType: row.joinType?.trim() || null,
                    ethernetMac: row.ethernetMac?.trim() || null,
                    wifiMac: row.wifiMac?.trim() || null,
                    arch: row.arch?.trim() || null,
                    previousUser: row.previousUser?.trim() || null,
                    entity: row.entity?.trim() || null,
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