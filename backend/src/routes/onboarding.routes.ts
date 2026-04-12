import { Router } from 'express';
import {
    createOnboardingRequest,
    getOnboardingRequest,
    updateOnboardingStatus,
    createOnboardingTask,
    getOnboardingTasks,
    updateOnboardingTask,
    deleteOnboardingTask,
    completeMilestone,
    assignBuddy,
    getOnboardingProgress,
} from '../controllers/onboarding.controller';

const router = Router();

// Onboarding request routes
router.post('/requests/:id/onboarding/create', createOnboardingRequest);
router.get('/requests/:id/onboarding', getOnboardingRequest);
router.put('/requests/:id/onboarding/update-status', updateOnboardingStatus);
router.get('/requests/:id/onboarding/progress', getOnboardingProgress);

// Onboarding task routes
router.post('/requests/:id/onboarding/tasks', createOnboardingTask);
router.get('/requests/:id/onboarding/tasks', getOnboardingTasks);
router.put('/requests/:id/onboarding/tasks/:taskId', updateOnboardingTask);
router.delete('/requests/:id/onboarding/tasks/:taskId', deleteOnboardingTask);

// Milestone and buddy routes
router.post('/requests/:id/onboarding/complete-milestone', completeMilestone);
router.post('/requests/:id/onboarding/assign-buddy', assignBuddy);

export default router;
