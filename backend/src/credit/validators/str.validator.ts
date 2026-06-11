import { z } from 'zod';

export const createStrSchema = z.object({
  applicationId: z.string().uuid().optional(),
  subjectName: z.string().min(1).max(255),
  subjectIdType: z.enum(['NRIC', 'PASSPORT', 'BRN', 'OTHER']).optional(),
  subjectIdNumber: z.string().max(50).optional(),
  grounds: z.string().min(1),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  assignedToId: z.string().uuid().optional(),
  amlRescreenEventId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const updateStrSchema = z.object({
  subjectName: z.string().min(1).max(255).optional(),
  subjectIdType: z.enum(['NRIC', 'PASSPORT', 'BRN', 'OTHER']).optional(),
  subjectIdNumber: z.string().max(50).optional(),
  grounds: z.string().min(1).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  assignedToId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const fileStrSchema = z.object({
  filingReference: z.string().min(1).max(100),
  filingDate: z.string().datetime().optional(),
});

export const closeStrSchema = z.object({
  reason: z.string().min(1),
});