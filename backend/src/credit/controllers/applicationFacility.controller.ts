import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { applicationFacilityService } from '../services/applicationFacility.service';

class ApplicationFacilityController {
  /**
   * GET /applications/:applicationId/facilities
   */
  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const result = await applicationFacilityService.listFacilities({
      applicationId,
      page,
      limit,
    });

    res.json({ status: 'success', data: result });
  });

  /**
   * GET /facilities/:id
   */
  getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const facility = await applicationFacilityService.getFacility(id);

    if (!facility) {
      throw new AppError('Application facility not found', 404);
    }

    res.json({ status: 'success', data: { facility } });
  });

  /**
   * POST /applications/:applicationId/facilities
   */
  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const facility = await applicationFacilityService.createFacility({ ...req.body, applicationId });
    res.status(201).json({ status: 'success', data: { facility } });
  });

  /**
   * PATCH /facilities/:id
   */
  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const facility = await applicationFacilityService.updateFacility(id, req.body);

    if (!facility) {
      throw new AppError('Application facility not found', 404);
    }

    res.json({ status: 'success', data: { facility } });
  });

  /**
   * DELETE /facilities/:id
   */
  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const facility = await applicationFacilityService.deleteFacility(id);

    if (!facility) {
      throw new AppError('Application facility not found', 404);
    }

    res.json({ status: 'success', message: 'Application facility deleted successfully' });
  });
}

export const applicationFacilityController = new ApplicationFacilityController();