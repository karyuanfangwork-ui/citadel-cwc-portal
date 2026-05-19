import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { listJobs, updateJob, triggerJob, restartJob } from '../controllers/scheduler.controller';

const router = Router();

router.use(authenticate, requirePermission('admin:access'));

router.get('/', listJobs);
router.patch('/:jobKey', updateJob);
router.post('/:jobKey/trigger', triggerJob);
router.post('/:jobKey/restart', restartJob);

export default router;