import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import {
    getWorkflowTypes,
    getWorkflowType,
    getWorkflowTypeByCode,
    createWorkflowType,
    updateWorkflowType,
    deleteWorkflowType,
    addWorkflowStep,
    updateWorkflowStep,
    deleteWorkflowStep,
    reorderWorkflowSteps
} from '../controllers/workflow.controller';

const router = Router();

// Get workflow type by code (authenticated only, no special permission needed)
router.get('/code/:code', authenticate, getWorkflowTypeByCode);

// Read routes — admin:access (view) or workflow:manage (edit)
router.use(authenticate, requirePermission('admin:access', 'workflow:manage'));

// Get all workflow types
router.get('/', getWorkflowTypes);

// Get workflow type by ID
router.get('/:id', getWorkflowType);

// Mutation routes — require workflow:manage
router.post('/', requirePermission('workflow:manage'), createWorkflowType);
router.put('/:id', requirePermission('workflow:manage'), updateWorkflowType);
router.delete('/:id', requirePermission('workflow:manage'), deleteWorkflowType);
router.post('/:id/steps', requirePermission('workflow:manage'), addWorkflowStep);
router.put('/:id/steps/:stepId', requirePermission('workflow:manage'), updateWorkflowStep);
router.delete('/:id/steps/:stepId', requirePermission('workflow:manage'), deleteWorkflowStep);
router.put('/:id/steps/reorder', requirePermission('workflow:manage'), reorderWorkflowSteps);

export default router;