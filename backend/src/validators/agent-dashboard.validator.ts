import { z } from 'zod';

const slaStates = ['BREACHED', 'DUE_SOON', 'ON_TRACK', 'PAUSED', 'NO_SLA', 'MET', 'MISSED', 'NOT_APPLICABLE', 'UNKNOWN'] as const;

export const agentDashboardQuerySchema = z.object({
  query: z.object({
    scope: z.enum(['mine', 'team', 'accessible']).default('mine'),
    queue: z.enum(['open', 'closed', 'all', 'unassigned']).default('open'),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().refine((value) => [25, 50, 100].includes(value), 'Limit must be 25, 50, or 100').default(25),
    search: z.string().trim().max(200).optional().transform((value) => value || undefined),
    requestTypeId: z.string().uuid().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    slaState: z.enum(slaStates).optional(),
    sort: z.enum(['urgency', 'created-desc', 'created-asc', 'updated-desc']).default('urgency'),
  }).strict(),
});

export type AgentDashboardValidatedQuery = z.infer<typeof agentDashboardQuerySchema>['query'];
