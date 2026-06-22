import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { getEmailNotificationsEnabled, setEmailNotificationsEnabled, getOnboardingItAgent, setOnboardingItAgent } from '../controllers/systemSetting.controller';

const router = Router();

router.get('/email-notifications-enabled', authenticate, getEmailNotificationsEnabled);
router.put('/email-notifications-enabled', authenticate, authorize('ADMIN'), setEmailNotificationsEnabled);

router.get('/onboarding-it-agent', authenticate, getOnboardingItAgent);
router.put('/onboarding-it-agent', authenticate, authorize('ADMIN'), setOnboardingItAgent);

export default router;
