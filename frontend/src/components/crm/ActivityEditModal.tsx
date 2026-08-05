import React, { useState, useEffect } from 'react';
import type { CrmActivity, CrmActivityType } from '../../services/crm.service';

export interface ActivityEditModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<CrmActivity>) => void;
  activity: CrmActivity | null;
  saving: boolean;
}

const ACTIVITY_TYPES: { label: string; value: CrmActivityType }[] = [
  { label: 'Call', value: 'CALL' },
  { label: 'Email', value: 'EMAIL' },
  { label: 'Meeting', value: 'MEETING' },
  { label: 'Note', value: 'NOTE' },
  { label: 'Task', value: 'TASK' },
  { label: 'Follow Up', value: 'FOLLOW_UP' },
  { label: 'WhatsApp', value: 'WHATSAPP' },
  { label: 'Site Visit', value: 'SITE_VISIT' },
];

const ActivityEditModal: React.FC<ActivityEditModalProps> = ({
  open,
  onClose,
  onSave,
  activity,
  saving,
}) => {
  const [activityType, setActivityType] = useState<CrmActivityType>('NOTE');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [completedAt, setCompletedAt] = useState('');

  // Pre-fill form when activity is provided
  useEffect(() => {
    if (activity) {
      setActivityType(activity.activityType);
      setSubject(activity.subject);
      setDescription(activity.description ?? '');
      setScheduledAt(activity.scheduledAt ? activity.scheduledAt.slice(0, 16) : '');
      setCompletedAt(activity.completedAt ? activity.completedAt.slice(0, 16) : '');
    }
  }, [activity]);

  if (!open || !activity) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    onSave({
      activityType,
      subject: subject.trim(),
      description: description.trim() || null,
      scheduledAt: scheduledAt || null,
      completedAt: completedAt || null,
    });
  };

  const inputClass =
    'w-full px-3 py-2 border border-cwc-border rounded-cwc-md text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-200';
  const inputStyle: React.CSSProperties = {
    fontFamily: 'var(--font-sans)',
    background: 'var(--bg-surface)',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Edit Activity"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-muted transition-colors"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
          aria-label="Close"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        <h2 className="text-lg font-semibold text-text-primary pr-8 mb-4">
          Edit Activity
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Type */}
          <div className="flex flex-col gap-1">
            <label htmlFor="activity-edit-type" className="text-sm font-medium text-text-primary">
              Type
            </label>
            <select
              id="activity-edit-type"
              value={activityType}
              onChange={(e) => setActivityType(e.target.value as CrmActivityType)}
              className={inputClass}
              style={inputStyle}
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div className="flex flex-col gap-1">
            <label htmlFor="activity-edit-subject" className="text-sm font-medium text-text-primary">
              Subject <span className="text-danger">*</span>
            </label>
            <input
              id="activity-edit-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className={inputClass}
              style={inputStyle}
              placeholder="Activity subject"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label htmlFor="activity-edit-desc" className="text-sm font-medium text-text-primary">
              Description
            </label>
            <textarea
              id="activity-edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${inputClass} resize-y`}
              style={inputStyle}
              placeholder="Optional description"
            />
          </div>

          {/* Scheduled Date */}
          <div className="flex flex-col gap-1">
            <label htmlFor="activity-edit-scheduled" className="text-sm font-medium text-text-primary">
              Scheduled Date
            </label>
            <input
              id="activity-edit-scheduled"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Completed Date */}
          <div className="flex flex-col gap-1">
            <label htmlFor="activity-edit-completed" className="text-sm font-medium text-text-primary">
              Completed Date
            </label>
            <input
              id="activity-edit-completed"
              type="datetime-local"
              value={completedAt}
              onChange={(e) => setCompletedAt(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-text-secondary bg-white border border-cwc-border rounded-cwc-md hover:bg-surface-muted transition-colors disabled:opacity-50"
              style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !subject.trim()}
              className="px-4 py-2 text-sm font-semibold text-white bg-brand-700 rounded-cwc-md hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              {saving ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  Saving…
                </span>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ActivityEditModal;