import { z } from 'zod';

export const createBranchSchema = z.object({
  body: z.object({
    code: z.string().min(1).max(20),
    name: z.string().min(1).max(255),
    region: z.string().max(100).optional().nullable(),
  }),
});

export const updateBranchSchema = z.object({
  body: z.object({
    code: z.string().min(1).max(20).optional(),
    name: z.string().min(1).max(255).optional(),
    region: z.string().max(100).optional().nullable(),
  }),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>['body'];
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>['body'];
