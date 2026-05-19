import { Router, Request, Response, NextFunction } from 'express';
import { applicationFacilityController } from '../controllers/applicationFacility.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createApplicationFacilitySchema, updateApplicationFacilitySchema } from '../validators/applicationFacility.validator';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Middleware to verify that the user has access to the facility's application.
 * The user must be:
 * - An admin or credit admin, OR
 * - The assigned RM or analyst for the application
 * Borrowers access facilities through their application routes, not direct facility routes.
 */
async function requireFacilityAccess(req: Request, _res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    if (!user) {
      return next(new AppError('Authentication required', 401));
    }

    const id = req.params.id as string;
    if (!id) {
      return next(new AppError('Facility ID required', 400));
    }

    // Fetch the facility with its application
    const facility = await prisma.applicationFacility.findUnique({
      where: { id },
      select: {
        applicationId: true,
      },
    });

    if (!facility) {
      return next(new AppError('Application facility not found', 404));
    }

    // Fetch the application with access fields
    const application = await prisma.creditApplication.findUnique({
      where: { id: facility.applicationId },
      select: {
        assignedRmId: true,
        assignedAnalystId: true,
        borrowerProfileId: true,
      },
    });

    if (!application) {
      return next(new AppError('Credit application not found', 404));
    }

    // Admin users can access everything
    const isAdmin = user.roles?.some((r: string) => ['ADMIN', 'CREDIT_ADMIN'].includes(r));
    if (isAdmin) {
      return next();
    }

    // Check if user is the assigned RM or analyst
    if (application.assignedRmId === user.id || application.assignedAnalystId === user.id) {
      return next();
    }

    // Check if user has credit:read or credit:write permission (broad access)
    const hasReadPerm = user.permissions?.some((p: string) => p === 'credit:read' || p === 'credit:admin');
    if (hasReadPerm) {
      return next();
    }

    return next(new AppError('You do not have access to this facility', 403));
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /applications/:applicationId/facilities
 * List facilities for a credit application
 * Requires: credit:read
 */
router.get(
  '/:applicationId/facilities',
  requirePermission('credit:read'),
  applicationFacilityController.list,
);

/**
 * POST /applications/:applicationId/facilities
 * Create a new facility under a credit application
 * Requires: credit:write
 */
router.post(
  '/:applicationId/facilities',
  requirePermission('credit:write'),
  validate(createApplicationFacilitySchema),
  applicationFacilityController.create,
);

/**
 * GET /fac/:id
 * Get a single facility by ID (direct access)
 * Requires: credit:read + ownership check
 */
router.get(
  '/fac/:id',
  requirePermission('credit:read'),
  requireFacilityAccess,
  applicationFacilityController.getOne,
);

/**
 * PATCH /fac/:id
 * Update a facility by ID (direct access)
 * Requires: credit:write + ownership check
 */
router.patch(
  '/fac/:id',
  requirePermission('credit:write'),
  requireFacilityAccess,
  validate(updateApplicationFacilitySchema),
  applicationFacilityController.update,
);

/**
 * DELETE /fac/:id
 * Delete a facility by ID (direct access)
 * Requires: credit:admin + ownership check
 */
router.delete(
  '/fac/:id',
  requirePermission('credit:admin'),
  requireFacilityAccess,
  applicationFacilityController.delete,
);

export default router;