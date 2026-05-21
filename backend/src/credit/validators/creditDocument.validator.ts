import { z } from 'zod';
import { DocumentClass } from '@prisma/client';

// ---------------------------------------------------------------------------
// Document class enum for Zod validation
// ---------------------------------------------------------------------------
const documentClassValues = Object.values(DocumentClass) as [string, ...string[]];

// ---------------------------------------------------------------------------
// Credit Document validators
// ---------------------------------------------------------------------------

export const listCreditDocumentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    applicationId: z.string().uuid().optional(),
    borrowerProfileId: z.string().uuid().optional(),
    classification: z.enum(documentClassValues).optional(),
    isAvClean: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
    search: z.string().optional(),
  }),
});

export const uploadCreditDocumentSchema = z.object({
  body: z.object({
    borrowerProfileId: z.string().uuid(),
    applicationId: z.string().uuid().optional().nullable(),
    classification: z.enum(documentClassValues),
    description: z.string().max(1000).optional().nullable(),
  }),
});

export const updateCreditDocumentSchema = z.object({
  body: z.object({
    classification: z.enum(documentClassValues).optional(),
    description: z.string().max(1000).optional().nullable(),
  }),
});

export const replaceCreditDocumentSchema = z.object({
  body: z.object({
    changeSummary: z.string().max(500).optional().nullable(),
  }),
});

export const updateAvStatusSchema = z.object({
  body: z.object({
    isAvClean: z.boolean(),
    sha256Hash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  }),
});

// ---------------------------------------------------------------------------
// Document Requirement validators
// ---------------------------------------------------------------------------

export const listDocumentRequirementsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    isMandatory: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
    isCollected: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  }),
});

export const createDocumentRequirementSchema = z.object({
  body: z.object({
    applicationId: z.string().uuid(),
    documentClass: z.enum(documentClassValues),
    label: z.string().min(1).max(255),
    isMandatory: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
  }),
});

export const batchCreateDocumentRequirementsSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          documentClass: z.enum(documentClassValues),
          label: z.string().min(1).max(255),
          isMandatory: z.boolean().default(true),
          sortOrder: z.number().int().min(0).optional(),
        }),
      )
      .min(1)
      .max(100),
  }),
  params: z.object({
    applicationId: z.string().uuid(),
  }),
});

export const updateDocumentRequirementSchema = z.object({
  body: z.object({
    label: z.string().min(1).max(255).optional(),
    isMandatory: z.boolean().optional(),
    isCollected: z.boolean().optional(),
    collectedDocId: z.string().uuid().optional().nullable(),
    sortOrder: z.number().int().min(0).optional(),
  }),
});

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------
export type ListCreditDocumentsInput = z.infer<typeof listCreditDocumentsSchema>['query'];
export type UploadCreditDocumentInput = z.infer<typeof uploadCreditDocumentSchema>['body'];
export type UpdateCreditDocumentInput = z.infer<typeof updateCreditDocumentSchema>['body'];
export type ReplaceCreditDocumentInput = z.infer<typeof replaceCreditDocumentSchema>['body'];
export type UpdateAvStatusInput = z.infer<typeof updateAvStatusSchema>['body'];
export type CreateDocumentRequirementInput = z.infer<typeof createDocumentRequirementSchema>['body'];
export type UpdateDocumentRequirementInput = z.infer<typeof updateDocumentRequirementSchema>['body'];