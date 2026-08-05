import { z } from 'zod';

export const createRelatedPartyGroupSchema = z.object({
  body: z.object({
    name: z.string().max(255),
    description: z.string().optional().nullable(),
    relationshipType: z.string().max(100).optional().nullable(),
  }),
});

export const updateRelatedPartyGroupSchema = z.object({
  body: z.object({
    name: z.string().max(255).optional(),
    description: z.string().optional().nullable(),
    relationshipType: z.string().max(100).optional().nullable(),
  }),
});

export const addRelatedPartyMemberSchema = z.object({
  body: z.object({
    borrowerProfileId: z.string().uuid(),
    role: z.string().max(100).optional().nullable(),
  }),
});

export type CreateRelatedPartyGroupInput = z.infer<typeof createRelatedPartyGroupSchema>['body'];
export type UpdateRelatedPartyGroupInput = z.infer<typeof updateRelatedPartyGroupSchema>['body'];
export type AddRelatedPartyMemberInput = z.infer<typeof addRelatedPartyMemberSchema>['body'];