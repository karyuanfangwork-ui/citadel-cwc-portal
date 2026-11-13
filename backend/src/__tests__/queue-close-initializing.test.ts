const mockClose = jest.fn().mockResolvedValue(undefined);
let mockResolveReady: (() => void) | undefined;
let mockReady: Promise<void>;

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    waitUntilReady: jest.fn(() => mockReady),
    close: mockClose,
  })),
}));

describe('BullMQ queue teardown while connecting', () => {
  it('waits for an already-started connection before closing', async () => {
    mockReady = new Promise<void>((resolve) => { mockResolveReady = resolve; });
    const { closePdfQueue } = await import('../queues/pdf.queue');
    const closing = closePdfQueue();

    expect(mockClose).not.toHaveBeenCalled();
    expect(mockResolveReady).toBeDefined();
    mockResolveReady!();
    await closing;
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
