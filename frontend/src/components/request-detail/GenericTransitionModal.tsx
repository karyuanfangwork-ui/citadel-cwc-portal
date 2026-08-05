import React, { useEffect, useState } from 'react';
import ModalWrapper from '../ModalWrapper';
import type { AvailableTransition } from '../../services/request.service';

interface GenericTransitionModalProps {
  open: boolean;
  transition: AvailableTransition | null;
  onClose: () => void;
  onSubmit: (comment?: string) => Promise<void>;
}

function humanizeStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const GenericTransitionModal: React.FC<GenericTransitionModalProps> = ({
  open,
  transition,
  onClose,
  onSubmit,
}) => {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setComment('');
      setError(null);
      setSubmitting(false);
    }
  }, [open, transition?.id]);

  if (!transition) return null;

  const label = transition.transitionLabel || `Move to ${humanizeStatus(transition.toStatus)}`;
  const destination = humanizeStatus(transition.toStatus);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (transition.requiresComment && !comment.trim()) {
      setError('A comment is required for this transition.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onSubmit(comment.trim() || undefined);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Transition failed. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper open={open} onClose={onClose} title={label}>
      <form onSubmit={handleSubmit} noValidate>
        <p className="text-sm text-text-secondary mb-4">
          Move this request to <strong>{destination}</strong>.
        </p>
        <label htmlFor="workflow-transition-comment" className="block text-xs font-bold text-text-secondary uppercase tracking-wide mb-1.5">
          Comment{transition.requiresComment ? <span className="text-red-500 ml-0.5">*</span> : <span className="font-normal normal-case text-text-tertiary ml-1">(optional)</span>}
        </label>
        <textarea
          id="workflow-transition-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={4}
          className="w-full px-3 py-2.5 text-sm border border-cwc-border rounded-cwc-md bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-[#0052cc]/30 focus:border-[#0052cc] resize-none"
          placeholder="Add context for this transition..."
          required={transition.requiresComment}
        />
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-cwc-md mt-3">{error}</p>}
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-cwc-border">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-bold text-text-secondary bg-white border border-cwc-border rounded-cwc-md hover:bg-surface-muted" disabled={submitting}>
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="px-4 py-2.5 text-sm font-bold rounded-cwc-md bg-[#0052cc] text-white hover:bg-blue-700 disabled:opacity-50">
            {submitting ? 'Submitting…' : label}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

export default GenericTransitionModal;
