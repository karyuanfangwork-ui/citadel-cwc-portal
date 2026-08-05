import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import {
  listTenants,
  getTenant,
  createTenant,
  updateTenant,
  deactivateTenant,
  getTenantStats,
} from '../controllers/tenant.controller';

const router = Router();

/**
 * Tenant management routes — admin only.
 * All routes require authentication and the 'admin:access' permission.
 */
router.use(authenticate, requirePermission('admin:access'));

router.get('/', listTenants);
router.get('/:id', getTenant);
router.get('/:id/stats', getTenantStats);
router.post('/', createTenant);
router.put('/:id', updateTenant);
router.delete('/:id', deactivateTenant);

export default router;