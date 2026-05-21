import { Router } from 'express';
import { committeeController } from '../controllers/committee.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createMeetingSchema,
  updateMeetingSchema,
  addMemberSchema,
  updateAttendanceSchema,
  addAgendaItemSchema,
  castVoteSchema,
  listMeetingsSchema,
} from '../validators/committee.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// Meeting CRUD
// ============================================================================

/**
 * GET /committee/meetings
 * List committee meetings with pagination
 * Requires: credit:read
 */
router.get(
  '/meetings',
  requirePermission('credit:read'),
  validate(listMeetingsSchema),
  committeeController.listMeetings,
);

/**
 * POST /committee/meetings
 * Create a new committee meeting
 * Requires: credit:admin
 */
router.post(
  '/meetings',
  requirePermission('credit:admin'),
  validate(createMeetingSchema),
  committeeController.createMeeting,
);

/**
 * GET /committee/meetings/:id
 * Get a single committee meeting
 * Requires: credit:read
 */
router.get(
  '/meetings/:id',
  requirePermission('credit:read'),
  committeeController.getMeeting,
);

/**
 * PATCH /committee/meetings/:id
 * Update a committee meeting
 * Requires: credit:admin
 */
router.patch(
  '/meetings/:id',
  requirePermission('credit:admin'),
  validate(updateMeetingSchema),
  committeeController.updateMeeting,
);

/**
 * DELETE /committee/meetings/:id
 * Delete a committee meeting
 * Requires: credit:admin
 */
router.delete(
  '/meetings/:id',
  requirePermission('credit:admin'),
  committeeController.deleteMeeting,
);

// ============================================================================
// Members
// ============================================================================

/**
 * POST /committee/meetings/:id/members
 * Add a member to a meeting
 * Requires: credit:admin
 */
router.post(
  '/meetings/:id/members',
  requirePermission('credit:admin'),
  validate(addMemberSchema),
  committeeController.addMember,
);

/**
 * DELETE /committee/meetings/:id/members/:userId
 * Remove a member from a meeting
 * Requires: credit:admin
 */
router.delete(
  '/meetings/:id/members/:userId',
  requirePermission('credit:admin'),
  committeeController.removeMember,
);

/**
 * PATCH /committee/meetings/:id/members/:userId/attendance
 * Update a member's attendance
 * Requires: credit:write
 */
router.patch(
  '/meetings/:id/members/:userId/attendance',
  requirePermission('credit:write'),
  validate(updateAttendanceSchema),
  committeeController.updateAttendance,
);

// ============================================================================
// Quorum
// ============================================================================

/**
 * GET /committee/meetings/:id/quorum
 * Check if quorum is met for a meeting
 * Requires: credit:read
 */
router.get(
  '/meetings/:id/quorum',
  requirePermission('credit:read'),
  committeeController.checkQuorum,
);

// ============================================================================
// Agenda Items
// ============================================================================

/**
 * POST /committee/meetings/:id/agenda
 * Add an agenda item to a meeting
 * Requires: credit:admin
 */
router.post(
  '/meetings/:id/agenda',
  requirePermission('credit:admin'),
  validate(addAgendaItemSchema),
  committeeController.addAgendaItem,
);

/**
 * DELETE /committee/agenda/:itemId
 * Remove an agenda item
 * Requires: credit:admin
 */
router.delete(
  '/agenda/:itemId',
  requirePermission('credit:admin'),
  committeeController.removeAgendaItem,
);

/**
 * PUT /committee/meetings/:id/agenda/reorder
 * Reorder agenda items
 * Requires: credit:admin
 */
router.put(
  '/meetings/:id/agenda/reorder',
  requirePermission('credit:admin'),
  committeeController.reorderAgenda,
);

// ============================================================================
// Voting
// ============================================================================

/**
 * POST /committee/agenda/:itemId/vote
 * Cast a vote on an agenda item
 * Requires: credit:approve
 */
router.post(
  '/agenda/:itemId/vote',
  requirePermission('credit:approve'),
  validate(castVoteSchema),
  committeeController.castVote,
);

/**
 * GET /committee/agenda/:itemId/results
 * Get vote results for an agenda item
 * Requires: credit:read
 */
router.get(
  '/agenda/:itemId/results',
  requirePermission('credit:read'),
  committeeController.getVoteResults,
);

// ============================================================================
// Decision
// ============================================================================

/**
 * POST /committee/agenda/:itemId/finalize
 * Finalize the decision for an agenda item
 * Requires: credit:admin
 */
router.post(
  '/agenda/:itemId/finalize',
  requirePermission('credit:admin'),
  committeeController.finalizeDecision,
);

// ============================================================================
// Memo
// ============================================================================

/**
 * GET /committee/applications/:applicationId/memo
 * Auto-generate a credit memo for an application
 * Requires: credit:read
 */
router.get(
  '/applications/:applicationId/memo',
  requirePermission('credit:read'),
  committeeController.generateMemo,
);

export default router;