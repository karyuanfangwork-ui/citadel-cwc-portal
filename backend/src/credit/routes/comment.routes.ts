/**
 * P2-4: Application Comment Routes
 *
 * Nested under /applications/:id for per-application comments,
 * and /comments/:commentId for direct comment operations.
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import {
  listComments,
  createComment,
  updateComment,
  deleteComment,
  getScoreStatus,
  rescoreApplication,
} from '../controllers/comment.controller';

const router = Router();

// All comment routes require authentication
router.use(authenticate);

// ── Per-application comment routes ──────────────────────────────────
// These are mounted under /applications, so the full paths are:
// GET  /applications/:id/comments     — list threaded comments
// POST /applications/:id/comments     — create comment or reply
// GET  /applications/:id/score-status — check if score is outdated
// POST /applications/:id/rescore     — trigger rescore

router.get('/applications/:id/comments', requirePermission('credit:read'), listComments);
router.post('/applications/:id/comments', requirePermission('credit:write'), createComment);
router.get('/applications/:id/score-status', requirePermission('credit:read'), getScoreStatus);
router.post('/applications/:id/rescore', requirePermission('credit:write'), rescoreApplication);

// ── Direct comment routes ───────────────────────────────────────────
// PATCH  /comments/:commentId — edit comment
// DELETE /comments/:commentId — soft-delete comment

router.patch('/comments/:commentId', requirePermission('credit:write'), updateComment);
router.delete('/comments/:commentId', requirePermission('credit:write'), deleteComment);

export default router;