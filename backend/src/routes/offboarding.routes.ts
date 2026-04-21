import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    createOffboardingRequest,
    getOffboardingRequest,
    updateOffboardingStatus,
    createOffboardingTask,
    getOffboardingTasks,
    updateOffboardingTask,
    deleteOffboardingTask,
    getOffboardingProgress,
    uploadResignationLetter,
    deleteResignationLetter,
    resignationUpload,
} from '../controllers/offboarding.controller';

const router = Router();

router.use(authenticate);

router.post('/requests/:id/offboarding/create', createOffboardingRequest);
router.get('/requests/:id/offboarding', getOffboardingRequest);
router.put('/requests/:id/offboarding/update-status', updateOffboardingStatus);
router.get('/requests/:id/offboarding/progress', getOffboardingProgress);

router.post('/requests/:id/offboarding/resignation-letter', resignationUpload.single('file'), uploadResignationLetter);
router.delete('/requests/:id/offboarding/resignation-letter', deleteResignationLetter);

router.post('/requests/:id/offboarding/tasks', createOffboardingTask);
router.get('/requests/:id/offboarding/tasks', getOffboardingTasks);
router.put('/requests/:id/offboarding/tasks/:taskId', updateOffboardingTask);
router.delete('/requests/:id/offboarding/tasks/:taskId', deleteOffboardingTask);

export default router;
