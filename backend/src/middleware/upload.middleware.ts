import multer from 'multer';
import * as path from 'path';
import * as crypto from 'crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { s3Service } from '../services/s3.service';
import { assertAllowedUploadSignature } from '../utils/file-signature';

// ---------------------------------------------------------------------------
// MIME type allowlist — only these file types are accepted
// ---------------------------------------------------------------------------
const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',

  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  // Spreadsheets
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  // Text
  'text/plain',
  'text/csv',

  // Other
  'application/json',
  'application/zip',
]);

// ---------------------------------------------------------------------------
// Dangerous MIME types — reject outright regardless of extension
// ---------------------------------------------------------------------------
const BLOCKED_MIME_TYPES = new Set([
  'application/x-msdownload',
  'application/x-executable',
  'application/x-sh',
  'text/x-shellscript',
  'application/javascript',
  'application/x-shellscript',
  'text/html',
  'application/xhtml+xml',
  'application/x-httpd-php',
  'text/php',
  'application/x-php',
]);

// ---------------------------------------------------------------------------
// Blocked extensions — double-check since some files lie about MIME type
// ---------------------------------------------------------------------------
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.zsh',
  '.php', '.phtml', '.php3', '.php4', '.php5', '.phar',
  '.html', '.htm', '.xhtml',
  '.js', '.mjs', '.cjs',
  '.jar', '.war', '.ear',
  '.scr', '.com', '.pif', '.application',
  '.gadget', '.msi', '.msh',
  '.vbs', '.vbe', '.wscript', '.wsf',
  '.action', '.applescript', '.scpt',
]);

function buildS3Key(originalname: string): string {
  const ext = path.extname(originalname).toLowerCase();
  const uuid = crypto.randomUUID();
  return `cwc/${uuid}${ext}`;
}

// ---------------------------------------------------------------------------
// File filter — validates MIME type and extension
// ---------------------------------------------------------------------------
function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void {
  const ext = path.extname(file.originalname).toLowerCase();

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return cb(new Error(`File type not allowed: ${ext}`));
  }

  if (BLOCKED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error(`File type not allowed: ${file.mimetype}`));
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(
      new Error(
        `Unsupported file type '${file.mimetype}'. ` +
        `Allowed: images (JPG, PNG, GIF, WebP), PDFs, Word docs, Excel, CSV, plain text, ZIP.`
      )
    );
  }

  cb(null, true);
}

const uploader = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
});

type UploadedFile = Express.Multer.File & {
  key?: string;
  location?: string;
};

async function validateAndUploadFile(file: UploadedFile): Promise<void> {
  if (!assertAllowedUploadSignature(file.buffer, file.originalname, file.mimetype)) {
    throw new Error(`Uploaded file content does not match the declared type for ${file.originalname}`);
  }

  const key = buildS3Key(file.originalname);
  await s3Service.uploadBuffer(key, file.buffer, file.mimetype);
  file.key = key;
  file.location = key;
}

function withUploadProcessing(uploadMiddleware: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    uploadMiddleware(req, res, async (err?: unknown) => {
      if (err) {
        next(err);
        return;
      }

      try {
        const files: UploadedFile[] = [];
        if (req.file) {
          files.push(req.file as UploadedFile);
        }
        if (Array.isArray(req.files)) {
          files.push(...(req.files as UploadedFile[]));
        }

        for (const file of files) {
          await validateAndUploadFile(file);
        }

        next();
      } catch (uploadError) {
        next(uploadError);
      }
    });
  };
}

export const uploadSingleFile = (fieldName: string) => withUploadProcessing(uploader.single(fieldName));

export const uploadMultipleFiles = (fieldName: string, maxCount: number) =>
  withUploadProcessing(uploader.array(fieldName, maxCount));
