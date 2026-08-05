import { Router } from 'express';
import { announcementController, uploadDocMiddleware, uploadImageMiddleware } from '../controllers/announcement.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createAnnouncementSchema, updateAnnouncementSchema } from '../validators/announcement.validator';

const router = Router();

// ── All routes require authentication ────────────────────────────────────
router.use(authenticate);

// ── Specific routes MUST come before /:id (route order matters) ───────────

/**
 * GET /announcements/dashboard
 * Pinned + latest announcements for dashboard widget
 * All authenticated users
 */
router.get('/dashboard', announcementController.dashboard);

/**
 * GET /announcements/unread-count
 * Unread count for badge display
 * All authenticated users
 */
router.get('/unread-count', announcementController.unreadCount);

/**
 * POST /announcements/mark-all-read
 * Mark all announcements as read for the current user
 * All authenticated users
 */
router.post('/mark-all-read', announcementController.markAllAsRead);

/**
 * POST /announcements/parse-doc
 * Upload a PDF or DOCX, extract text, store file in S3
 * Requires: announcement:write
 */
router.post(
  '/parse-doc',
  requirePermission('announcement:write'),
  uploadDocMiddleware,
  announcementController.parseDoc,
);

/**
 * POST /announcements/upload-image
 * Upload an image (JPEG/PNG/GIF/WebP) for use in rich text content
 * Requires: announcement:write
 */
router.post(
  '/upload-image',
  requirePermission('announcement:write'),
  uploadImageMiddleware,
  announcementController.uploadImage,
);

/**
 * GET /announcements/admin/all
 * List ALL announcements including drafts (admin view)
 * Requires announcement:write
 */
router.get('/admin/all', requirePermission('announcement:write'), announcementController.adminList);

/**
 * GET /announcements/admin/trash
 * List soft-deleted announcements (trash view)
 * Requires announcement:admin
 */
router.get('/admin/trash', requirePermission('announcement:admin'), announcementController.trashList);

/**
 * GET /announcements
 * List published, non-expired announcements
 * All authenticated users
 */
router.get('/', announcementController.list);

/**
 * GET /announcements/:id
 * Get single announcement (auto-marks as read)
 * All authenticated users
 */
router.get('/:id', announcementController.getOne);

/**
 * POST /announcements
 * Create a new announcement (draft or published)
 * Requires announcement:write
 */
router.post('/', requirePermission('announcement:write'), validate(createAnnouncementSchema), announcementController.create);

/**
 * POST /announcements/:id/read
 * Explicitly mark announcement as read
 * All authenticated users
 */
router.post('/:id/read', announcementController.markAsRead);

/**
 * PATCH /announcements/:id
 * Update an announcement
 * Requires announcement:write
 */
router.patch('/:id', requirePermission('announcement:write'), validate(updateAnnouncementSchema), announcementController.update);

/**
 * PATCH /announcements/:id/publish
 * Publish a draft announcement
 * Requires announcement:write
 */
router.patch('/:id/publish', requirePermission('announcement:write'), announcementController.publish);

/**
 * PATCH /announcements/:id/pin
 * Toggle pin status
 * Requires announcement:write
 */
router.patch('/:id/pin', requirePermission('announcement:write'), announcementController.togglePin);

/**
 * DELETE /announcements/:id
 * Soft delete an announcement
 * Requires announcement:admin
 */
router.delete('/:id', requirePermission('announcement:admin'), announcementController.delete);

/**
 * PATCH /announcements/:id/restore
 * Restore a soft-deleted announcement
 * Requires announcement:admin
 */
router.patch('/:id/restore', requirePermission('announcement:admin'), announcementController.restore);

export default router;