import React, { useEffect, useState } from 'react';
import creditService, { CreditAuditEvent } from '../../services/credit.service';

// §3.5d — Application Timeline View
// Horizontal stepper derived from CreditAuditEvent state-transition records.

type Props = {
  applicationId: string;
  currentState: string;
};

type TimelineStep = {
  state: string;
  enteredAt: string;
  daysInState: number;
  isRejectedOrDeclined: boolean;
};

const REJECTED_STATES = ['REJECTED', 'DECLINED', 'WITHDRAWN'];

function buildSteps(events: CreditAuditEvent[], currentState: string): TimelineStep[] {
  const transitions = events
    .filter(e => e.newState)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const steps: TimelineStep[] = [];
  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i];
    const next = transitions[i + 1];
    const enteredAt = t.createdAt;
    const endTime = next ? new Date(next.createdAt).getTime() : Date.now();
    const daysInState = Math.max(0, Math.floor((endTime - new Date(enteredAt).getTime()) / 86400000));
    steps.push({
      state: t.newState as string,
      enteredAt,
      daysInState,
      isRejectedOrDeclined: REJECTED_STATES.includes(t.newState as string),
    });
  }

  // Ensure the current state always appears, even if no audit event captured it (e.g. DRAFT)
  if (steps.length === 0 || steps[steps.length - 1].state !== currentState) {
    steps.push({
      state: currentState,
      enteredAt: transitions.length ? transitions[transitions.length - 1].createdAt : new Date().toISOString(),
      daysInState: 0,
      isRejectedOrDeclined: REJECTED_STATES.includes(currentState),
    });
  }

  return steps;
}

const ApplicationTimeline: React.FC<Props> = ({ applicationId, currentState }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<CreditAuditEvent[] | null>(null);

  useEffect(() => {
    if (open && events === null) {
      setLoading(true);
      creditService.getApplicationAudit(applicationId)
        .then(setEvents)
        .catch(() => setEvents([]))
        .finally(() => setLoading(false));
    }
  }, [open, events, applicationId]);

  const steps = events ? buildSteps(events, currentState) : [];

  return (
    <div className="bg-bg-surface border border-border rounded-xl mb-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors"
        style={{ cursor: 'pointer', border: 'none', background: 'transparent' }}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <span className="material-symbols-outlined text-lg text-brand-700">timeline</span>
          Application Timeline
        </span>
        <span className="material-symbols-outlined text-text-secondary">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5">
          {loading && <div className="text-sm text-text-secondary py-4">Loading timeline…</div>}
          {!loading && steps.length === 0 && <div className="text-sm text-text-secondary py-4">No state transitions recorded yet.</div>}
          {!loading && steps.length > 0 && (
            <div className="flex items-stretch overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
              {steps.map((step, idx) => {
                const isActive = idx === steps.length - 1;
                const isCompleted = !isActive && !step.isRejectedOrDeclined;
                return (
                  <React.Fragment key={`${step.state}-${idx}`}>
                    <div className="flex flex-col items-center text-center shrink-0" style={{ minWidth: 120 }}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1.5 ${
                        step.isRejectedOrDeclined ? 'bg-red-500 text-white'
                          : isActive ? 'bg-brand-700 text-white ring-4 ring-brand-100'
                          : isCompleted ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-400'
                      }`}>
                        <span className="material-symbols-outlined text-base">
                          {step.isRejectedOrDeclined ? 'close' : isCompleted ? 'check' : 'radio_button_checked'}
                        </span>
                      </div>
                      <span className={`text-xs font-bold ${isActive ? 'text-brand-700' : step.isRejectedOrDeclined ? 'text-red-600' : 'text-text-primary'}`}>
                        {step.state.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] text-text-secondary mt-0.5">
                        {new Date(step.enteredAt).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="text-[11px] text-text-tertiary">
                        {isActive ? `${step.daysInState}d so far` : `${step.daysInState}d`}
                      </span>
                    </div>
                    {idx < steps.length - 1 && (
                      <div className={`flex-1 h-0.5 mt-4 ${isCompleted ? 'bg-green-400' : 'bg-gray-200'}`} style={{ minWidth: 24 }} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ApplicationTimeline;
