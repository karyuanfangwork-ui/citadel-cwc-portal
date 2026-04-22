import * as multer from 'multer';
import * as path from 'path';
import * as crypto from 'crypto';

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

// ---------------------------------------------------------------------------
// Multer storage engine
// ---------------------------------------------------------------------------
const storage = multer.default.diskStorage({
  destination: (_req: Express.Request, _file: Express.Multer.File, cb) => {
    cb(null, path.resolve(process.cwd(), 'uploads'));
  },
  filename: (_req: Express.Request, file: Express.Multer.File, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Use crypto UUID v4 equivalent
    const uuid = crypto.randomUUID();
    cb(null, `${uuid}${ext}`);
  },
});

// ---------------------------------------------------------------------------
// File filter — validates MIME type and extension
// ---------------------------------------------------------------------------
function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void {
  const ext = path.extname(file.originalname).toLowerCase();

  // Check blocked extensions first (defense in depth)
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return cb(new Error(`File type not allowed: ${ext}`));
  }

  // Check blocked MIME types
  if (BLOCKED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error(`File type not allowed: ${file.mimetype}`));
  }

  // Check allowlist
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

// ---------------------------------------------------------------------------
// Configured multer instance — 10MB limit, 5 files max
// ---------------------------------------------------------------------------
const uploader = multer.default({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 5,
  },
});

// ---------------------------------------------------------------------------
// Middleware factory for single file upload
// ---------------------------------------------------------------------------
export const uploadSingleFile = (fieldName: string) => uploader.single(fieldName);
