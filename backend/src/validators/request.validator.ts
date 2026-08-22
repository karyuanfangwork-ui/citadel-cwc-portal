import { z } from 'zod';
import { RequestPriority } from '@prisma/client';


export const createRequestSchema = z.object({
    body: z.object({
        requestTypeId: z.string().uuid('Request type is required'),
        serviceDeskId: z.string().uuid('Service desk is required'),
        formVersion: z.number().int().positive(),
        summary: z.string().max(500).optional().default(''),
        description: z.string().optional(),
        priority: z.nativeEnum(RequestPriority).optional(),
        customFields: z.record(z.any()).optional(),
        // Accepted only as a compatibility assertion; the server policy ignores it.
        isConfidential: z.boolean().optional(),
    }).strict(),
});

export const updateRequestSchema = z.object({
    body: z.object({
        summary: z.string().min(1).max(500).optional(),
        description: z.string().optional(),
        priority: z.nativeEnum(RequestPriority).optional(),
        customFields: z.record(z.any()).optional(),
    }),
});

export const addActivitySchema = z.object({
    body: z.object({
        message: z.string().min(1, 'Message is required'),
        isInternal: z.boolean().optional(),
    }),
});

export const assignRequestSchema = z.object({
    body: z.object({
        assignedToId: z.string().uuid('Invalid user ID'),
    }),
});

export const updateStatusSchema = z.object({
    body: z.object({
        status: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,99}$/, 'Invalid status code'),
    }),
});
