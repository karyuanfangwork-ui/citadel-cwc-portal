import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { getEmailNotificationsEnabled, setEmailNotificationsEnabled } from '../controllers/systemSetting.controller';

const router = Router();

router.get('/email-notifications-enabled', authenticate, getEmailNotificationsEnabled);
router.put('/email-notifications-enabled', authenticate, authorize('ADMIN'), setEmailNotificationsEnabled);

export default router;
