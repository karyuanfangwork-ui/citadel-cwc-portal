import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import {
  createRecommendation,
  listRecommendations,
  getCurrentRecommendation,
  updateRecommendationDraft,
  submitRecommendation,
  acknowledgeRecommendation,
} from '../controllers/creditRecommendation.controller';

const router = Router();

// P2.3 — Credit Recommendation lifecycle endpoints
// Static routes (current) before parameterized routes (:recommendationId)
router.post('/applications/:appId/recommendations', authenticate, requirePermission('credit:write'), createRecommendation);
router.get('/applications/:appId/recommendations', authenticate, requirePermission('credit:read'), listRecommendations);
router.get('/applications/:appId/recommendations/current', authenticate, requirePermission('credit:read'), getCurrentRecommendation);
router.patch('/applications/:appId/recommendations/:recommendationId', authenticate, requirePermission('credit:write'), updateRecommendationDraft);
router.post('/applications/:appId/recommendations/:recommendationId/submit', authenticate, requirePermission('credit:write'), submitRecommendation);
router.post('/applications/:appId/recommendations/:recommendationId/acknowledge', authenticate, requirePermission('credit:admin'), acknowledgeRecommendation);

export default router;