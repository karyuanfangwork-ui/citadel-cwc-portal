import { z } from 'zod';

// ============================================================================
// Committee Meeting validators
// ============================================================================

export const createMeetingSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    scheduledAt: z.coerce.date(),
    location: z.string().max(200).optional(),
    quorumMin: z.number().int().min(1).default(3),
    meetingType: z.enum(['REGULAR', 'ADHOC']).default('REGULAR'),
  }),
});

export const updateMeetingSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    scheduledAt: z.coerce.date().optional(),
    location: z.string().max(200).optional().nullable(),
    status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
    quorumMin: z.number().int().min(1).optional(),
    meetingType: z.enum(['REGULAR', 'ADHOC']).optional(),
  }),
});

// ============================================================================
// Committee Member validators
// ============================================================================

export const addMemberSchema = z.object({
  body: z.object({
    userId: z.string().uuid(),
    role: z.enum(['CHAIR', 'MEMBER', 'SECRETARY']),
  }),
});

export const updateAttendanceSchema = z.object({
  body: z.object({
    attendance: z.enum(['PRESENT', 'ABSENT', 'EXCUSED']),
  }),
});

// ============================================================================
// Committee Agenda Item validators
// ============================================================================

export const addAgendaItemSchema = z.object({
  body: z.object({
    applicationId: z.string().uuid(),
    displayOrder: z.number().int().min(1),
    decisionType: z.enum(['APPROVE', 'REJECT', 'DEFER']).default('APPROVE'),
    presentedById: z.string().uuid().optional().nullable(),
  }),
});

export const reorderAgendaSchema = z.object({
  body: z.object({
    itemIds: z.array(z.string().uuid()).min(1),
  }),
});

// ============================================================================
// Committee Vote validators
// ============================================================================

export const castVoteSchema = z.object({
  body: z.object({
    memberId: z.string().uuid(),
    vote: z.enum(['APPROVE', 'REJECT', 'ABSTAIN']),
    comments: z.string().max(5000).optional(),
  }),
});

// ============================================================================
// List meetings query validator
// ============================================================================

export const listMeetingsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
    meetingType: z.enum(['REGULAR', 'ADHOC']).optional(),
  }),
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>['body'];
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>['body'];
export type AddMemberInput = z.infer<typeof addMemberSchema>['body'];
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>['body'];
export type AddAgendaItemInput = z.infer<typeof addAgendaItemSchema>['body'];
export type CastVoteInput = z.infer<typeof castVoteSchema>['body'];