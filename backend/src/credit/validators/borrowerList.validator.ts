import { z } from 'zod';

export const borrowerListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(20).max(100).default(20),
    search: z.string().trim().max(120).optional(),
    segment: z.enum(['INDIVIDUAL', 'SME', 'CORPORATE']).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
    relationshipOwnerId: z.string().uuid().optional(),
    hasActiveApplication: z.coerce.boolean().optional(),
    branchId: z.string().uuid().optional(),
    sortBy: z.enum(['name', 'segment', 'activeApplicationCount', 'totalExposure', 'status', 'updatedAt']).default('updatedAt'),
    sortDirection: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export type BorrowerListQuery = z.infer<typeof borrowerListQuerySchema>['query'];
