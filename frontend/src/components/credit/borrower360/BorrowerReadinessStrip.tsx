import React from 'react';
import type { BorrowerReadiness, BorrowerNextAction } from './borrowerReadiness';
import { getReadinessTone } from './borrowerPresentation';
import { StatusPill } from './primitives';

export interface BorrowerReadinessStripProps {
  readiness: BorrowerReadiness;
  onAction: (action: BorrowerNextAction) => void;
}

const STATUS_LABEL: Record<BorrowerReadiness['status'], string> = {
  READY: 'Ready', WARNING: 'Application ready — follow-up needed', BLOCKED: 'Application blocked',
};

const BorrowerReadinessStrip: React.FC<BorrowerReadinessStripProps> = ({ readiness, onAction }) => {
  const firstAction = readiness.actions[0];
  const blockers = readiness.actions.filter((action) => action.severity === 'BLOCKER').length;
  const followUps = Math.max(readiness.outstandingCount - blockers, 0);
  const progressMessage = blockers > 0
    ? `${blockers} required ${blockers === 1 ? 'step blocks' : 'steps block'} application readiness`
    : followUps > 0
      ? `${followUps} follow-up ${followUps === 1 ? 'step remains' : 'steps remain'} before assessment`
      : 'All required checks are complete';

  return (
    <section className="rounded-fc border border-fc-outline bg-fc-surface p-4" aria-labelledby="borrower-readiness-heading" aria-live="polite">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <StatusPill label={STATUS_LABEL[readiness.status]} tone={getReadinessTone(readiness.status)} />
          <div>
            <h2 id="borrower-readiness-heading" className="text-sm font-bold text-fc-primary">Borrower readiness</h2>
            <p className="text-xs text-fc-on-variant">
              {progressMessage}
            </p>
          </div>
        </div>
        <div className="min-w-48">
          <div className="mb-1 flex justify-between text-xs text-fc-on-variant"><span>Completion</span><strong>{readiness.completionPct}%</strong></div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-label="Readiness completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={readiness.completionPct}>
            <div className="h-full bg-fc-primary transition-all" style={{ width: `${readiness.completionPct}%` }} />
          </div>
        </div>
      </div>
      {firstAction ? (
        <div className="mt-4 flex flex-col gap-2 border-t border-fc-outline pt-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-fc-on-variant"><strong className="text-fc-primary">Next step: {firstAction.title}</strong><br />{firstAction.description}</p>
          <button type="button" onClick={() => onAction(firstAction)} className="shrink-0 self-start rounded-fc border border-fc-primary px-3 py-2 text-xs font-bold text-fc-primary hover:bg-fc-surface-low md:self-auto">
            {firstAction.actionLabel}
          </button>
        </div>
      ) : null}
    </section>
  );
};

export default BorrowerReadinessStrip;
export { BorrowerReadinessStrip };
