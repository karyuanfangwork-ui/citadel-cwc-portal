import { z } from 'zod';

const announcementCategoryEnum = z.enum(['HR', 'MARKETING', 'IT', 'GENERAL', 'FINANCE', 'POLICY']);
const announcementPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const targetAudienceEnum = z.enum(['ALL', 'IT_ONLY', 'HR_ONLY', 'FINANCE_ONLY', 'MANAGEMENT']);

// Flexible expiresAt: accepts ISO datetime, date-only string, null, or undefined.
// Normalises to a full ISO datetime string or null.
const expiresAtField = z.preprocess(
  (val: unknown) => {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'string') return new Date(val).toISOString();
    return val;
  },
  z.string().nullable().optional(),
);

export const createAnnouncementSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(500),
    content: z.string().min(1, 'Content is required'),
    category: announcementCategoryEnum.default('GENERAL'),
    priority: announcementPriorityEnum.default('MEDIUM'),
    targetAudience: targetAudienceEnum.default('ALL'),
    isPinned: z.boolean().default(false),
    isPublished: z.boolean().default(false),
    expiresAt: expiresAtField,
    attachmentUrl: z.string().max(1000).optional().nullable(),
  }),
});

export const updateAnnouncementSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(500).optional(),
    content: z.string().min(1).optional(),
    category: announcementCategoryEnum.optional(),
    priority: announcementPriorityEnum.optional(),
    targetAudience: targetAudienceEnum.optional(),
    isPinned: z.boolean().optional(),
    isPublished: z.boolean().optional(),
    expiresAt: expiresAtField,
    attachmentUrl: z.string().max(1000).optional().nullable(),
  }),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>['body'];
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>['body'];
export type TargetAudience = z.infer<typeof targetAudienceEnum>;