import { Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { consentService } from '../services/consent.service';
import { recordConsentSchema, withdrawConsentSchema, listConsentsQuerySchema } from '../validators/consent.validator';
import { ConsentPurpose } from '@prisma/client';

class ConsentController {
  /** POST /consent — Record a new consent */
  recordConsent = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = recordConsentSchema.parse(req.body);
    const grantedById = req.user?.id;

    const consent = await consentService.recordConsent({
      ...data,
      grantedById,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    });

    res.status(201).json({ data: { consent } });
  });

  /** POST /consent/:id/withdraw — Withdraw a consent */
  withdrawConsent = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const { reason } = withdrawConsentSchema.parse(req.body);
    const withdrawnById = req.user!.id;

    const consent = await consentService.withdrawConsent(id, { withdrawnById, reason });

    res.json({ data: { consent } });
  });

  /** GET /consent/:id — Get a single consent record */
  getConsent = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const consent = await consentService.getConsent(id);
    res.json({ data: { consent } });
  });

  /** GET /consent/subject/:subjectId — List consents for a subject */
  getSubjectConsents = asyncHandler(async (req: AuthRequest, res: Response) => {
    const subjectId = String(req.params.subjectId);
    const consents = await consentService.getSubjectConsents(subjectId);
    res.json({ data: { consents } });
  });

  /** GET /consent/subject/:subjectId/check?purpose=BUREAU_PULL — Check if consent exists */
  checkConsent = asyncHandler(async (req: AuthRequest, res: Response) => {
    const subjectId = String(req.params.subjectId);
    const purpose = req.query.purpose as ConsentPurpose;

    if (!purpose || !Object.values(ConsentPurpose).includes(purpose)) {
      return res.status(400).json({ message: 'Invalid or missing purpose query parameter' });
    }

    const hasConsent = await consentService.checkConsent(subjectId, purpose);
    res.json({ data: { subjectId, purpose, hasConsent } });
  });

  /** GET /consent/export/:subjectId — PDPA data-subject export */
  exportSubjectData = asyncHandler(async (req: AuthRequest, res: Response) => {
    const subjectId = String(req.params.subjectId);
    const exportData = await consentService.exportSubjectData(subjectId);
    res.json({ data: exportData });
  });

  /** GET /consent — List consents (admin view) */
  listConsents = asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = listConsentsQuerySchema.parse(req.query);
    const { page, limit, subjectId, purpose, status } = query;

    const where: any = {};
    if (subjectId) where.subjectId = subjectId;
    if (purpose) where.purpose = purpose;
    if (status) where.status = status;

    const [consents, total] = await Promise.all([
      prisma.consentRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.consentRecord.count({ where }),
    ]);

    res.json({
      data: {
        consents,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  });
}

import prisma from '../../utils/prisma';

export const consentController = new ConsentController();