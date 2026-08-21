interface WizardActionsProps {
  currentStepIndex: number;
  totalSteps: number;
  canAdvance: boolean;
  canSubmit: boolean;
  savingDraft: boolean;
  submitting: boolean;
  isReviewStep: boolean;
  onPrevious: () => void;
  onSaveDraft: () => void;
  onNext: () => void;
  onCreate: () => void;
}

export default function WizardActions({
  currentStepIndex,
  totalSteps,
  canAdvance,
  canSubmit,
  savingDraft,
  submitting,
  isReviewStep,
  onPrevious,
  onSaveDraft,
  onNext,
  onCreate,
}: WizardActionsProps) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: 'var(--cr-outline-variant)' }}>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onPrevious} disabled={currentStepIndex === 0} className="rounded border px-4 py-2 text-sm font-semibold disabled:opacity-40" style={{ borderColor: 'var(--cr-outline-variant)', background: 'white', color: 'var(--cr-on-surface)' }}>
          Previous
        </button>
        <button type="button" onClick={onSaveDraft} disabled={savingDraft} className="rounded border px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ borderColor: 'var(--cr-outline-variant)', background: 'white', color: 'var(--cr-on-surface)' }}>
          {savingDraft ? 'Saving…' : 'Save Draft'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--cr-on-surface-variant)' }}>
          Step {currentStepIndex + 1} of {totalSteps}
        </span>
        {isReviewStep ? (
          <button
            type="button"
            onClick={onCreate}
            disabled={submitting || !canSubmit}
            className="rounded px-5 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--cr-primary)', color: 'var(--cr-on-primary)', border: 'none' }}
          >
            {submitting ? 'Creating…' : 'Create Draft'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={!canAdvance}
            className="rounded px-5 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--cr-primary)', color: 'var(--cr-on-primary)', border: 'none' }}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
