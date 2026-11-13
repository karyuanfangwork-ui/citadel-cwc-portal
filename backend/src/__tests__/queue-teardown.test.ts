/** Regression: close loaded queues only after BullMQ's existing init settles. */
describe('queue closers wait for existing initialization', () => {
  it('closes every credit queue after readiness', async () => {
    const { screeningQueue, closeCreditQueues } = await import('../credit/queues');
    const readySpy = jest.spyOn(screeningQueue, 'waitUntilReady').mockResolvedValue(undefined as never);
    const closeSpy = jest.spyOn(screeningQueue, 'close').mockResolvedValue(undefined);

    await closeCreditQueues();

    expect(readySpy).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
    readySpy.mockRestore();
    closeSpy.mockRestore();
  });

  it('closes the PDF queue after readiness', async () => {
    const { pdfQueue, closePdfQueue } = await import('../queues/pdf.queue');
    const readySpy = jest.spyOn(pdfQueue, 'waitUntilReady').mockResolvedValue(undefined as never);
    const closeSpy = jest.spyOn(pdfQueue, 'close').mockResolvedValue(undefined);

    await closePdfQueue();

    expect(readySpy).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
    readySpy.mockRestore();
    closeSpy.mockRestore();
  });

  it('closes the attachment-scan queue after readiness', async () => {
    const { attachmentScanQueue, closeAttachmentScanQueue } =
      await import('../queues/attachmentScan.queue');
    const readySpy = jest.spyOn(attachmentScanQueue, 'waitUntilReady').mockResolvedValue(undefined as never);
    const closeSpy = jest.spyOn(attachmentScanQueue, 'close').mockResolvedValue(undefined);

    await closeAttachmentScanQueue();

    expect(readySpy).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
    readySpy.mockRestore();
    closeSpy.mockRestore();
  });
});
