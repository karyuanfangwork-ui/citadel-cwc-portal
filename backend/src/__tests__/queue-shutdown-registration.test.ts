import { shutdownAllQueues } from '../queues/shutdown';

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ close: jest.fn().mockResolvedValue(undefined) })),
}));

describe('queue shutdown registration', () => {
  it('closes a real loaded eager queue module through its registration', async () => {
    const { pdfQueue } = await import('../queues/pdf.queue');

    await shutdownAllQueues();

    expect(pdfQueue.close).toHaveBeenCalledTimes(1);
  });
});
