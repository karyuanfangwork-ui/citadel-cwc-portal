/**
 * P2.3 — Credit Recommendation Service
 *
 * Manages the analyst recommendation lifecycle:
 *   DRAFT → SUBMITTED → ACKNOWLEDGED | SUPERSEDED
 *
 * Governance rules:
 *   - DRAFT: author can edit their own drafts
 *   - SUBMITTED: immutable, supersedes any prior current recommendation
 *   - ACKNOWLEDGED: committee has acknowledged the recommendation
 *   - SUPERSEDED: a newer submitted recommendation replaces this one
 *
 * SOD (Separation of Duties) rule D2:
 *   - The recommendation author cannot be the final decision actor
 */

import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/error.middleware';
import { AuditChainService } from './auditChain.service';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecommendationStatus = 'DRAFT' | 'SUBMITTED' | 'ACKNOWLEDGED' | 'SUPERSEDED';
export type RecommendationType = 'APPROVE' | 'CONDITIONAL' | 'REJECT';

export interface CreateRecommendationInput {
  applicationId: string;
  authorId: string;
  recommendationType: RecommendationType;
  recommendedAmount?: number;
  recommendedTenorMonths?: number;
  pricingTerms?: Record<string, any>;
  conditions?: string;
  rationale?: string;
}

export interface UpdateDraftInput {
  recommendationType?: RecommendationType;
  recommendedAmount?: number | null;
  recommendedTenorMonths?: number | null;
  pricingTerms?: Record<string, any> | null;
  conditions?: string | null;
  rationale?: string | null;
}

// ---------------------------------------------------------------------------
// Zod Validation
// ---------------------------------------------------------------------------

export const createRecommendationSchema = z.object({
  applicationId: z.string().uuid(),
  recommendationType: z.enum(['APPROVE', 'CONDITIONAL', 'REJECT']),
  recommendedAmount: z.number().positive().optional().nullable(),
  recommendedTenorMonths: z.number().int().positive().optional().nullable(),
  pricingTerms: z.record(z.any()).optional().nullable(),
  conditions: z.string().max(5000).optional().nullable(),
  rationale: z.string().max(5000).optional().nullable(),
});

