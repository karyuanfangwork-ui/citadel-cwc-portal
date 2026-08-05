import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { assetController } from '../controllers/asset.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';

const router = Router();

// Multer for in-memory file uploads (CSV/XLSX import)
const importUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
        const allowed = [
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/octet-stream', // Some browsers send XLSX as octet-stream
        ];
        // Also check by extension for browsers that send generic MIME types
        const ext = file.originalname.toLowerCase();
        if (allowed.includes(file.mimetype) || ext.endsWith('.csv') || ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}. Please upload .csv or .xlsx files only.`));
        }
    },
});

// Multer error handler wrapper — catches MulterError (file too large, wrong type, etc.)
function handleMulterUpload(uploadMiddleware: ReturnType<typeof importUpload.single>) {
    return (req: Request, res: Response, next: NextFunction) => {
        uploadMiddleware(req, res, (err) => {
            if (err) {
                if (err instanceof multer.MulterError) {
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        next(new AppError('File too large. Maximum size is 10MB.', 413));
                    } else {
                        next(new AppError(`Upload error: ${err.message}`, 400));
                    }
                } else if (err instanceof Error) {
                    // Custom error from fileFilter (e.g. unsupported type)
                    next(new AppError(err.message, 400));
                } else {
                    next(err);
                }
            } else {
                next();
            }
        });
    };
}

// All asset routes require authentication
router.use(authenticate);

/**
 * @route   GET /assets/assignments
 * @desc    List all active assignments grouped by user
 * @access  Private (asset:read)
 */
router.get('/assignments', requirePermission('asset:read'), assetController.listActiveAssignments);

/**
 * @route   GET /assets/by-user/:userId
 * @desc    Get active asset assignments for a specific user
 * @access  Private (asset:read)
 */
router.get('/by-user/:userId', requirePermission('asset:read'), assetController.getAssetsByUser);

/**
 * @route   GET /assets/export
 * @desc    Export assets as CSV (respects same filters as list)
 * @access  Private (asset:read)
 */
router.get('/export', requirePermission('asset:read'), assetController.exportAssets);

/**
 * @route   GET /assets
 * @desc    List assets with filters and pagination
 * @access  Private (asset:read)
 */
router.get('/', requirePermission('asset:read'), assetController.listAssets);

/**
 * @route   GET /assets/:id
 * @desc    Get asset detail with assignments and source request
 * @access  Private (asset:read)
 */
router.get('/:id', requirePermission('asset:read'), assetController.getAsset);

/**
 * @route   POST /assets
 * @desc    Create a new asset
 * @access  Private (asset:write)
 */
router.post('/', requirePermission('asset:write'), assetController.createAsset);

/**
 * @route   POST /assets/import/parse
 * @desc    Upload CSV/XLSX, parse and validate, return preview with errors
 * @access  Private (asset:import)
 */
router.post(
    '/import/parse',
    requirePermission('asset:import'),
    handleMulterUpload(importUpload.single('file')),
    assetController.importAssetsParse,
);

/**
 * @route   POST /assets/import/commit
 * @desc    Commit validated rows to database
 * @access  Private (asset:import)
 */
router.post('/import/commit', requirePermission('asset:import'), assetController.importAssetsCommit);

/**
 * @route   POST /assets/import
 * @desc    Bulk import assets (backward-compatible JSON body endpoint)
 * @access  Private (asset:import)
 */
router.post('/import', requirePermission('asset:import'), assetController.importAssets);

/**
 * @route   POST /assets/:id/assign
 * @desc    Assign an asset to a user
 * @access  Private (asset:write)
 */
router.post('/:id/assign', requirePermission('asset:write'), assetController.assignAsset);

/**
 * @route   POST /assets/:id/return
 * @desc    Return an assigned asset
 * @access  Private (asset:write)
 */
router.post('/:id/return', requirePermission('asset:write'), assetController.returnAsset);

/**
 * @route   PATCH /assets/:id
 * @desc    Update an asset
 * @access  Private (asset:write)
 */
router.patch('/:id', requirePermission('asset:write'), assetController.updateAsset);

/**
 * @route   DELETE /assets/:id
 * @desc    Soft-delete an asset (set status to DISPOSED)
 * @access  Private (asset:delete)
 */
router.delete('/:id', requirePermission('asset:delete'), assetController.deleteAsset);

export default router;