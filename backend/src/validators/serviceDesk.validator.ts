import { z } from 'zod';

export const createServiceDeskSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
        code: z.string()
            .min(3, 'Code must be at least 3 characters')
            .max(20, 'Code must be at most 20 characters')
            .regex(/^[A-Z0-9_]+$/, 'Code must contain only uppercase letters, numbers, and underscores'),
        description: z.string().optional(),
        isActive: z.boolean().default(true),
    }),
});

export const updateServiceDeskSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Name cannot be empty').max(100, 'Name must be at most 100 characters').optional(),
        code: z.string()
            .min(3, 'Code must be at least 3 characters')
            .max(20, 'Code must be at most 20 characters')
            .regex(/^[A-Z0-9_]+$/, 'Code must contain only uppercase letters, numbers, and underscores')
            .optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
    }),
});

export const createCategorySchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
        description: z.string().optional(),
        icon: z.string().optional(),
        colorClass: z.string().optional(),
        displayOrder: z.number().default(0),
        isActive: z.boolean().default(true),
    }),
});

export const updateCategorySchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Name cannot be empty').max(100, 'Name must be at most 100 characters').optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        colorClass: z.string().optional(),
        displayOrder: z.number().optional(),
        isActive: z.boolean().optional(),
    }),
});

export const createRequestTypeSchema = z.object({
    body: z.object({
        categoryId: z.string().uuid('Invalid category ID'),
        name: z.string().min(1, 'Name is required').max(150, 'Name must be at most 150 characters'),
        description: z.string().optional(),
        icon: z.string().default('bolt'),
        requiresApproval: z.boolean().default(false),
        slaHours: z.number().positive('SLA hours must be positive').optional(),
        requiredRole: z.string().optional(),
        formConfig: z.array(z.any()).optional(),
    }),
});

export const updateRequestTypeSchema = z.object({
    body: z.object({
        categoryId: z.string().uuid('Invalid category ID').optional(),
        name: z.string().min(1, 'Name cannot be empty').max(150, 'Name must be at most 150 characters').optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        requiresApproval: z.boolean().optional(),
        slaHours: z.number().positive('SLA hours must be positive').optional(),
        requiredRole: z.string().optional(),
        formConfig: z.array(z.any()).optional(),
    }),
});