export const updateDraftSchema = z.object({
  recommendationType: z.enum(['APPROVE', 'CONDITIONAL', 'REJECT']).optional(),
  recommendedAmount: z.number().positive().optional().nullable(),
  recommendedTenorMonths: z.number().int().positive().optional().nullable(),
  pricingTerms: z.record(z.any()).optional().nullable(),
  conditions: z.string().max(5000).optional().nullable(),
  rationale: z.string().max(5000).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class CreditRecommendationService {
  /**
   * Create a new DRAFT recommendation.
   * Only the author can create a draft for a given application.
   */
  async createDraft(input: CreateRecommendationInput): Promise<any> {
    const validated = createRecommendationSchema.parse(input);

    const recommendation = await prisma.creditRecommendation.create({
      data: {
        applicationId: validated.applicationId,
        authorId: input.authorId,
        recommendationType: validated.recommendationType,
        recommendedAmount: validated.recommendedAmount ?? null,
        recommendedTenorMonths: validated.recommendedTenorMonths ?? null,
        pricingTerms: validated.pricingTerms as any ?? undefined,
        conditions: validated.conditions ?? null,
        rationale: validated.rationale ?? null,
        status: 'DRAFT',
      },
    });

    return recommendation;
  }

  /**
   * Update a DRAFT recommendation. Only the author can edit their own draft.
   * Submitted recommendations are immutable.
   */
  async updateDraft(id: string, authorId: string, input: UpdateDraftInput): Promise<any> {
    const existing = await prisma.creditRecommendation.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Recommendation not found', 404);
    }
    if (existing.status !== 'DRAFT') {
      throw new AppError('Only DRAFT recommendations can be edited', 400);
    }
    if (existing.authorId !== authorId) {
      throw new AppError('Only the author can edit their own draft', 403);
    }

    const validated = updateDraftSchema.parse(input);
    const updateData: any = {};
    if (validated.recommendationType !== undefined) updateData.recommendationType = validated.recommendationType;
    if (validated.recommendedAmount !== undefined) updateData.recommendedAmount = validated.recommendedAmount;
    if (validated.recommendedTenorMonths !== undefined) updateData.recommendedTenorMonths = validated.recommendedTenorMonths;
    if (validated.pricingTerms !== undefined) updateData.pricingTerms = validated.pricingTerms;
    if (validated.conditions !== undefined) updateData.conditions = validated.conditions;
    if (validated.rationale !== undefined) updateData.rationale = validated.rationale;

    return prisma.creditRecommendation.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Submit a DRAFT recommendation. This makes it immutable and supersedes
   * any previously current (SUBMITTED) recommendation for the same application.
   */
  async submit(id: string, authorId: string): Promise<any> {
    const existing = await prisma.creditRecommendation.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Recommendation not found', 404);
    }
    if (existing.status !== 'DRAFT') {
      throw new AppError('Only DRAFT recommendations can be submitted', 400);
    }
    if (existing.authorId !== authorId) {
      throw new AppError('Only the author can submit their own draft', 403);
    }

    // Find and supersede any currently submitted recommendation for this application
    const currentSubmitted = await prisma.creditRecommendation.findFirst({
      where: {
        applicationId: existing.applicationId,
        status: 'SUBMITTED',
      },
    });

    const now = new Date();

    // Use a transaction to atomically supersede the old and submit the new
    const result = await prisma.$transaction(async (tx: any) => {
      // Supersede the current submitted recommendation
      if (currentSubmitted) {
        await tx.creditRecommendation.update({
          where: { id: currentSubmitted.id },
          data: {
            status: 'SUPERSEDED',
            supersededAt: now,
            supersededById: id,
          },
        });
      }

      // Submit the new recommendation
      const submitted = await tx.creditRecommendation.update({
        where: { id },
        data: {
          status: 'SUBMITTED',
          submittedAt: now,
        },
      });

      return submitted;
    });

    // Audit event
    await AuditChainService.appendEvent(
      existing.applicationId,
      'RECOMMENDATION_SUBMITTED',
      authorId,
      'submit_recommendation',
      null,
      null,
      { recommendationId: id, recommendationType: existing.recommendationType, supersededId: currentSubmitted?.id ?? null },
    );

    return result;
  }

  /**
   * Get the current submitted recommendation for an application.
   * Returns null if no submitted recommendation exists.
   */
  async getCurrentRecommendation(applicationId: string): Promise<any | null> {
    return prisma.creditRecommendation.findFirst({
      where: { applicationId, status: 'SUBMITTED' },
      orderBy: { submittedAt: 'desc' },
    });
  }

  /**
   * List all recommendations for an application (all statuses).
   */
  async listRecommendations(applicationId: string): Promise<any[]> {
    return prisma.creditRecommendation.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Acknowledge a submitted recommendation (committee action).
   */
  async acknowledge(id: string, _userId: string): Promise<any> {
    const existing = await prisma.creditRecommendation.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Recommendation not found', 404);
    }
    if (existing.status !== 'SUBMITTED') {
      throw new AppError('Only SUBMITTED recommendations can be acknowledged', 400);
    }

    return prisma.creditRecommendation.update({
      where: { id },
      data: { status: 'ACKNOWLEDGED' },
    });
  }

  /**
   * D2 — SOD Check: Verify that the recommendation author is not the same
   * person making the final decision.
   * Returns true if SOD is satisfied (different people), false if violated.
   */
  async checkSodSeparation(applicationId: string, decisionActorId: string): Promise<{ ok: boolean; recommendationAuthorId?: string }> {
    const current = await this.getCurrentRecommendation(applicationId);
    if (!current) {
      // No recommendation exists — SOD is trivially satisfied
      return { ok: true };
    }
    if (current.authorId === decisionActorId) {
      return { ok: false, recommendationAuthorId: current.authorId };
    }
    return { ok: true, recommendationAuthorId: current.authorId };
  }
}

export const creditRecommendationService = new CreditRecommendationService();