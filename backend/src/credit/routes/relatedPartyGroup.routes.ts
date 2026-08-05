import { Router } from 'express';
import { relatedPartyGroupController } from '../controllers/relatedPartyGroup.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createRelatedPartyGroupSchema,
  updateRelatedPartyGroupSchema,
  addRelatedPartyMemberSchema,
} from '../validators/relatedPartyGroup.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /related-party-groups
 * List related party groups with pagination & search
 * Requires: credit:read
 */
router.get(
  '/',
  requirePermission('credit:read'),
  relatedPartyGroupController.list,
);

/**
 * GET /related-party-groups/:id
 * Get a single related party group with its members
 * Requires: credit:read
 */
router.get(
  '/:id',
  requirePermission('credit:read'),
  relatedPartyGroupController.getOne,
);

/**
 * POST /related-party-groups
 * Create a new related party group
 * Requires: credit:write
 */
router.post(
  '/',
  requirePermission('credit:write'),
  validate(createRelatedPartyGroupSchema),
  relatedPartyGroupController.create,
);

/**
 * PATCH /related-party-groups/:id
 * Update a related party group
 * Requires: credit:write
 */
router.patch(
  '/:id',
  requirePermission('credit:write'),
  validate(updateRelatedPartyGroupSchema),
  relatedPartyGroupController.update,
);

/**
 * DELETE /related-party-groups/:id
 * Delete a related party group (cascades to members)
 * Requires: credit:admin
 */
router.delete(
  '/:id',
  requirePermission('credit:admin'),
  relatedPartyGroupController.delete,
);

/**
 * POST /related-party-groups/:id/members
 * Add a borrower profile as a member to a group
 * Requires: credit:write
 */
router.post(
  '/:id/members',
  requirePermission('credit:write'),
  validate(addRelatedPartyMemberSchema),
  relatedPartyGroupController.addMember,
);

/**
 * DELETE /related-party-members/:memberId
 * Remove a member from a group
 * Requires: credit:admin
 */
router.delete(
  '/members/:memberId',
  requirePermission('credit:admin'),
  relatedPartyGroupController.removeMember,
);

/**
 * GET /related-party-groups/:id/exposure
 * §7.2 — Group Exposure Aggregation
 * Aggregates total exposure across all group members
 * Requires: credit:read
 */
router.get(
  '/:id/exposure',
  requirePermission('credit:read'),
  relatedPartyGroupController.getGroupExposure,
);

export default router;