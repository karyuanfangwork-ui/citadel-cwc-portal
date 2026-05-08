import { Router } from 'express';
import { auditLogController } from '../controllers/auditLog.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';

const router = Router();

// Audit log routes require admin:access (read) or admin:settings (full)
router.use(authenticate, requirePermission('admin:access', 'admin:settings'));

router.get('/', auditLogController.getConfidentialAccessLogs);

export default router;