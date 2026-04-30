import { Router } from 'express';
import { assetController } from '../controllers/asset.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';

const router = Router();

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
 * @route   POST /assets/import
 * @desc    Bulk CSV import of assets
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