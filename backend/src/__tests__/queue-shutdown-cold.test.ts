import { registerQueueShutdown, shutdownAllQueues } from '../queues/shutdown';

const mockCreditInit = jest.fn();
const mockPdfInit = jest.fn();
const mockCreditClose = jest.fn().mockResolvedValue(undefined);
const mockPdfClose = jest.fn().mockResolvedValue(undefined);

jest.mock('../credit/queues', () => ({
  __esModule: true,
  closeCreditQueues: mockCreditClose,
  marker: mockCreditInit(),
}));
jest.mock('../queues/pdf.queue', () => ({
  __esModule: true,
  closePdfQueue: mockPdfClose,
  marker: mockPdfInit(),
}));
jest.mock('../queues/attachmentScan.queue', () => ({ closeAttachmentScanQueue: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../utils/cache', () => ({ closeCacheRedis: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../queues/timer.queue', () => ({ closeSlaTimerQueue: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../workers/timer.worker', () => ({ stopSlaTimerWorker: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../credit/jobs/monitor.job', () => ({ stopMonitorJob: jest.fn().mockResolvedValue(undefined) }));

describe('queue shutdown without cold initialization', () => {
  it('does not load unopened BullMQ modules merely to close them', async () => {
    expect(mockCreditInit).not.toHaveBeenCalled();
    expect(mockPdfInit).not.toHaveBeenCalled();
    await shutdownAllQueues();
    expect(mockCreditInit).not.toHaveBeenCalled();
    expect(mockPdfInit).not.toHaveBeenCalled();
  });

  it('closes an already loaded queue without loading other queues', async () => {
    registerQueueShutdown('pdf queue', mockPdfClose);
    await shutdownAllQueues();
    expect(mockPdfClose).toHaveBeenCalledTimes(1);
    expect(mockPdfInit).not.toHaveBeenCalled();
    expect(mockCreditInit).not.toHaveBeenCalled();
  });
});
