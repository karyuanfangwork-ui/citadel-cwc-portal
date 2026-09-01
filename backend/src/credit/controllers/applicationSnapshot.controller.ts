import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { getSnapshots, getSnapshotById } from '../services/applicationSnapshot.service';

export const listApplicationSnapshots = asyncHandler(async (req: AuthRequest, res: Response) => {
  const snapshots = await getSnapshots(String(req.params.applicationId));
  res.json({ status: 'success', data: snapshots });
});

export const getApplicationSnapshot = asyncHandler(async (req: AuthRequest, res: Response) => {
  const snapshot = await getSnapshotById(String(req.params.applicationId), String(req.params.snapshotId));
  if (!snapshot) throw new AppError('Snapshot not found', 404);
  res.json({ status: 'success', data: snapshot });
});
