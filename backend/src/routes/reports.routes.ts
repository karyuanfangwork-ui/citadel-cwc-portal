import { Router } from 'express';
import { reportsController } from '../controllers/reports.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);
router.use(requirePermission('report:read'));

router.get('/summary', reportsController.getSummary);
router.get('/by-status', reportsController.byStatus);
router.get('/by-service-desk', reportsController.byServiceDesk);
router.get('/by-priority', reportsController.byPriority);
router.get('/agent-workload', reportsController.agentWorkload);
router.get('/sla-status', reportsController.slaStatus);

export default router;