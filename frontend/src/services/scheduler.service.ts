import apiClient from './api';

export interface SchedulerJob {
  id: string;
  jobKey: string;
  label: string;
  enabled: boolean;
  mode: 'cron' | 'interval';
  cronExpr: string | null;
  intervalMs: number | null;
  lastRunAt: string | null;
  lastStatus: 'success' | 'error' | null;
  lastError: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface UpdateJobPayload {
  enabled?: boolean;
  mode?: 'cron' | 'interval';
  cronExpr?: string | null;
  intervalMs?: number | null;
}

export const schedulerService = {
  async listJobs(): Promise<SchedulerJob[]> {
    const res = await apiClient.get('/admin/scheduler');
    return res.data.jobs;
  },

  async updateJob(jobKey: string, payload: UpdateJobPayload): Promise<SchedulerJob> {
    const res = await apiClient.patch(`/admin/scheduler/${jobKey}`, payload);
    return res.data.job;
  },

  async triggerJob(jobKey: string): Promise<void> {
    await apiClient.post(`/admin/scheduler/${jobKey}/trigger`);
  },

  async restartJob(jobKey: string): Promise<void> {
    await apiClient.post(`/admin/scheduler/${jobKey}/restart`);
  },
};