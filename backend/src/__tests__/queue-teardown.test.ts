/**
 * Phase 8b regression: teardown must not force a Redis connection.
 *
 * BullMQ's Queue.prototype.client is a getter that initiates a connection.
 * Reading it inside a closer opens a socket during teardown and then races
 * queue.close(), surfacing as an unhandled "Connection is closed" error.
 */
describe('Phase 8b: queue closers do not touch queue.client', () => {
  it('closeCreditQueues closes without reading the client getter', async () => {
    const { screeningQueue, closeCreditQueues } = await import('../credit/queues');

    const clientGetter = jest.fn();
    Object.defineProperty(screeningQueue, 'client', { configurable: true, get: clientGetter });
    const closeSpy = jest.spyOn(screeningQueue, 'close').mockResolvedValue(undefined);

    await closeCreditQueues();

    expect(closeSpy).toHaveBeenCalled();
    expect(clientGetter).not.toHaveBeenCalled();
    closeSpy.mockRestore();
    delete (screeningQueue as any).client;
  });

  it('closePdfQueue closes without reading the client getter', async () => {
    const { pdfQueue, closePdfQueue } = await import('../queues/pdf.queue');

    const clientGetter = jest.fn();
    Object.defineProperty(pdfQueue, 'client', { configurable: true, get: clientGetter });
    const closeSpy = jest.spyOn(pdfQueue, 'close').mockResolvedValue(undefined);

    await closePdfQueue();

    expect(closeSpy).toHaveBeenCalled();
    expect(clientGetter).not.toHaveBeenCalled();
    closeSpy.mockRestore();
    delete (pdfQueue as any).client;
  });

  it('closeAttachmentScanQueue closes without reading the client getter', async () => {
    const { attachmentScanQueue, closeAttachmentScanQueue } =
      await import('../queues/attachmentScan.queue');

    const clientGetter = jest.fn();
    Object.defineProperty(attachmentScanQueue, 'client', { configurable: true, get: clientGetter });
    const closeSpy = jest.spyOn(attachmentScanQueue, 'close').mockResolvedValue(undefined);

    await closeAttachmentScanQueue();

    expect(closeSpy).toHaveBeenCalled();
    expect(clientGetter).not.toHaveBeenCalled();
    closeSpy.mockRestore();
    delete (attachmentScanQueue as any).client;
  });
});
