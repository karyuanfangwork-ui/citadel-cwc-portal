import React, { useEffect, useState, useCallback } from 'react';
import { schedulerService, SchedulerJob, UpdateJobPayload } from '../../services/scheduler.service';

function parseCronHint(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, , , dow] = parts;
  const days = dow === '*' ? 'every day' : dow === '1-5' ? 'Mon–Fri' : `day ${dow}`;
  const time = hour === '*' ? 'every hour' : `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  if (hour.startsWith('*/')) return `Every ${hour.slice(2)} hours`;
  return `${days} at ${time}`;
}

function formatInterval(ms: number): string {
  if (ms >= 3600000) return `Every ${ms / 3600000}h`;
  if (ms >= 60000) return `Every ${ms / 60000}min`;
  return `Every ${ms / 1000}s`;
}

function timeAgo(dt: string | null): string {
  if (!dt) return 'Never';
  const diff = Date.now() - new Date(dt).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const CRM_KEYS = [
  'crm.activity_reminders', 'crm.lead_aging', 'crm.overdue_followups',
  'crm.stale_deals', 'crm.trust_reviews', 'crm.kyc_expiration', 'crm.rep_inactivity',
];

interface EditState extends UpdateJobPayload {
  jobKey: string;
  cronInput: string;
  intervalInput: string;
  intervalUnit: 'minutes' | 'hours';
  cronError: string;
}

export default function SchedulerSettings() {
  const [jobs, setJobs] = useState<SchedulerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [crmExpanded, setCrmExpanded] = useState(true);
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setJobs(await schedulerService.listJobs());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(job: SchedulerJob) {
    try {
      await schedulerService.updateJob(job.jobKey, { enabled: !job.enabled });
      await schedulerService.restartJob(job.jobKey);
      await load();
      showToast(`${job.label} ${!job.enabled ? 'enabled' : 'disabled'}`);
    } catch {
      showToast('Failed to update job');
    }
  }

  async function handleTrigger(job: SchedulerJob) {
    try {
      await schedulerService.triggerJob(job.jobKey);
      showToast(`${job.label} triggered successfully`);
      await load();
    } catch {
      showToast(`Failed to trigger ${job.label}`);
    }
  }

  function openEdit(job: SchedulerJob) {
    const intervalMs = job.intervalMs || 3600000;
    const isHours = intervalMs % 3600000 === 0;
    setEditState({
      jobKey: job.jobKey,
      mode: job.mode,
      cronInput: job.cronExpr || '',
      intervalInput: isHours ? String(intervalMs / 3600000) : String(intervalMs / 60000),
      intervalUnit: isHours ? 'hours' : 'minutes',
      cronError: '',
    });
  }

  async function handleSave() {
    if (!editState) return;
    let cronError = '';
    const payload: UpdateJobPayload = { mode: editState.mode };

    if (editState.mode === 'cron') {
      if (!editState.cronInput.trim()) { cronError = 'Cron expression is required'; }
      payload.cronExpr = editState.cronInput.trim();
    } else {
      const val = Number(editState.intervalInput);
      if (!val || val < 1) { cronError = 'Interval must be a positive number'; }
      payload.intervalMs = editState.intervalUnit === 'hours' ? val * 3600000 : val * 60000;
    }

    if (cronError) { setEditState({ ...editState, cronError }); return; }

    setSaving(true);
    try {
      await schedulerService.updateJob(editState.jobKey, payload);
      await schedulerService.restartJob(editState.jobKey);
      setEditState(null);
      await load();
      showToast('Schedule updated');
    } catch (err: any) {
      setEditState({ ...editState, cronError: err?.response?.data?.error || 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  function JobRow({ job }: { job: SchedulerJob }) {
    const isEditing = editState?.jobKey === job.jobKey;
    return (
      <div className="border border-gray-100 rounded-lg p-4 mb-2 bg-white">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <span className="font-medium text-gray-800 text-sm">{job.label}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleToggle(job)}
              className={`relative inline-flex h-5 w-10 rounded-full transition-colors ${job.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${job.enabled ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-xs text-gray-500 ml-1">{job.enabled ? 'On' : 'Off'}</span>
          </div>
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${job.mode === 'cron' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}`}>
            {job.mode}
          </span>
          <div className="text-xs text-gray-500 min-w-[140px]">
            {job.mode === 'cron'
              ? <><span className="font-mono">{job.cronExpr}</span><br /><span className="text-gray-400">{job.cronExpr ? parseCronHint(job.cronExpr) : ''}</span></>
              : job.intervalMs ? formatInterval(job.intervalMs) : '—'}
          </div>
          <div className="text-xs min-w-[100px]">
            <span className="text-gray-500">{timeAgo(job.lastRunAt)}</span>
            {job.lastStatus && (
              <span className={`ml-1 px-1.5 py-0.5 rounded text-xs font-medium ${job.lastStatus === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {job.lastStatus}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => isEditing ? setEditState(null) : openEdit(job)} className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
            <button onClick={() => handleTrigger(job)} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded hover:bg-blue-100">
              Run Now
            </button>
          </div>
        </div>

        {isEditing && editState && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-sm">
                <input type="radio" checked={editState.mode === 'cron'} onChange={() => setEditState({ ...editState, mode: 'cron', cronError: '' })} />
                Cron expression
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="radio" checked={editState.mode === 'interval'} onChange={() => setEditState({ ...editState, mode: 'interval', cronError: '' })} />
                Interval
              </label>
            </div>

            {editState.mode === 'cron' ? (
              <div>
                <input
                  type="text"
                  value={editState.cronInput}
                  onChange={(e) => setEditState({ ...editState, cronInput: e.target.value, cronError: '' })}
                  placeholder="0 9 * * 1-5"
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm font-mono w-64"
                />
                {editState.cronInput && !editState.cronError && (
                  <p className="text-xs text-gray-400 mt-1">{parseCronHint(editState.cronInput)}</p>
                )}
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min="1"
                  value={editState.intervalInput}
                  onChange={(e) => setEditState({ ...editState, intervalInput: e.target.value, cronError: '' })}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm w-24"
                />
                <select
                  value={editState.intervalUnit}
                  onChange={(e) => setEditState({ ...editState, intervalUnit: e.target.value as 'minutes' | 'hours' })}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                >
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                </select>
              </div>
            )}

            {editState.cronError && <p className="text-xs text-red-600">{editState.cronError}</p>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save & Apply'}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading scheduler…</div>;

  const topJobs = jobs.filter((j) => !CRM_KEYS.includes(j.jobKey));
  const crmJobs = jobs.filter((j) => CRM_KEYS.includes(j.jobKey));

  return (
    <div className="max-w-4xl">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">Scheduler</h2>
      <p className="text-sm text-gray-500 mb-6">Configure and control background job schedules. Changes apply immediately and persist across restarts.</p>

      {topJobs.map((j) => <JobRow key={j.jobKey} job={j} />)}

      <div className="mt-4">
        <button
          onClick={() => setCrmExpanded((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"
        >
          <span className={`transition-transform text-gray-500 ${crmExpanded ? 'rotate-0' : '-rotate-90'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </span>
          CRM Automation ({crmJobs.length} jobs)
        </button>
        {crmExpanded && crmJobs.map((j) => <JobRow key={j.jobKey} job={j} />)}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-[300]">
          {toast}
        </div>
      )}
    </div>
  );
}