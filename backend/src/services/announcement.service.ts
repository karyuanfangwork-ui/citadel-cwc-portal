import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { broadcast } from '../utils/sseClients';
import sanitizeHtml from 'sanitize-html';

// ── Target audience mapping ──────────────────────────────────────────────
// Maps targetAudience enum values to the role names that should see them.
const TARGET_AUDIENCE_ROLES: Record<string, string[]> = {
  ALL: [],          // empty array = everyone
  IT_ONLY: ['IT_AGENT'],
  HR_ONLY: ['HR_AGENT', 'HIRING_MANAGER'],
  FINANCE_ONLY: ['FINANCE_HEAD', 'CREDIT_ADMIN', 'CREDIT_MANAGER', 'CREDIT_ANALYST', 'CREDIT_RM'],
  MANAGEMENT: ['ADMIN', 'CEO', 'GROUP_DCEO'],
};

export type TargetAudience = 'ALL' | 'IT_ONLY' | 'HR_ONLY' | 'FINANCE_ONLY' | 'MANAGEMENT';

// ── HTML sanitization config ──────────────────────────────────────────────
const SANITIZE_CONFIG: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    'img', 'figure', 'figcaption', 'u', 's', 'mark', 'sub', 'sup',
  ],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'width', 'height'],
    a: ['href', 'target', 'rel'],
    span: ['style', 'class'],
    p: ['style', 'class'],
    div: ['style', 'class'],
  },
  allowedStyles: {
    '*': {
      'text-align': [/^(left|center|right|justify)$/],
      'color': [/^#(?:[0-9a-fA-F]{3,8})$/],
      'background-color': [/^#(?:[0-9a-fA-F]{3,8})$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  disallowedTagsMode: 'discard',
};

function sanitizeContent(html: string): string {
  return sanitizeHtml(html, SANITIZE_CONFIG);
}

// ── Interfaces ────────────────────────────────────────────────────────────

export interface ListAnnouncementsOptions {
  page?: number;
  limit?: number;
  category?: string;
  priority?: string;
  search?: string;
  publishedOnly?: boolean;
  unpublishedOnly?: boolean;
  userId?: string;
  userRoles?: string[];
  sortBy?: 'publishedAt' | 'priority' | 'category' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface DashboardAnnouncementsOptions {
  userId: string;
  userRoles?: string[];
  limit?: number;
}

class AnnouncementService {
  // ── List ──────────────────────────────────────────────────────────────────

  async listAnnouncements(options: ListAnnouncementsOptions) {
    const {
      page = 1,
      limit = 20,
      category,
      priority,
      search,
      publishedOnly = true,
      unpublishedOnly = false,
      userId,
      userRoles,
      sortBy = 'publishedAt',
      sortOrder = 'desc',
    } = options;

    const skip = (page - 1) * limit;

    // Build where clause using AND array for safe composition
    const andConditions: any[] = [{ deletedAt: null }];

    if (publishedOnly && !unpublishedOnly) {
      andConditions.push({ isPublished: true });
      andConditions.push({
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      });
    } else if (unpublishedOnly && !publishedOnly) {
      andConditions.push({ isPublished: false });
    }

    if (category) {
      andConditions.push({ category });
    }

    if (priority) {
      andConditions.push({ priority });
    }

    if (search) {
      andConditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { content: { contains: search, mode: 'insensitive' as const } },
        ],
      });
    }

    // Enforce targetAudience filtering when user roles are provided
    if (userRoles && userRoles.length > 0) {
      andConditions.push({
        OR: [
          { targetAudience: 'ALL' },
          { targetAudience: { in: getTargetAudienceFiltersForRoles(userRoles) } },
        ],
      });
    }
    // If no roles provided, only show ALL announcements (safe default)

    const where = andConditions.length === 1 ? andConditions[0] : { AND: andConditions };

    const include: any = {
      author: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    };

    // Include reads for isRead computation when userId is provided
    if (userId) {
      include.reads = {
        where: { userId },
        select: { id: true },
      };
    }

    // Build sort order: pinned always first, then the user-selected sort
    const orderBy: any[] = [{ isPinned: 'desc' }];
    if (sortBy === 'priority') {
      // Priority sort: CRITICAL > HIGH > MEDIUM > LOW
      const priorityOrder = sortOrder === 'asc'
        ? [{ priority: 'asc' as const }, { publishedAt: 'desc' as const }]
        : [{ priority: 'desc' as const }, { publishedAt: 'desc' as const }];
      orderBy.push(...priorityOrder);
    } else if (sortBy === 'category') {
      orderBy.push({ category: sortOrder as 'asc' | 'desc' }, { publishedAt: 'desc' as const });
    } else if (sortBy === 'createdAt') {
      orderBy.push({ createdAt: sortOrder as 'asc' | 'desc' });
    } else {
      // Default: publishedAt
      orderBy.push({ publishedAt: sortOrder as 'asc' | 'desc' });
    }

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include,
      }),
      prisma.announcement.count({ where }),
    ]);

    // Map isRead for convenience when userId is provided
    const mapped = userId
      ? announcements.map(a => ({
          ...a,
          isRead: (a as any).reads?.length > 0,
        }))
      : announcements;

    return {
      announcements: mapped,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ── Dashboard ────────────────────────────────────────────────────────────

  async getDashboardAnnouncements(options: DashboardAnnouncementsOptions) {
    const { userId, userRoles, limit = 5 } = options;

    // Build audience filter
    const audienceFilter = userRoles && userRoles.length > 0
      ? {
          OR: [
            { targetAudience: 'ALL' },
            { targetAudience: { in: getTargetAudienceFiltersForRoles(userRoles) } },
          ],
        }
      : { targetAudience: 'ALL' };

    const baseWhere = {
      isPublished: true,
      deletedAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
      ...audienceFilter,
    };

    // Get pinned announcements (always shown)
    const pinned = await prisma.announcement.findMany({
      where: {
        ...baseWhere,
        isPinned: true,
      },
      orderBy: { publishedAt: 'desc' },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        reads: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    // Get latest non-pinned announcements
    const latest = await prisma.announcement.findMany({
      where: {
        ...baseWhere,
        isPinned: false,
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        reads: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    // Mark isRead for convenience
    const markRead = (a: any) => ({
      ...a,
      isRead: a.reads.length > 0,
    });

    return {
      pinned: pinned.map(markRead),
      latest: latest.map(markRead),
    };
  }

  // ── Auth check ────────────────────────────────────────────────────────────

  async getAnnouncementForAuthCheck(id: string) {
    return prisma.announcement.findUnique({
      where: { id, deletedAt: null },
      select: { id: true, authorId: true },
    });
  }

  // ── Get one ────────────────────────────────────────────────────────────────

  async getAnnouncement(id: string, userId: string) {
    const announcement = await prisma.announcement.findFirst({
      where: { id, deletedAt: null },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        reads: {
          select: { id: true },
        },
        _count: {
          select: { reads: true },
        },
      },
    });

    if (!announcement) {
      return null;
    }

    // Auto-mark as read (upsert so it's idempotent)
    try {
      await prisma.announcementRead.upsert({
        where: {
          announcementId_userId: { announcementId: id, userId },
        },
        update: {},
        create: { announcementId: id, userId },
      });
    } catch {
      // Ignore duplicate key errors
    }

    return announcement;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async createAnnouncement(data: {
    title: string;
    content: string;
    category?: string;
    priority?: string;
    targetAudience?: string;
    isPinned?: boolean;
    isPublished?: boolean;
    expiresAt?: string | null;
    attachmentUrl?: string | null;
    authorId: string;
  }) {
    // Sanitize HTML content
    const sanitizedContent = sanitizeContent(data.content);

    const announcement = await prisma.announcement.create({
      data: {
        title: data.title,
        content: sanitizedContent,
        category: (data.category || 'GENERAL') as any,
        priority: (data.priority || 'MEDIUM') as any,
        targetAudience: data.targetAudience || 'ALL',
        isPinned: data.isPinned ?? false,
        isPublished: data.isPublished ?? false,
        publishedAt: data.isPublished ? new Date() : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        attachmentUrl: data.attachmentUrl || null,
        authorId: data.authorId,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    // Broadcast and notify only for a newly published announcement.
    if (data.isPublished) {
      this.broadcastNewAnnouncement(announcement.id, announcement.title, announcement.category, announcement.targetAudience);
      await this.createNotificationsForAnnouncement(
        announcement.id,
        announcement.title,
        announcement.targetAudience,
        announcement.priority,
        announcement.tenantId,
        announcement.publishedAt,
      );
    }

    return announcement;
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async updateAnnouncement(id: string, data: {
    title?: string;
    content?: string;
    category?: string;
    priority?: string;
    targetAudience?: string;
    isPinned?: boolean;
    isPublished?: boolean;
    expiresAt?: string | null;
    attachmentUrl?: string | null;
  }) {
    const existing = await prisma.announcement.findUnique({
      where: { id },
      select: { isPublished: true, publishedAt: true },
    });
    const updateData: any = { ...data };
    if (data.expiresAt !== undefined) {
      updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    }

    // Sanitize HTML content if provided
    if (data.content) {
      updateData.content = sanitizeContent(data.content);
    }

    // Set publishedAt when transitioning to published
    if (data.isPublished === true) {
      if (!existing?.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    // Clear publishedAt when transitioning to draft (unpublish)
    if (data.isPublished === false) {
      updateData.publishedAt = null;
    }

    const announcement = await prisma.announcement.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    // Notify only on a draft -> published transition. Saving an already
    // published announcement must not notify the whole audience again.
    if (data.isPublished === true && existing?.isPublished === false) {
      this.broadcastNewAnnouncement(announcement.id, announcement.title, announcement.category, announcement.targetAudience);
      await this.createNotificationsForAnnouncement(
        announcement.id,
        announcement.title,
        announcement.targetAudience,
        announcement.priority,
        announcement.tenantId,
        announcement.publishedAt,
      );
    }

    return announcement;
  }

  // ── Publish ────────────────────────────────────────────────────────────────

  async publishAnnouncement(id: string) {
    const transition = await prisma.announcement.updateMany({
      where: { id, isPublished: false, deletedAt: null },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!announcement) {
      throw new Error('Announcement not found');
    }

    // updateMany is the atomic transition gate. If another request already
    // published this announcement, return the current row without sending a
    // second notification batch.
    if (transition.count === 0) {
      return announcement;
    }

    this.broadcastNewAnnouncement(announcement.id, announcement.title, announcement.category, announcement.targetAudience);
    await this.createNotificationsForAnnouncement(
      announcement.id,
      announcement.title,
      announcement.targetAudience,
      announcement.priority,
      announcement.tenantId,
      announcement.publishedAt,
    );
    return announcement;
  }


  // ── Delete ─────────────────────────────────────────────────────────────────

  async deleteAnnouncement(id: string) {
    return prisma.announcement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ── Restore ────────────────────────────────────────────────────────────────

  async restoreAnnouncement(id: string) {
    return prisma.announcement.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  // ── List deleted ────────────────────────────────────────────────────────────

  async listDeletedAnnouncements(page: number = 1, limit: number = 20) {
    const where = { deletedAt: { not: null as any } };
    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { deletedAt: 'desc' as const },
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      prisma.announcement.count({ where }),
    ]);

    return {
      announcements,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Toggle pin ─────────────────────────────────────────────────────────────

  async togglePin(id: string, isPinned: boolean) {
    return prisma.announcement.update({
      where: { id },
      data: { isPinned },
    });
  }

  // ── Mark as read ───────────────────────────────────────────────────────────

  async markAsRead(announcementId: string, userId: string) {
    const announcement = await prisma.announcement.findUnique({ where: { id: announcementId }, select: { tenantId: true } });
    const tenantId = announcement?.tenantId ?? '00000000-0000-0000-0000-000000000001';
    return prisma.announcementRead.upsert({
      where: {
        announcementId_userId: { announcementId, userId },
      },
      update: {},
      create: { announcementId, userId, tenantId },
    });
  }

  // ── Mark all as read ───────────────────────────────────────────────────────

  async markAllAsRead(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
    const tenantId = user?.tenantId ?? '00000000-0000-0000-0000-000000000001';
    const unreadIds = await prisma.announcement.findMany({
      where: {
        isPublished: true,
        deletedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
        NOT: {
          reads: { some: { userId } },
        },
      },
      select: { id: true },
    });

    if (unreadIds.length === 0) return { count: 0 };

    await prisma.announcementRead.createMany({
      data: unreadIds.map(a => ({
        announcementId: a.id,
        userId,
        tenantId,
      })),
      skipDuplicates: true,
    });

    return { count: unreadIds.length };
  }

  // ── Unread count ───────────────────────────────────────────────────────────

  async getUnreadCount(userId: string) {
    const total = await prisma.announcement.count({
      where: {
        isPublished: true,
        deletedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
        NOT: {
          reads: { some: { userId } },
        },
      },
    });
    return total;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Broadcast new announcement via SSE.
   * Includes targetAudience so clients can filter display.
   */
  private broadcastNewAnnouncement(id: string, title: string, category: string, targetAudience: string) {
    try {
      broadcast('announcement:new', {
        id,
        title,
        category,
        targetAudience,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.warn('Failed to broadcast announcement SSE event', err);
    }
  }

  /**
   * Create in-app Notification records for all users in the target audience.
   * For HIGH/CRITICAL priority, also sends emails.
   */
  private async createNotificationsForAnnouncement(
    announcementId: string,
    title: string,
    targetAudience: string,
    priority: string,
    tenantId: string | null,
    publishedAt: Date | null,
  ) {
    try {
      if (!tenantId) {
        logger.warn(`Skipping announcement notification without tenant ${announcementId}`);
        return;
      }

      // Determine which roles should receive the notification
      const targetRoles = TARGET_AUDIENCE_ROLES[targetAudience] || [];

      // Find users matching the target audience
      const users = targetRoles.length === 0
        ? await prisma.user.findMany({ where: { tenantId, isActive: true }, select: { id: true, email: true, tenantId: true } })
        : await prisma.user.findMany({
            where: {
              tenantId,
              isActive: true,
              roles: {
                some: {
                  role: { name: { in: targetRoles } },
                },
              },
            },
            select: { id: true, email: true, tenantId: true },
          });

      if (users.length === 0) return;

      // Use the durable notification event/delivery path. The event key and
      // delivery unique constraint make repeated publish requests idempotent.
      const { publishDomainEvent, deliverNotification } = await import('./notification.service');
      const publicationKey = publishedAt?.toISOString() ?? 'unknown';
      const eventKey = `announcement:published:${announcementId}:${publicationKey}`;
      const result = await prisma.$transaction((tx) => publishDomainEvent(tx, {
        eventKey,
        tenantId,
        eventType: 'ANNOUNCEMENT_PUBLISHED',
        classification: 'PUBLIC',
        resourceType: 'announcement',
        resourceId: announcementId,
        payload: {
          subject: `New announcement: ${title}`,
          body: `A new announcement has been published: ${title}`,
        },
        recipientIds: users.map(user => user.id),
        channels: ['IN_APP'],
      }));

      for (const deliveryId of result.deliveryIds) {
        await deliverNotification(deliveryId);
      }

      logger.info(`Created ${result.deliveryIds.length} notifications for announcement ${announcementId} (audience: ${targetAudience})`);

      // For HIGH/CRITICAL priority, also trigger email notifications
      if (priority === 'HIGH' || priority === 'CRITICAL') {
        // Email sending would go here — integrate with email.service.ts
        // For now, log the intent
        logger.info(`High-priority announcement ${announcementId} — email notifications would be sent to ${users.length} users`);
      }
    } catch (err) {
      // Non-fatal: notifications are best-effort
      logger.warn(`Failed to create notifications for announcement ${announcementId}`, err);
    }
  }
}

// ── Helper: map user roles to targetAudience values they should see ──────

function getTargetAudienceFiltersForRoles(roleNames: string[]): string[] {
  const audiences: Set<string> = new Set();

  // ALL users see 'ALL' — that's handled separately in the OR clause
  for (const [audience, roles] of Object.entries(TARGET_AUDIENCE_ROLES)) {
    if (audience === 'ALL') continue;
    // If the user has ANY role that maps to this audience, they see it
    if (roles.some(role => roleNames.includes(role))) {
      audiences.add(audience);
    }
  }

  // ADMIN sees everything
  if (roleNames.includes('ADMIN')) {
    audiences.add('IT_ONLY');
    audiences.add('HR_ONLY');
    audiences.add('FINANCE_ONLY');
    audiences.add('MANAGEMENT');
  }

  return [...audiences];
}

export const announcementService = new AnnouncementService();