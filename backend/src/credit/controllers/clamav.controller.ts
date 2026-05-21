import path from 'path';
import { Response } from 'express';
import { asyncHandler, AppError } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import prisma from '../../utils/prisma';
import { execFileSync } from 'child_process';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

/**
 * Check if ClamAV daemon (clamdscan) is available on the system.
 */
function isClamAvAvailable(): boolean {
  try {
    execFileSync('which', ['clamdscan'], { timeout: 3000, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run ClamAV scan on a file path. Returns scan result.
 */
function runClamScan(filePath: string): { clean: boolean; result: string } {
  try {
    const output = execFileSync('clamdscan', ['--no-summary', filePath], {
      timeout: 60_000,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    // clamdscan returns "OK" for clean files
    if (output.includes('OK')) {
      return { clean: true, result: 'CLEAN' };
    }
    return { clean: false, result: output.trim() };
  } catch (err: any) {
    // Non-zero exit means infected or error
    const output = err.stdout || err.message || '';
    if (output.includes('FOUND')) {
      return { clean: false, result: output.trim() };
    }
    // Error running scan
    return { clean: false, result: `SCAN_ERROR: ${err.message}` };
  }
}

class ClamAvController {
  /**
   * POST /credit/security/scan-document
   * Scan a credit document for viruses using ClamAV.
   * Falls back to a stub/skip if ClamAV is not installed.
   * Requires: credit:write
   */
  scanDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { documentId } = req.body;

    if (!documentId) {
      throw new AppError('documentId is required', 400);
    }

    const document = await prisma.creditDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new AppError('Document not found', 404);
    }

    let avClean: boolean | null = null;
    let avScanResult: string | null = null;

    if (!isClamAvAvailable()) {
      // ClamAV not available — log and return clean result (MVP stub)
      console.warn('ClamAV not available - scan skipped for document', documentId);
      avClean = null; // null = not scanned
      avScanResult = 'SKIPPED: ClamAV not available';
    } else {
      // Validate filePath is within the upload directory (path-traversal guard)
      if (document.filePath.includes('..')) {
        throw new AppError('Invalid file path', 400);
      }
      const resolvedPath = path.resolve(document.filePath);
      if (!resolvedPath.startsWith(UPLOAD_DIR + path.sep) && resolvedPath !== UPLOAD_DIR) {
        throw new AppError('Invalid file path', 400);
      }

      // Run actual ClamAV scan
      const scanResult = runClamScan(document.filePath);
      avClean = scanResult.clean;
      avScanResult = scanResult.result;
    }

    // Update the document with scan results using the existing isAvClean field
    // Store additional scan info via metadata in the description field (avScanResult)
    await prisma.creditDocument.update({
      where: { id: documentId },
      data: {
        isAvClean: avClean,
        description: document.description
          ? `${document.description} [AV: ${avScanResult}]`
          : `[AV: ${avScanResult}]`,
      },
    });

    res.json({
      status: 'success',
      data: {
        documentId,
        avClean,
        avScanResult,
        scannedAt: new Date().toISOString(),
      },
    });
  });
}

export const clamAvController = new ClamAvController();