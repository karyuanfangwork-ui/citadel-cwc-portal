import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { broadcast } from '../utils/sseClients';

export interface ListAnnouncementsOptions {
  page?: number;
  limit?: number;
  category?: string;
  priority?: string;
  search?: string;
  publishedOnly?: boolean;
  unpublishedOnly?: boolean;
}

export interface DashboardAnnouncementsOptions {
  userId: string;
  limit?: number;
}

class AnnouncementService {
  /**
   * List announcements with pagination, filtering, and search.
   * For non-admin users, only shows published + non-expired by default.
   */
  async listAnnouncements(options: ListAnnouncementsOptions) {
    const {
      page = 1,
      limit = 20,
      category,
      priority,
      search,
      publishedOnly = true,
      unpublishedOnly = false,
    } = options;

    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (publishedOnly && !unpublishedOnly) {
      where.isPublished = true;
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ];
    } else if (unpublishedOnly && !publishedOnly) {
      where.isPublished = false;
    }
    // If neither flag is set, or both are set, show everything (no isPublished filter)

    if (category) {
      where.category = category;
    }

    if (priority) {
      where.priority = priority;
    }

    if (search) {
      // Add search to the existing where clause
      const searchFilter = {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { content: { contains: search, mode: 'insensitive' as const } },
        ],
      };

      if (publishedOnly && !unpublishedOnly) {
        // Combine with existing OR clause for expiresAt
        where.AND = [searchFilter];
      } else {
        Object.assign(where, searchFilter);
      }
    }

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { isPinned: 'desc' },
          { publishedAt: 'desc' },
        ],
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
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get pinned + latest announcements for dashboard widget.
   * Includes read status for the requesting user.
   */
  async getDashboardAnnouncements(options: DashboardAnnouncementsOptions) {
    const { userId, limit = 5 } = options;

    // Get pinned announcements (always shown)
    const pinned = await prisma.announcement.findMany({
      where: {
        isPublished: true,
        deletedAt: null,
        isPinned: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
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
        isPublished: true,
        deletedAt: null,
        isPinned: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
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

  /**
   * Get a single announcement by ID. Creates a read record for the user.
   */
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

  /**
   * Create a new announcement.
   */
  async createAnnouncement(data: {
    title: string;
    content: string;
    excerpt?: string;
    category?: string;
    priority?: string;
    targetAudience?: string;
    isPinned?: boolean;
    isPublished?: boolean;
    expiresAt?: string | null;
    attachmentUrl?: string | null;
    authorId: string;
  }) {
    const announcement = await prisma.announcement.create({
      data: {
        title: data.title,
        content: data.content,
        excerpt: data.excerpt || null,
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

    // Broadcast SSE event if published
    if (data.isPublished) {
      this.broadcastNewAnnouncement(announcement.id, announcement.title, announcement.category);
    }

    return announcement;
  }

  /**
   * Update an announcement.
   */
  async updateAnnouncement(id: string, data: {
    title?: string;
    content?: string;
    excerpt?: string | null;
    category?: string;
    priority?: string;
    targetAudience?: string;
    isPinned?: boolean;
    isPublished?: boolean;
    expiresAt?: string | null;
    attachmentUrl?: string | null;
  }) {
    const updateData: any = { ...data };
    if (data.expiresAt !== undefined) {
      updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    }
    if (data.excerpt !== undefined) {
      updateData.excerpt = data.excerpt || null;
    }

    // Set publishedAt when transitioning to published
    if (data.isPublished === true) {
      const existing = await prisma.announcement.findUnique({ where: { id }, select: { publishedAt: true } });
      if (!existing?.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    return prisma.announcement.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  /**
   * Publish a draft announcement.
   */
  async publishAnnouncement(id: string) {
    const announcement = await prisma.announcement.update({
      where: { id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    this.broadcastNewAnnouncement(announcement.id, announcement.title, announcement.category);
    return announcement;
  }

  /**
   * Soft-delete an announcement.
   */
  async deleteAnnouncement(id: string) {
    return prisma.announcement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Toggle pin status.
   */
  async togglePin(id: string, isPinned: boolean) {
    return prisma.announcement.update({
      where: { id },
      data: { isPinned },
    });
  }

  /**
   * Mark an announcement as read for a user.
   */
  async markAsRead(announcementId: string, userId: string) {
    return prisma.announcementRead.upsert({
      where: {
        announcementId_userId: { announcementId, userId },
      },
      update: {},
      create: { announcementId, userId },
    });
  }

  /**
   * Mark all announcements as read for a user.
   */
  async markAllAsRead(userId: string) {
    // Get all published, non-expired announcement IDs the user hasn't read
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
      })),
      skipDuplicates: true,
    });

    return { count: unreadIds.length };
  }

  /**
   * Get unread count for a user.
   */
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

  /**
   * Broadcast new announcement via SSE.
   */
  private broadcastNewAnnouncement(id: string, title: string, category: string) {
    try {
      broadcast('announcement:new', {
        id,
        title,
        category,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.warn('Failed to broadcast announcement SSE event', err);
    }
  }
}

export const announcementService = new AnnouncementService();