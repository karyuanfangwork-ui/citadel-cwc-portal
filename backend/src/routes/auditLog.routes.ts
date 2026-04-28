import { Router } from 'express';
import { auditLogController } from '../controllers/auditLog.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';

const router = Router();

// All audit log routes require admin:settings permission
router.use(authenticate, requirePermission('admin:settings'));

router.get('/', auditLogController.getConfidentialAccessLogs);

export default router;