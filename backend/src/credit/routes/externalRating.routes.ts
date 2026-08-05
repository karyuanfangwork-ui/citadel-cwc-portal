import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { externalRatingController } from '../controllers/externalRating.controller';

const router = Router();
router.use(authenticate);

router.get('/:applicationId/external-ratings', requirePermission('credit:read'), externalRatingController.list);
router.post('/:applicationId/external-ratings', requirePermission('credit:write'), externalRatingController.create);
router.patch('/:applicationId/external-ratings/:ratingId', requirePermission('credit:write'), externalRatingController.update);
router.delete('/:applicationId/external-ratings/:ratingId', requirePermission('credit:write'), externalRatingController.delete);

export default router;
