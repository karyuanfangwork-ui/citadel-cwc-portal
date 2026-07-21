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
import { enqueuePdf } from '../../services/pdfJob.service';

/**
 * POST /applications/:appId/ca-memo-versions
 * Generate a new memo version (saves snapshot).
 * Enqueues PDF generation from the saved HTML and returns the jobId.
 */
export async function createMemoVersion(req: Request, res: Response, next: NextFunction) {
  try {
    const appId = req.params.appId as string;
    const userId = (req as any).user?.id;
    const version = await generateAndSaveMemoVersion(appId, userId);

    // P2.2f — Enqueue PDF generation from the saved HTML snapshot (not live data)
    let jobId: string | null = null;
    try {
      jobId = await enqueuePdf(version.htmlContent, `credit/memo/${appId}/v${version.versionNumber}/`, userId);
    } catch (pdfErr) {
      // PDF job enqueue failure should not block memo version creation
      // The version is still saved; PDF can be regenerated later
      console.warn(`[MemoVersion] PDF enqueue failed for version ${version.versionNumber}: ${pdfErr}`);
    }

    // Return summary fields only (exclude htmlContent from response to keep it lean)
    const { htmlContent, ...summary } = version;
    res.status(201).json({
      status: 'success',
      data: {
        ...summary,
        jobId,
        message: jobId
          ? 'Memo version saved. PDF generation started. Poll /api/v1/pdf-jobs/:jobId for the download URL.'
          : 'Memo version saved. PDF generation could not be started.',
      },
    });
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
 * POST /applications/:appId/ca-memo-versions/lock
 * Lock the latest memo version (admin/committee action).
 * Enqueues PDF generation for the locked version if not already generated.
 */
export async function lockVersion(req: Request, res: Response, next: NextFunction) {
  try {
    const appId = req.params.appId as string;
    const userId = (req as any).user?.id;
    const version = await lockMemoVersion(appId, userId);

    // P2.2f — Enqueue PDF generation from the locked HTML snapshot
    let jobId: string | null = null;
    if (!version.pdfUrl) {
      try {
        jobId = await enqueuePdf(version.htmlContent, `credit/memo/${appId}/v${version.versionNumber}/locked/`, userId);
        // The PDF URL will be updated asynchronously by the worker via updateMemoPdfUrl
      } catch (pdfErr) {
        console.warn(`[MemoVersion] PDF enqueue failed on lock for version ${version.versionNumber}: ${pdfErr}`);
      }
    }

    // Return summary fields only (exclude htmlContent from response to keep it lean)
    const { htmlContent, ...summary } = version;
    res.json({
      status: 'success',
      data: {
        ...summary,
        jobId,
      },
    });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /applications/:appId/ca-memo-versions/unlock
 * Unlock a locked memo version (admin break-glass action).
 *
 * P2.2 policy: In production, refer-back should create a new version rather
 * than unlocking an existing one. This endpoint is retained for operational
 * recovery and is separately permissioned (credit:admin).
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