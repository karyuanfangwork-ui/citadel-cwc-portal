import multer from 'multer';
import path from 'path';

// Backend file limits are not wire-body limits. The production /api/ proxy
// currently rejects multipart requests exceeding 10m, including the envelope.
export const crmImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

export const crmLeadDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const validPdf = file.mimetype === 'application/pdf' && path.extname(file.originalname).toLowerCase() === '.pdf';
    if (!validPdf) return cb(new Error('Only PDF documents are allowed'));
    cb(null, true);
  },
});
