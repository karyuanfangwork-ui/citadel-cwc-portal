import { Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { sensitivityScenarioService } from '../services/sensitivityScenario.service';
import { ProjectionScenario } from '@prisma/client';

class SensitivityScenarioController {
  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const scenarios = await sensitivityScenarioService.listByApplication(applicationId);
    res.json({ status: 'success', data: { sensitivityScenarios: scenarios } });
  });

  upsert = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const scenario = req.params.scenario as ProjectionScenario;
    const result = await sensitivityScenarioService.upsert(applicationId, scenario, req.body);
    res.json({ status: 'success', data: { sensitivityScenario: result } });
  });
}

export const sensitivityScenarioController = new SensitivityScenarioController();
