import express from 'express';
import request from 'supertest';
import { AppError, errorHandler } from '../middleware/error.middleware';

const mockMarkScanResult = jest.fn();

jest.mock('../middleware/auth.middleware', () => ({
    requireServiceApiKey: (_req: unknown, _res: unknown, next: () => void) => next(),
    authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../services/attachmentAccess.service', () => ({
    markScanResult: mockMarkScanResult,
    getAuthorizedDownloadUrl: jest.fn(),
}));

import fileRoutes from '../routes/file.routes';

const attachmentId = '00000000-0000-4000-8000-000000000001';
const scanJobId = '00000000-0000-4000-8000-000000000002';
const contentHash = 'a'.repeat(64);
const nonce = 'n'.repeat(32);

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/files', fileRoutes);
    app.use(errorHandler);
    return app;
}

describe('Task 12 scanner callback route', () => {
    beforeEach(() => jest.clearAllMocks());

    it('binds the route payload and attachment ID to markScanResult', async () => {
        mockMarkScanResult.mockResolvedValue({ attachmentId, scanStatus: 'CLEAN' });
        const timestamp = new Date().toISOString();

        const response = await request(createApp())
            .patch(`/files/attachments/${attachmentId}/scan-result`)
            .send({ scanJobId, contentHash, nonce, timestamp, result: 'CLEAN' });

        expect(response.status).toBe(200);
        expect(mockMarkScanResult).toHaveBeenCalledWith({
            attachmentId,
            scanJobId,
            contentHash,
            nonce,
            timestamp: new Date(timestamp),
            result: 'CLEAN',
        });
    });

    it('propagates forged callback rejection without changing the route contract', async () => {
        mockMarkScanResult.mockRejectedValue(new AppError('Invalid scan callback', 403));

        const response = await request(createApp())
            .patch(`/files/attachments/${attachmentId}/scan-result`)
            .send({
                scanJobId,
                contentHash,
                nonce,
                timestamp: new Date().toISOString(),
                result: 'CLEAN',
            });

        expect(response.status).toBe(403);
        expect(response.body.message).toBe('Invalid scan callback');
    });
});
