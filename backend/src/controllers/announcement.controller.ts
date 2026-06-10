import { Response } from 'express';
import multer from 'multer';
import * as crypto from 'crypto';
import * as path from 'path';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { announcementService } from '../services/announcement.service';
import { s3Service } from '../services/s3.service';
import { config } from '../config';
import { auditLog } from '../utils/audit';

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only PDF and DOCX files are supported'));
    }
    cb(null, true);
  },
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for images
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, GIF, and WebP images are supported'));
    }
    cb(null, true);
  },
});

export const uploadDocMiddleware = memoryUpload.single('file');
export const uploadImageMiddleware = imageUpload.single('image');

class AnnouncementController {
  /**
   * Check that the requesting user is the author of the announcement or has announcement:admin.
   * Throws 403 if neither condition is met.
   */
  private async requireAuthorOrAdmin(id: string, userId: string, permissions: string[]): Promise<void> {
    const isAdmin = permissions.includes('announcement:admin');
    if (isAdmin) return;

    const announcement = await announcementService.getAnnouncementForAuthCheck(id);
    if (!announcement) {
      throw new AppError('Announcement not found', 404);
    }
    if (announcement.authorId !== userId) {
      throw new AppError('You can only modify your own announcements', 403);
    }
  }

  /**
   * GET /announcements — List published announcements (for all authenticated users)
   */
  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const category = req.query.category as string | undefined;
    const priority = req.query.priority as string | undefined;
    const search = req.query.search as string | undefined;
    const sortBy = (req.query.sortBy as string || 'publishedAt') as 'publishedAt' | 'priority' | 'category' | 'createdAt';
    const sortOrder = (req.query.sortOrder as string || 'desc') as 'asc' | 'desc';

    const result = await announcementService.listAnnouncements({
      page,
      limit,
      category,
      priority,
      search,
      publishedOnly: true,
      userId: req.user!.id,
      userRoles: req.user!.roles,
      sortBy,
      sortOrder,
    });

