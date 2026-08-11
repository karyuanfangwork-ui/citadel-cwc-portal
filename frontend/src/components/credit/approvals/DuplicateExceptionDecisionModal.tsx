import React, { useState } from 'react';
import creditService from '@/src/services/credit.service';
import type { DuplicateExceptionQueueItem } from '@/src/types/credit-ui.types';

interface Props {
  exception: DuplicateExceptionQueueItem;
  onClose: () => void;
  onDecided: () => void;
}

const DuplicateExceptionDecisionModal: React.FC<Props> = ({ exception, onClose, onDecided }) => {
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (decision === 'REJECT' && comment.trim().length < 10) {
      setError('A rejection comment of at least 10 characters is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await creditService.decideDuplicateException(exception.id, { decision, comment: comment.trim() || undefined });
      onDecided();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'The decision could not be saved. Refresh and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="duplicate-decision-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-bg-surface p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="duplicate-decision-title" className="text-lg font-bold text-text-primary">Decide duplicate exception</h3>
            <p className="mt-1 text-sm text-text-secondary">{exception.matchedBorrower.name || 'Unnamed borrower'} · {exception.category}</p>
          </div>
          <button type="button" aria-label="Close decision dialog" onClick={onClose} className="text-xl text-text-secondary">×</button>
        </div>
        <div className="mt-4 rounded-lg border border-border bg-bg-subtle p-3 text-sm">
          <p><strong>Requester:</strong> {exception.requester.name}</p>
          <p className="mt-1"><strong>Justification:</strong> {exception.justification}</p>
          {exception.supportingReference && <p className="mt-1"><strong>Reference:</strong> {exception.supportingReference}</p>}
          <p className="mt-2 text-xs text-text-tertiary">Approved exceptions are single-use and expire after 24 hours.</p>
        </div>
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-semibold">Decision</legend>
          <label className="mr-4 text-sm"><input type="radio" checked={decision === 'APPROVE'} onChange={() => setDecision('APPROVE')} /> Approve</label>
          <label className="text-sm"><input type="radio" checked={decision === 'REJECT'} onChange={() => setDecision('REJECT')} /> Reject</label>
        </fieldset>
        <label className="mt-4 block text-sm font-semibold">Decision comment {decision === 'REJECT' ? '(required)' : '(optional)'}
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-border bg-bg-surface p-2 text-sm" />
        </label>
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-3 py-2 text-sm font-semibold">Cancel</button>
          <button type="button" disabled={saving} onClick={() => void submit()} className="rounded-md bg-brand-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save decision'}</button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateExceptionDecisionModal;
