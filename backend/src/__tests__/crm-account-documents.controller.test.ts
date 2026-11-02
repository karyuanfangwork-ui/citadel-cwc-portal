import express from 'express';
import request from 'supertest';
import { Readable } from 'stream';

jest.mock('../services/crm-account-document.service', () => ({
  listAccountDocuments: jest.fn(), uploadAccountDocuments: jest.fn(),
  getAccountDocumentStream: jest.fn(), deleteAccountDocument: jest.fn(),
}));
jest.mock('../services/crm-scope.service', () => ({ resolveVisibleOwnerIds: jest.fn().mockResolvedValue(['user-1']) }));
jest.mock('../utils/sseClients', () => ({ broadcast: jest.fn() }));

import { crmController } from '../controllers/crm.controller';
import * as service from '../services/crm-account-document.service';
import prisma from '../utils/prisma';

const app = express();
app.use((req: any, _res, next) => {
  req.user = { id: 'user-1', email: 'user@test.local', tenantId: 'tenant-1' };
  req.files = [];
  next();
});
app.post('/accounts/:id/documents', crmController.uploadAccountDocuments);
app.get('/accounts/:id/documents/:documentId/download', crmController.downloadAccountDocument);
app.delete('/accounts/:id/documents/:documentId', crmController.deleteAccountDocument);

describe('account document controller audit and download contract', () => {
  beforeEach(() => {
    jest.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as any);
    jest.spyOn(prisma.auditLog, 'createMany').mockResolvedValue({ count: 1 });
  });
  afterEach(() => jest.restoreAllMocks());

  it('records upload metadata without storage details', async () => {
    (service.uploadAccountDocuments as jest.Mock).mockResolvedValue({ documents: [{ id: 'doc-1', accountId: 'account-1', mimeType: 'application/pdf', fileSize: 4 }] });
    await request(app).post('/accounts/account-1/documents').expect(201);
    expect(prisma.auditLog.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ action: 'CREATE', resourceType: 'CrmAccountDocument', resourceId: 'doc-1', newValues: { accountId: 'account-1', mimeType: 'application/pdf', fileSize: 4 } })] });
  });

  it('streams an attachment with nosniff and records download access', async () => {
    (service.getAccountDocumentStream as jest.Mock).mockResolvedValue({ document: { id: 'doc-1', fileName: 'test.pdf', fileSize: 4 }, stream: Readable.from('%PDF') });
    const response = await request(app).get('/accounts/account-1/documents/doc-1/download').expect(200);
    expect(response.headers['content-disposition']).toBe('attachment; filename="test.pdf"');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'DOWNLOAD', resourceId: 'doc-1' }) });
    expect(service.getAccountDocumentStream).toHaveBeenCalledWith('account-1', 'doc-1', ['user-1'], 'tenant-1');
  });

  it('records deletion for the document and its account', async () => {
    (service.deleteAccountDocument as jest.Mock).mockResolvedValue({ id: 'doc-1', accountId: 'account-1' });
    await request(app).delete('/accounts/account-1/documents/doc-1').expect(200);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'DELETE', resourceId: 'doc-1', newValues: { accountId: 'account-1' } }) });
  });
});