    res.json({ status: 'success', data: result });
  });

  /**
   * GET /announcements/dashboard — Pinned + latest for dashboard widget
   */
  dashboard = asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await announcementService.getDashboardAnnouncements({
      userId: req.user!.id,
      userRoles: req.user!.roles,
      limit: 5,
    });

    res.json({ status: 'success', data: result });
  });

  /**
   * GET /announcements/unread-count — Get unread count for badge
   */
  unreadCount = asyncHandler(async (req: AuthRequest, res: Response) => {
    const count = await announcementService.getUnreadCount(req.user!.id);
    res.json({ status: 'success', data: { count } });
  });

  /**
   * GET /announcements/:id — Get single announcement (auto-marks as read)
   */
  getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const announcement = await announcementService.getAnnouncement(id, req.user!.id);

    if (!announcement) {
      throw new AppError('Announcement not found', 404);
    }

    res.json({ status: 'success', data: { announcement } });
  });

  /**
   * POST /announcements — Create announcement (announcement:write)
   */
  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { title, content, category, priority, targetAudience, isPinned, isPublished, expiresAt, attachmentUrl } = req.body;

    const announcement = await announcementService.createAnnouncement({
      title,
      content,
      category,
      priority,
      targetAudience,
      isPinned,
      isPublished,
      expiresAt,
      attachmentUrl,
      authorId: req.user!.id,
    });

    await auditLog(req, isPublished ? 'announcement.publish' : 'announcement.create', 'announcement', announcement.id, {
      title, category, priority, targetAudience, isPinned, isPublished,
    });

    res.status(201).json({ status: 'success', data: { announcement } });
  });

  /**
   * PATCH /announcements/:id — Update announcement (announcement:write)
   */
  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    await this.requireAuthorOrAdmin(id, req.user!.id, req.user!.permissions);
    const { title, content, category, priority, targetAudience, isPinned, isPublished, expiresAt, attachmentUrl } = req.body;

    const announcement = await announcementService.updateAnnouncement(id, {
      title,
      content,
      category,
      priority,
      targetAudience,
      isPinned,
      isPublished,
      expiresAt,
      attachmentUrl,
    });

    await auditLog(req, isPublished === false ? 'announcement.unpublish' : 'announcement.update', 'announcement', id, {
      title, category, priority, targetAudience, isPinned, isPublished,
    });

    res.json({ status: 'success', data: { announcement } });
  });

  /**
   * PATCH /announcements/:id/publish — Publish a draft
   */
  publish = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    await this.requireAuthorOrAdmin(id, req.user!.id, req.user!.permissions);
    const announcement = await announcementService.publishAnnouncement(id);
    await auditLog(req, 'announcement.publish', 'announcement', id, { isPublished: true });
    res.json({ status: 'success', data: { announcement } });
  });

  /**
   * PATCH /announcements/:id/pin — Toggle pin status
   */
  togglePin = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    await this.requireAuthorOrAdmin(id, req.user!.id, req.user!.permissions);
    const { isPinned } = req.body;
    const announcement = await announcementService.togglePin(id, isPinned ?? true);
    await auditLog(req, 'announcement.pin', 'announcement', id, { isPinned: isPinned ?? true });
    res.json({ status: 'success', data: { announcement } });
  });

  /**
   * POST /announcements/:id/read — Mark as read
   */
  markAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    await announcementService.markAsRead(id, req.user!.id);
    res.json({ status: 'success', data: null });
  });

  /**
   * POST /announcements/mark-all-read — Mark all announcements as read
   */
  markAllAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await announcementService.markAllAsRead(req.user!.id);
    res.json({ status: 'success', data: result });
  });

  /**
   * DELETE /announcements/:id — Soft delete (announcement:admin)
   */
  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    await announcementService.deleteAnnouncement(id);
    await auditLog(req, 'announcement.delete', 'announcement', id, {});
    res.json({ status: 'success', message: 'Announcement deleted successfully' });
  });

  /**
   * PATCH /announcements/:id/restore — Restore a soft-deleted announcement (announcement:admin)
   */
  restore = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const announcement = await announcementService.restoreAnnouncement(id);
    await auditLog(req, 'announcement.restore', 'announcement', id, {});
    res.json({ status: 'success', data: { announcement } });
  });

  /**
   * GET /announcements/admin/trash — List soft-deleted announcements (announcement:admin)
   */
  trashList = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const result = await announcementService.listDeletedAnnouncements(page, limit);
    res.json({ status: 'success', data: result });
  });

  // ── Admin endpoints ──────────────────────────────────────────────────

  /**
   * GET /announcements/admin/all — List ALL announcements including drafts (announcement:write)
   */
  adminList = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const category = req.query.category as string | undefined;
    const priority = req.query.priority as string | undefined;
    const search = req.query.search as string | undefined;
    const isPublishedParam = req.query.isPublished as string | undefined;
    const isPublished = isPublishedParam === 'true' ? true : isPublishedParam === 'false' ? false : undefined;
    const sortBy = (req.query.sortBy as string || 'publishedAt') as 'publishedAt' | 'priority' | 'category' | 'createdAt';
    const sortOrder = (req.query.sortOrder as string || 'desc') as 'asc' | 'desc';

    const result = await announcementService.listAnnouncements({
      page,
      limit,
      category,
      priority,
      search,
      // When filtering by isPublished: true → only published; false → only drafts; undefined → all
      publishedOnly: isPublished === true,
      unpublishedOnly: isPublished === false,
      userId: req.user!.id,
      sortBy,
      sortOrder,
    });

    res.json({ status: 'success', data: result });
  });

  /**
   * POST /announcements/parse-doc — Upload PDF/DOCX, extract text, store in S3
   */
  parseDoc = asyncHandler(async (req: AuthRequest, res: Response) => {
    const file = req.file as Express.Multer.File & { buffer: Buffer };
    if (!file) throw new AppError('No file provided', 400);

    const ext = path.extname(file.originalname).toLowerCase();
    let text = '';

    try {
      if (file.mimetype === 'application/pdf') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
        const result = await pdfParse(file.buffer);
        text = result.text?.trim() ?? '';
      } else {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        text = result.value?.trim() ?? '';
      }
    } catch {
      text = '';
    }

    // Upload original file to S3
    const key = `cwc/announcements/${crypto.randomUUID()}${ext}`;
    await s3Service.uploadBuffer(key, file.buffer, file.mimetype);

    const warning = text.length < 50 ? 'Could not extract readable text from document' : null;

    res.json({
      status: 'success',
      data: {
        text: text.length >= 50 ? text : '',
        filename: file.originalname,
        s3Key: key,
        warning,
      },
    });
  });

  /**
   * POST /announcements/upload-image — Upload JPEG/PNG for rich text, return S3 URL
   */
  uploadImage = asyncHandler(async (req: AuthRequest, res: Response) => {
    const file = req.file as Express.Multer.File & { buffer: Buffer };
    if (!file) throw new AppError('No file provided', 400);

    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const key = `cwc/announcements/images/${crypto.randomUUID()}${ext}`;
    await s3Service.uploadBuffer(key, file.buffer, file.mimetype);

    // Construct public URL: https://{bucket}.{endpoint}/{key}
    const endpoint = config.s3.endpoint.replace('https://', '').replace('http://', '');
    const imageUrl = `https://${config.s3.bucket}.${endpoint}/${key}`;

    res.json({ status: 'success', data: { url: imageUrl, key } });
  });
}

export const announcementController = new AnnouncementController();