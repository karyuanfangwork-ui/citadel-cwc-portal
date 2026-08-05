import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { requestItemController } from '../controllers/requestItem.controller';

const router = Router();

router.use(authenticate);

// GET /applications/:applicationId/request-items
router.get('/:applicationId/request-items', requirePermission('credit:read'), requestItemController.list);

// POST /applications/:applicationId/request-items
router.post('/:applicationId/request-items', requirePermission('credit:write'), requestItemController.create);

// PATCH /applications/:applicationId/request-items/:itemId
router.patch('/:applicationId/request-items/:itemId', requirePermission('credit:write'), requestItemController.update);

// DELETE /applications/:applicationId/request-items/:itemId
router.delete('/:applicationId/request-items/:itemId', requirePermission('credit:write'), requestItemController.delete);

export default router;
