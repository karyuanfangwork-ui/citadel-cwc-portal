import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import * as ctrl from '../controllers/keyCounterparty.controller';

const router = Router();

router.get('/borrower-profiles/:profileId/counterparties', authenticate, requirePermission('credit:read'), ctrl.list);
router.post('/borrower-profiles/:profileId/counterparties', authenticate, requirePermission('credit:write'), ctrl.create);
router.patch('/borrower-profiles/counterparties/:id', authenticate, requirePermission('credit:write'), ctrl.update);
router.delete('/borrower-profiles/counterparties/:id', authenticate, requirePermission('credit:write'), ctrl.remove);

export default router;
