import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { sseAuth } from '../middleware/auth.middleware';

const router = Router();

/**
 * @route   GET /api/v1/notifications/stream
 * @desc    SSE stream for real-time notifications
 * @access  Private (auth via ?token= query param for EventSource compatibility)
 *
 * Note: This route uses sseAuth instead of the standard authenticate middleware
 * because EventSource cannot send HTTP-only cookies or custom headers.
 * The token is passed as ?token=<jwt> query parameter.
 */
router.get('/stream', sseAuth, notificationController.streamNotifications);

export default router;
