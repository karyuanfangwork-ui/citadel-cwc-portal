import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { departmentService, membershipService, getPrincipalGrants } from '../services/departmentMembership.service';

const router = Router();

// All department routes require authentication
router.use(authenticate);

// ── Department CRUD ───────────────────────────────────────────────────

/**
 * @route   GET /api/v1/departments
 * @desc    List departments for the current tenant
 * @access  Private (department:read)
 */
router.get('/', requirePermission('department:read'), async (req, res, next) => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ status: 'error', message: 'Tenant context required' });
        }
        const includeInactive = req.query.includeInactive === 'true';
        const departments = await departmentService.list(tenantId, includeInactive);
        res.json({ status: 'success', data: { departments } });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/departments/:id
 * @desc    Get a department by ID
 * @access  Private (department:read)
 */
router.get('/:id', requirePermission('department:read'), async (req, res, next) => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ status: 'error', message: 'Tenant context required' });
        }
        const department = await departmentService.getById(tenantId, String(String(req.params.id)));
        if (!department) {
            return res.status(404).json({ status: 'error', message: 'Department not found' });
        }
        res.json({ status: 'success', data: { department } });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/v1/departments
 * @desc    Create a department
 * @access  Private (department:manage)
 */
router.post('/', requirePermission('department:manage'), async (req, res, next) => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ status: 'error', message: 'Tenant context required' });
        }
        const department = await departmentService.create(tenantId, req.body);
        res.status(201).json({ status: 'success', data: { department } });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/v1/departments/:id
 * @desc    Update a department
 * @access  Private (department:manage)
 */
router.put('/:id', requirePermission('department:manage'), async (req, res, next) => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ status: 'error', message: 'Tenant context required' });
        }
        const department = await departmentService.update(tenantId, String(String(req.params.id)), req.body);
        res.json({ status: 'success', data: { department } });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/v1/departments/:id
 * @desc    Deactivate a department (soft delete)
 * @access  Private (department:manage)
 */
router.delete('/:id', requirePermission('department:manage'), async (req, res, next) => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ status: 'error', message: 'Tenant context required' });
        }
        const department = await departmentService.deactivate(tenantId, String(req.params.id));
        res.json({ status: 'success', data: { department } });
    } catch (error) {
        next(error);
    }
});

// ── Membership Management ─────────────────────────────────────────────

/**
 * @route   POST /api/v1/departments/:id/members
 * @desc    Add a user to a department with a role
 * @access  Private (department:manage)
 */
router.post('/:id/members', requirePermission('department:manage'), async (req, res, next) => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ status: 'error', message: 'Tenant context required' });
        }
        const membership = await membershipService.addMember(tenantId, {
            departmentId: String(String(req.params.id)),
            userId: req.body.userId,
            roleId: req.body.roleId,
            validFrom: req.body.validFrom ? new Date(req.body.validFrom) : undefined,
            validUntil: req.body.validUntil ? new Date(req.body.validUntil) : undefined,
        });
        res.status(201).json({ status: 'success', data: { membership } });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/v1/departments/members/:membershipId
 * @desc    Remove a membership
 * @access  Private (department:manage)
 */
router.delete('/members/:membershipId', requirePermission('department:manage'), async (req, res, next) => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ status: 'error', message: 'Tenant context required' });
        }
        const membership = await membershipService.removeMember(tenantId, String(req.params.membershipId));
        res.json({ status: 'success', data: { membership } });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/v1/departments/grants/:userId
 * @desc    Get all department-scoped grants for a user
 * @access  Private (department:read)
 */
router.get('/grants/:userId', requirePermission('department:read'), async (req, res, next) => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ status: 'error', message: 'Tenant context required' });
        }
        const grants = await getPrincipalGrants(String(req.params.userId), tenantId);
        res.json({ status: 'success', data: { grants } });
    } catch (error) {
        next(error);
    }
});

export default router;