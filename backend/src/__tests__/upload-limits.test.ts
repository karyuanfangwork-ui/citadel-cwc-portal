import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error.middleware';
import { crmImportUpload, crmLeadDocumentUpload } from '../middleware/crm-upload.middleware';

const MiB = 1024 * 1024;
const app = express();
app.post('/import', crmImportUpload.single('file'), (req, res) => res.json({ size: req.file?.size, wireLength: Number(req.headers['content-length']) }));
app.post('/documents', crmLeadDocumentUpload.array('documents', 5), (req, res) => res.json({ count: (req.files as Express.Multer.File[]).length }));
app.post('/json', express.json({ limit: '1kb' }), (_req, res) => res.sendStatus(204));
app.use(errorHandler);

describe('CRM multipart limits (direct backend; not Nginx)', () => {
  it('accepts a file just below the proxy 10m limit when sent directly to the backend', async () => {
    const result = await request(app).post('/import').attach('file', Buffer.alloc(10 * MiB - 1024), 'safe.csv');
    expect(result.status).toBe(200);
    expect(result.body.size).toBe(10 * MiB - 1024);
    expect(result.body.wireLength).toBeLessThan(10 * MiB);
  });

  it('shows multipart overhead makes a sub-10 MiB file exceed the unchanged proxy wire limit', async () => {
    const result = await request(app).post('/import').attach('file', Buffer.alloc(10 * MiB - 1), 'safe.csv');
    expect(result.status).toBe(200); // direct backend only; Nginx would reject this wire body
    expect(result.body.wireLength).toBeGreaterThan(10 * MiB);
  });

  it('accepts just below the backend 50 MiB file bound (multipart envelope is additional)', async () => {
    const result = await request(app).post('/import').attach('file', Buffer.alloc(50 * MiB - 1), 'safe.csv');
    expect(result.status).toBe(200);
    expect(result.body.size).toBe(50 * MiB - 1);
  });

  it('returns 413 above the backend 50 MiB file bound', async () => {
    const result = await request(app).post('/import').attach('file', Buffer.alloc(50 * MiB + 1), 'safe.csv');
    expect(result.status).toBe(413);
    expect(result.body).toMatchObject({ status: 'error', statusCode: 413 });
  });

  it('keeps the non-import CRM document limit at 10 MiB', async () => {
    const accepted = await request(app).post('/documents').attach('documents', Buffer.alloc(10 * MiB - 1), 'safe.pdf');
    expect(accepted.status).toBe(200);
    const rejected = await request(app).post('/documents').attach('documents', Buffer.alloc(10 * MiB + 1), 'safe.pdf');
    expect(rejected.status).toBe(413);
  });

  it('maps JSON parser body-limit errors to 413 without leaking raw parser detail', async () => {
    const result = await request(app).post('/json').send({ payload: 'x'.repeat(2048) });
    expect(result.status).toBe(413);
    expect(result.body).toMatchObject({ statusCode: 413, message: 'Request body exceeds the permitted size' });
  });
});
