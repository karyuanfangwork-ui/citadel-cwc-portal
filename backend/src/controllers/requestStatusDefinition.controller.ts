import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { auditLog } from '../utils/audit';
import {
  createStatusDefinition,
  deleteStatusDefinition,
  getActiveStatusDefinitions,
  getAllStatusDefinitions,
  getStatusDefinitionUsage,
  retireStatusDefinition,
  updateStatusDefinition,
} from '../services/requestStatusDefinition.service';

export class RequestStatusDefinitionController {
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const { category } = req.query;
    const definitions = await getAllStatusDefinitions(category ? String(category) : undefined);
    res.json({ status: 'success', data: { definitions } });
  });

  getActive = asyncHandler(async (req: Request, res: Response) => {
    const { category, workflowTypeId } = req.query;
    const definitions = await getActiveStatusDefinitions({
      category: category ? String(category) : undefined,
      workflowTypeId: workflowTypeId ? String(workflowTypeId) : undefined,
    });
    res.json({ status: 'success', data: { definitions } });
  });

  getUsage = asyncHandler(async (req: Request, res: Response) => {
    const usage = await getStatusDefinitionUsage(String(req.params.id));
    res.json({ status: 'success', data: { usage } });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const definition = await createStatusDefinition(req.body);
    await auditLog(req as AuthRequest, 'STATUS_DEFINITION_CREATED', 'request_status_definition', definition.id, { definition });
    res.status(201).json({ status: 'success', data: { definition } });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const definition = await updateStatusDefinition(id, req.body);
    await auditLog(req as AuthRequest, 'STATUS_DEFINITION_UPDATED', 'request_status_definition', id, { definition });
    res.json({ status: 'success', data: { definition } });
  });

  retire = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const definition = await retireStatusDefinition(id);
    await auditLog(req as AuthRequest, 'STATUS_DEFINITION_RETIRED', 'request_status_definition', id, { definition });
    res.json({ status: 'success', data: { definition } });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    await deleteStatusDefinition(id);
    await auditLog(req as AuthRequest, 'STATUS_DEFINITION_DELETED', 'request_status_definition', id, {});
    res.json({ status: 'success', message: 'Status definition deleted' });
  });
}
