import { Request, Response, NextFunction } from 'express';
import {
  generateAndSaveMemoVersion,
  getLatestMemoVersion,
  getMemoVersionByVersion,
  getLockedMemoVersion,
  listMemoVersions,
  lockMemoVersion,
  unlockMemoVersion,
} from '../services/creditMemoVersion.service';

/**
 * POST /applications/:appId/ca-memo-versions
 * Generate a new memo version (saves snapshot).
 */
export async function createMemoVersion(req: Request, res: Response, next: NextFunction) {
  try {
    const appId = req.params.appId as string;
    const userId = (req as any).user?.id;
    const version = await generateAndSaveMemoVersion(appId, userId);
    res.status(201).json({ status: 'success', data: version });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /applications/:appId/ca-memo-versions
 * List all memo versions for an application.
 */
export async function getMemoVersions(req: Request, res: Response, next: NextFunction) {
  try {
    const appId = req.params.appId as string;
    const versions = await listMemoVersions(appId);
    res.json({ status: 'success', data: versions });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /applications/:appId/ca-memo-versions/latest
 * Get the latest memo version.
 */
export async function getLatestVersion(req: Request, res: Response, next: NextFunction) {
  try {
    const appId = req.params.appId as string;
    const version = await getLatestMemoVersion(appId);
    if (!version) {
      return res.status(404).json({ status: 'error', message: 'No memo version found' });
    }
    res.json({ status: 'success', data: version });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /applications/:appId/ca-memo-versions/:versionNumber
 * Get a specific memo version by version number.
 */
export async function getMemoVersionByNumber(req: Request, res: Response, next: NextFunction) {
  try {
    const appId = req.params.appId as string;
    const versionNumber = parseInt(req.params.versionNumber as string, 10);
    const version = await getMemoVersionByVersion(appId, versionNumber);
    if (!version) {
      return res.status(404).json({ status: 'error', message: 'Memo version not found' });
    }
    res.json({ status: 'success', data: version });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /applications/:appId/ca-memo-versions/locked
 * Get the locked memo version (for approval pack).
 */
export async function getLockedVersion(req: Request, res: Response, next: NextFunction) {
  try {
    const appId = req.params.appId as string;
    const version = await getLockedMemoVersion(appId);
    if (!version) {
      return res.status(404).json({ status: 'error', message: 'No locked memo version found' });
    }
    res.json({ status: 'success', data: version });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /applications/:appId/ca-memo-versions/lock
 * Lock the latest memo version (admin/committee action).
 */
export async function lockVersion(req: Request, res: Response, next: NextFunction) {
  try {
    const appId = req.params.appId as string;
    const userId = (req as any).user?.id;
    const version = await lockMemoVersion(appId, userId);
    res.json({ status: 'success', data: version });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /applications/:appId/ca-memo-versions/unlock
 * Unlock a locked memo version (admin action).
 */
export async function unlockVersion(req: Request, res: Response, next: NextFunction) {
  try {
    const appId = req.params.appId as string;
    const userId = (req as any).user?.id;
    const version = await unlockMemoVersion(appId, userId);
    res.json({ status: 'success', data: version });
  } catch (e) {
    next(e);
  }
}