import { z } from 'zod';

export const updateProfileSchema = z.object({
    body: z.object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        phone: z.string().optional(),
        avatarUrl: z.string().url().optional(),
        department: z.string().optional(),
        jobTitle: z.string().optional(),
    }),
});

export const updateUserSchema = z.object({
    body: z.object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        phone: z.string().optional(),
        department: z.string().optional(),
        jobTitle: z.string().optional(),
        isActive: z.boolean().optional(),
        managerId: z.string().uuid().optional(),
    }),
});
