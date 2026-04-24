import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
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

// All routes require authentication
router.use(authenticate, authorize('ADMIN'));

// Get all workflow types
router.get('/', getWorkflowTypes);

// Get workflow type by ID
router.get('/:id', getWorkflowType);

// Get workflow type by code (authenticated)
router.get('/code/:code', getWorkflowTypeByCode);

// Create workflow type
router.post('/', createWorkflowType);

// Update workflow type
router.put('/:id', updateWorkflowType);

// Delete workflow type
router.delete('/:id', deleteWorkflowType);

// Add step to workflow
router.post('/:id/steps', addWorkflowStep);

// Update workflow step
router.put('/:id/steps/:stepId', updateWorkflowStep);

// Delete workflow step
router.delete('/:id/steps/:stepId', deleteWorkflowStep);

// Reorder workflow steps
router.put('/:id/steps/reorder', reorderWorkflowSteps);

export default router;