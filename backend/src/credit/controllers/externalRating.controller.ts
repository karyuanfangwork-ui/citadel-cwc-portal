import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { externalRatingService } from '../services/externalRating.service';

class ExternalRatingController {
  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const ratings = await externalRatingService.listByApplication(applicationId);
    res.json({ status: 'success', data: { externalRatings: ratings } });
  });

  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const rating = await externalRatingService.create({ ...req.body, applicationId });
    res.status(201).json({ status: 'success', data: { externalRating: rating } });
  });

  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.ratingId);
    const rating = await externalRatingService.update(id, req.body);
    if (!rating) throw new AppError('External rating not found', 404);
    res.json({ status: 'success', data: { externalRating: rating } });
  });

  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.ratingId);
    const rating = await externalRatingService.delete(id);
    if (!rating) throw new AppError('External rating not found', 404);
    res.json({ status: 'success', message: 'External rating deleted' });
  });
}

export const externalRatingController = new ExternalRatingController();
