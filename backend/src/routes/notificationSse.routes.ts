import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { sseAuth } from '../middleware/auth.middleware';

const router = Router();

/**
 * @route   GET /api/v1/notifications/stream
 * @desc    SSE stream for real-time notifications
 * @access  Private (auth via HttpOnly cookie preferred, Authorization header, or deprecated ?token= query param)
 *
 * P1-02: Cookie-based auth (withCredentials) is the primary method.
 * Query-param ?token= is retained as a deprecated fallback.
 */
router.get('/stream', sseAuth, notificationController.streamNotifications);

export default router;
