import { z } from 'zod';

const dateField = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable()
  .transform(v => v ?? undefined);

export const createDirectorSchema = z.object({
  body: z.object({
    contactId: z.string().uuid().optional().nullable(),
    name: z.string().max(255),
    nricPassport: z.string().max(50).optional().nullable(),
    position: z.string().max(100).optional().nullable(),
    appointmentDate: dateField,
    resignationDate: dateField,
    isExecutive: z.boolean().default(false),
  }),
});

export const updateDirectorSchema = z.object({
  body: z.object({
    contactId: z.string().uuid().optional().nullable(),
    name: z.string().max(255).optional(),
    nricPassport: z.string().max(50).optional().nullable(),
    position: z.string().max(100).optional().nullable(),
    appointmentDate: dateField,
    resignationDate: dateField,
    isExecutive: z.boolean().optional(),
  }),
});

export type CreateDirectorInput = z.infer<typeof createDirectorSchema>['body'];
export type UpdateDirectorInput = z.infer<typeof updateDirectorSchema>['body'];