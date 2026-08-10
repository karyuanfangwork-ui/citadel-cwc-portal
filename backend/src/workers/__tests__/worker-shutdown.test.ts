/**
 * Phase 8b: both workers own BullMQ Redis connections and must expose safe
 * shutdown functions for graceful server termination.
 */
jest.mock('../../utils/redis', () => {
  const actual = jest.requireActual('../../utils/redis');
  return {
    ...actual,
    getRedisConnectionConfig: () => ({ host: 'localhost', port: 6379 }),
  };
});

describe('Phase 8b: workers expose stop functions', () => {
  it('pdf.worker exports stopPdfWorker', async () => {
    const m = await import('../pdf.worker');
    expect(typeof m.stopPdfWorker).toBe('function');
  });

  it('stopPdfWorker is safe when the worker was never started', async () => {
    const { stopPdfWorker } = await import('../pdf.worker');
    await expect(stopPdfWorker()).resolves.toBeUndefined();
  });

  it('attachmentScan.worker exports stopAttachmentScanWorker', async () => {
    const m = await import('../attachmentScan.worker');
    expect(typeof m.stopAttachmentScanWorker).toBe('function');
  });

  it('stopAttachmentScanWorker is safe when the worker was never started', async () => {
    const { stopAttachmentScanWorker } = await import('../attachmentScan.worker');
    await expect(stopAttachmentScanWorker()).resolves.toBeUndefined();
  });
});
