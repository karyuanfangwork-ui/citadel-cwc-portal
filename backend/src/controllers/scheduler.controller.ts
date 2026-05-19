import { Request, Response, NextFunction } from 'express';
import * as schedulerService from '../services/scheduler.service';

export async function listJobs(req: Request, res: Response, next: NextFunction) {
  try {
    const configs = await schedulerService.listConfigs();
    res.json({ jobs: configs });
  } catch (err) { next(err); }
}

export async function updateJob(req: Request, res: Response, next: NextFunction) {
  try {
    const jobKey = req.params.jobKey as string;
    const { enabled, mode, cronExpr, intervalMs } = req.body;
    const userId = (req as any).user?.id || 'system';
    const updated = await schedulerService.updateConfig(jobKey, { enabled, mode, cronExpr, intervalMs }, userId);
    res.json({ job: updated });
  } catch (err: any) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

export async function triggerJob(req: Request, res: Response, next: NextFunction) {
  try {
    const jobKey = req.params.jobKey as string;
    await schedulerService.triggerJob(jobKey);
    res.json({ triggered: true, jobKey });
  } catch (err: any) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

export async function restartJob(req: Request, res: Response, next: NextFunction) {
  try {
    const jobKey = req.params.jobKey as string;
    await schedulerService.restartJob(jobKey);
    res.json({ restarted: true, jobKey });
  } catch (err: any) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}