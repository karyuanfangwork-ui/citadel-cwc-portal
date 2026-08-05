/**
 * P5-06: Approval Policy Routes
 *
 * REST endpoints for managing approval policies.
 * All routes require admin authentication.
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import {
    listPolicies,
    getPolicy,
    createPolicy,
    updatePolicy,
    deletePolicy,
    resolvePolicy,
} from '../controllers/approvalPolicy.controller';

const router = Router();

// All approval policy routes require authentication + admin
router.use(authenticate);
router.use(requirePermission('ADMIN'));

// Policy CRUD
router.get('/request-type/:requestTypeId', listPolicies);
router.get('/resolve/:requestTypeId', resolvePolicy);
router.get('/:id', getPolicy);
router.post('/', createPolicy);
router.put('/:id', updatePolicy);
router.delete('/:id', deletePolicy);

export default router;