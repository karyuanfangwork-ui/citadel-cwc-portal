/**
 * P2-4: Application Comment Service
 * CRUD operations for threaded comments on credit applications.
 */

import prisma from '../../utils/prisma';


export interface CommentCreateInput {
  content: string;
  parentId?: string;
  isInternal?: boolean;
}

export interface CommentUpdateInput {
  content?: string;
  isInternal?: boolean;
}

/** Shape returned to the frontend (with author nested) */
interface CommentResponse {
  id: string;
  applicationId: string;
  parentId: string | null;
  authorId: string;
  content: string;
  isInternal: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };
  replies?: CommentResponse[];
}

function toResponse(c: any): CommentResponse {
  return {
    id: c.id,
    applicationId: c.applicationId,
    parentId: c.parentId,
    authorId: c.authorId,
    content: c.isDeleted ? '[This comment has been deleted]' : c.content,
    isInternal: c.isInternal,
    isDeleted: c.isDeleted,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    author: c.author
      ? {
          id: c.author.id,
          firstName: c.author.firstName,
          lastName: c.author.lastName,
          email: c.author.email,
          avatarUrl: c.author.avatarUrl,
        }
      : {
          id: c.authorId,
          firstName: 'Unknown',
          lastName: '',
          email: '',
          avatarUrl: null,
        },
    replies: c.replies ? c.replies.map(toResponse) : undefined,
  };
}

/**
 * List comments for an application (top-level + replies threaded).
 * Supports pagination.
 */
export async function listComments(
  applicationId: string,
  page: number = 1,
  limit: number = 50,
  includeInternal: boolean = true,
): Promise<{ comments: CommentResponse[]; total: number; page: number; totalPages: number }> {
  const where: any = {
    applicationId,
    parentId: null, // top-level only; replies are nested
    ...(includeInternal ? {} : { isInternal: false }),
    isDeleted: false,
  };

  const [total, rows] = await Promise.all([
    prisma.applicationComment.count({ where }),
    prisma.applicationComment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        author: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        replies: {
          where: { isDeleted: false, ...(includeInternal ? {} : { isInternal: false }) },
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
          },
        },
      },
    }),
  ]);

  return {
    comments: rows.map(toResponse),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Create a new comment (top-level or reply).
 */
export async function createComment(
  applicationId: string,
  authorId: string,
  data: CommentCreateInput,
): Promise<CommentResponse> {
  // If replying, verify parent belongs to this application
  if (data.parentId) {
    const parent = await prisma.applicationComment.findUnique({ where: { id: data.parentId } });
    if (!parent || parent.applicationId !== applicationId) {
      throw new Error('Parent comment not found in this application');
    }
    if (parent.isDeleted) {
      throw new Error('Cannot reply to a deleted comment');
    }
  }

  const comment = await prisma.applicationComment.create({
    data: {
      applicationId,
      authorId,
      content: data.content,
      parentId: data.parentId ?? null,
      isInternal: data.isInternal ?? true,
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
    },
  });

  return toResponse(comment);
}

/**
 * Update a comment (edit content or toggle internal/external).
 * Only the author can edit their own comment.
 */
export async function updateComment(
  commentId: string,
  userId: string,
  data: CommentUpdateInput,
): Promise<CommentResponse> {
  const existing = await prisma.applicationComment.findUnique({ where: { id: commentId } });
  if (!existing) throw new Error('Comment not found');
  if (existing.authorId !== userId) throw new Error('Only the author can edit this comment');
  if (existing.isDeleted) throw new Error('Cannot edit a deleted comment');

  const comment = await prisma.applicationComment.update({
    where: { id: commentId },
    data: {
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.isInternal !== undefined ? { isInternal: data.isInternal } : {}),
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
    },
  });

  return toResponse(comment);
}

/**
 * Soft-delete a comment. Only the author or an admin can delete.
 */
export async function deleteComment(commentId: string, userId: string, isAdmin: boolean): Promise<void> {
  const existing = await prisma.applicationComment.findUnique({ where: { id: commentId } });
  if (!existing) throw new Error('Comment not found');
  if (existing.authorId !== userId && !isAdmin) throw new Error('Not authorized to delete this comment');
  if (existing.isDeleted) return; // already deleted

  await prisma.applicationComment.update({
    where: { id: commentId },
    data: { isDeleted: true },
  });
}

/**
 * Get score status for an application (is the score outdated?).
 */
export async function getScoreStatus(applicationId: string): Promise<{
  lastScoreRunAt: string | null;
  lastFinancialsUpdatedAt: string | null;
  isOutdated: boolean;
}> {
  const app = await prisma.creditApplication.findUnique({
    where: { id: applicationId },
    select: {
      updatedAt: true,
      scoreRuns: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  if (!app) throw new Error('Application not found');

  const lastScoreRunAt = app.scoreRuns.length > 0 ? app.scoreRuns[0].createdAt.toISOString() : null;
  const lastFinancialsUpdatedAt = app.updatedAt.toISOString();

  // Score is outdated if financials were updated after the last score run
  const isOutdated = lastScoreRunAt
    ? new Date(lastFinancialsUpdatedAt) > new Date(lastScoreRunAt)
    : true; // no score run at all = outdated

  return { lastScoreRunAt, lastFinancialsUpdatedAt, isOutdated };
}

export default {
  listComments,
  createComment,
  updateComment,
  deleteComment,
  getScoreStatus,
};