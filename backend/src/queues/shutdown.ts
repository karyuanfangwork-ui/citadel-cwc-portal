/**
 * Release every background queue and worker without requiring callers to know
 * which subsystem was imported by a test or application path.
 */
export async function shutdownAllQueues(): Promise<void> {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['credit queues', async () => {
      const m = await import('../credit/queues');
      return m.closeCreditQueues();
    }],
    ['pdf queue', async () => {
      const m = await import('./pdf.queue');
      return m.closePdfQueue();
    }],
    ['attachment scan queue', async () => {
      const m = await import('./attachmentScan.queue');
      return m.closeAttachmentScanQueue();
    }],
    ['sla timer queue', async () => {
      const m = await import('./timer.queue');
      return m.closeSlaTimerQueue();
    }],
    ['sla timer worker', async () => {
      const m = await import('../workers/timer.worker');
      return m.stopSlaTimerWorker();
    }],
    ['monitor job', async () => {
      const m = await import('../credit/jobs/monitor.job');
      return m.stopMonitorJob();
    }],
  ];

  for (const [, run] of steps) {
    try {
      await run();
    } catch {
      /* subsystem not loaded, or already shut down */
    }
  }
}