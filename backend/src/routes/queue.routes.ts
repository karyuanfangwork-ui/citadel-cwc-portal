/**
 * P3-04: Queue monitoring routes
 *
 * All queue endpoints require admin:access permission.
 * GET /admin/queues — list all BullMQ queue statuses
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { listQueues } from '../controllers/queue.controller';

const router = Router();

router.use(authenticate, requirePermission('admin:access'));

router.get('/', listQueues);

export default router;