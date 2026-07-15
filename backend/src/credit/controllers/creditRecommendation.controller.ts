import { Request, Response, NextFunction } from 'express';
import { creditRecommendationService } from '../services/creditRecommendation.service';

/**
 * POST /applications/:appId/recommendations
 * Create a new DRAFT recommendation.
 */
export async function createRecommendation(req: Request, res: Response, next: NextFunction) {
  try {
    const appId = req.params.appId as string;
    const userId = (req as any).user?.id;
    const recommendation = await creditRecommendationService.createDraft({
      applicationId: appId,
      authorId: userId,
      ...req.body,
    });
    res.status(201).json({ status: 'success', data: recommendation });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /applications/:appId/recommendations
 * List all recommendations for an application.
 */
export async function listRecommendations(req: Request, res: Response, next: NextFunction) {
  try {
    const appId = req.params.appId as string;
    const recommendations = await creditRecommendationService.listRecommendations(appId);
    res.json({ status: 'success', data: recommendations });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /applications/:appId/recommendations/current
 * Get the current submitted recommendation.
 */
export async function getCurrentRecommendation(req: Request, res: Response, next: NextFunction) {
  try {
    const appId = req.params.appId as string;
    const recommendation = await creditRecommendationService.getCurrentRecommendation(appId);
    if (!recommendation) {
      return res.status(404).json({ status: 'error', message: 'No submitted recommendation found' });
    }
    res.json({ status: 'success', data: recommendation });
  } catch (e) {
    next(e);
  }
}

/**
 * PATCH /applications/:appId/recommendations/:recommendationId
 * Update a DRAFT recommendation (author only).
 */
export async function updateRecommendationDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const recommendationId = req.params.recommendationId as string;
    const userId = (req as any).user?.id;
    const recommendation = await creditRecommendationService.updateDraft(recommendationId, userId, req.body);
    res.json({ status: 'success', data: recommendation });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /applications/:appId/recommendations/:recommendationId/submit
 * Submit a DRAFT recommendation (author only).
 */
export async function submitRecommendation(req: Request, res: Response, next: NextFunction) {
  try {
    const recommendationId = req.params.recommendationId as string;
    const userId = (req as any).user?.id;
    const recommendation = await creditRecommendationService.submit(recommendationId, userId);
    res.json({ status: 'success', data: recommendation });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /applications/:appId/recommendations/:recommendationId/acknowledge
 * Acknowledge a submitted recommendation (committee action).
 */
export async function acknowledgeRecommendation(req: Request, res: Response, next: NextFunction) {
  try {
    const recommendationId = req.params.recommendationId as string;
    const userId = (req as any).user?.id;
    const recommendation = await creditRecommendationService.acknowledge(recommendationId, userId);
    res.json({ status: 'success', data: recommendation });
  } catch (e) {
    next(e);
  }
}